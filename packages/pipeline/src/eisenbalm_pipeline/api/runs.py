"""Pipeline run endpoints (CONTEXT D-06/07/08/09/31 + research §3 + §2 + Example 1).

Four routes:
  - POST /run/weekly          — trigger a run, return {runId} immediately
  - GET  /run/{runId}/status  — read Convex pipelineRuns:byRunId (OPS-02)
  - POST /run/{runId}/resume  — Command(resume=...) into the paused graph (PIP-10)
  - POST /run/{runId}/publish — manual fallback stub (Phase 6 wires real PDF)

Background execution uses asyncio.create_task (research §3 Pattern 3) rather
than FastAPI BackgroundTasks: BackgroundTasks is cancelled on client
disconnect, which can leave pipelineRuns.status='running' forever. CONTEXT
D-06 explicitly defers this choice to the planner/executor.

Phase 25: _start_run is the single shared trigger body used by both
/run/weekly (legacy, trigger-secret auth) and the new /pipeline/run +
/pipeline/tick control endpoints (control.py, Clerk/secret auth).
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import date, datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from langgraph.types import Command
from pydantic import BaseModel

from eisenbalm_pipeline.api.auth import require_clerk_jwt
from eisenbalm_pipeline.lib.config_loader import load_run_config, snapshot_config
import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.lib.convex_client import convex_mutation, convex_query
from eisenbalm_pipeline.lib.cost import begin_run
from eisenbalm_pipeline.lib.errors import CostCapExceeded, RunCancelled
from eisenbalm_pipeline.lib.ids import new_run_id
from eisenbalm_pipeline.graph.builder import SECTION_WRITERS

log = logging.getLogger(__name__)
router = APIRouter()


# Auto-increment read: project an OBJECT (not a scalar) so groq_query's
# `body.get("result") or []` cannot coerce a legitimate 0/null number into an
# empty list ambiguously — `result == {"issueNumber": N}` on hit, `null -> []`
# on an empty dataset. Mirrors the calibrator's `order(issueNumber desc)` style.
QUERY_MAX_ISSUE_NUMBER = (
    '*[_type == "weeklyIssue"] | order(issueNumber desc)[0]{ issueNumber }'
)


async def _resolve_issue_number(body_issue_number: Optional[int]) -> int:
    """Resolve the issue number for a weekly run.

    Root cause this fixes: lib/sanity_client.write_issue_draft builds
    ``issue_id = f"issue-{issue_number}"`` via ``createOrReplace``. A fixed
    default (previously 999) meant every empty-body cron/manual trigger
    OVERWROTE ``issue-999`` and never became the homepage's
    ``order(issueNumber desc)[0]`` latest issue.

    Behavior:
      - Explicit override: when ``body_issue_number`` is not None, return it
        verbatim and perform NO Sanity read (manual override + tests).
      - Auto-increment: when None, read the max existing
        ``weeklyIssue.issueNumber`` via GROQ and return ``max + 1``.
      - Empty dataset (no weeklyIssue docs / missing number) -> base 1.

    Fail-loud is intentional: a GROQ read error on the auto path propagates
    (the caller turns it into a 5xx and the cron run is marked failed) rather
    than silently defaulting to a colliding number.
    """
    if body_issue_number is not None:
        return body_issue_number

    # Local import to avoid circular import at module load (same pattern
    # manual_publish uses for groq_query).
    from eisenbalm_pipeline.lib.sanity_client import groq_query

    # When Sanity env is not configured (test / local dev), skip the read and
    # default to 1 so tests don't need a live Sanity connection. In all
    # deployed environments, NEXT_PUBLIC_SANITY_PROJECT_ID is required, so
    # actual Sanity read errors propagate (fail-loud semantics preserved).
    if not os.environ.get("NEXT_PUBLIC_SANITY_PROJECT_ID"):
        log.warning(
            "_resolve_issue_number: NEXT_PUBLIC_SANITY_PROJECT_ID not set — "
            "defaulting to issue_number=1 (local dev / test mode)."
        )
        return 1

    rows = await groq_query(QUERY_MAX_ISSUE_NUMBER)

    # Normalize both shapes groq_query may return for a `[0]{...}` projection
    # (single dict, or a one-item list), exactly like fetch_narrator_by_slug.
    doc: Optional[dict] = None
    if isinstance(rows, dict):
        doc = rows
    elif isinstance(rows, list) and rows:
        doc = rows[0]
    max_num = doc.get("issueNumber") if doc else None
    return (max_num + 1) if isinstance(max_num, int) else 1


# ── Request models (CONTEXT "Claude's Discretion" — BaseModel for bodies) ──

class RunWeeklyBody(BaseModel):
    # None -> auto-increment to max(existing)+1 at trigger time (was: hardcoded
    # 999, CONTEXT D-16); explicit value honored verbatim (manual override + tests).
    issueNumber: Optional[int] = None
    forceNoWinner: bool = False  # stub-mode toggle (D-36 test)
    forceFailAgent: Optional[str] = None  # stub-mode toggle (D-37 test)
    # Phase 16 trigger-path: optional narrator slug override. When provided,
    # injects state["narrator_slug"], which the calibrator resolves via Sanity
    # GROQ (graph/state.py L195-199 + agents/calibrator.py L195 resolution
    # chain step 2). When omitted (None), the chain falls through to
    # charity.narratorSlug then Jesse default — preserves byte-equivalent
    # Phase 15 behavior for the no-narrator path (NRR-10).
    narratorSlug: Optional[str] = None


class ResumeSelection(BaseModel):
    charityName: str


class ResumeBody(BaseModel):
    selection: ResumeSelection


# ── Auth helper ────────────────────────────────────────────────────────────

def _require_trigger_secret(request: Request) -> None:
    """Enforce the X-Pipeline-Trigger-Secret header (CONTEXT D-31).

    If PIPELINE_TRIGGER_SECRET is unset (local dev), the check is skipped with
    a logged warning — so the app is usable locally without provisioning the
    secret, while still being protected in any environment that sets it.
    """
    expected = os.environ.get("PIPELINE_TRIGGER_SECRET")
    if not expected:
        log.warning(
            "PIPELINE_TRIGGER_SECRET unset — skipping trigger-secret check "
            "(local dev). Set it in any deployed environment."
        )
        return
    provided = request.headers.get("X-Pipeline-Trigger-Secret")
    if not provided or provided != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid X-Pipeline-Trigger-Secret",
        )


def _require_graph(request: Request) -> Any:
    """Return the compiled graph, or raise 503 if the lifespan ran degraded.

    The lifespan leaves app.state.graph = None when SUPABASE_POSTGRES_URL is
    missing or Supabase is unreachable (see api/main.py). Endpoints that need
    the graph surface that as a 503 rather than an opaque AttributeError.
    """
    graph = getattr(request.app.state, "graph", None)
    if graph is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Pipeline graph unavailable — the FastAPI lifespan started in "
                "degraded mode (SUPABASE_POSTGRES_URL missing or Supabase "
                "unreachable). Check the service logs."
            ),
        )
    return graph


# ── Background task wrapper (research Pattern 3) ──────────────────────────

async def _execute_run(
    app: Any, run_id: str, initial_state: dict, config: dict
) -> None:
    """Background coroutine. Strong-ref'd in app.state.background_tasks
    so it survives client disconnect (research §3 + Pitfall 4)."""
    http = getattr(app.state, "convex_http", None)
    try:
        result = await app.state.graph.ainvoke(initial_state, config=config)
        # On interrupt: result contains __interrupt__. The Editor node already
        # wrote 'awaiting-review' to Convex (CONTEXT D-13). Nothing more here.
        # On clean completion: Publisher already wrote 'awaiting-review'
        # (CONTEXT D-18 step 12).
        log.info(
            "Run %s background task complete (state.keys=%d)",
            run_id, len(result or {}),
        )
    except RunCancelled:
        # Cooperative cancel (RUN-04, D-01): wrap_agent_node raised RunCancelled
        # instead of starting the next node. Land runs.status='cancelled'.
        # NOTE (Pitfall 1): pipelineRuns.status stays 'failed' (frozen union —
        # the @agent_node wrapper already wrote that). Only the runs table gets
        # the operator-visible 'cancelled' terminal status.
        await _cc.convex_mutation(
            http,
            "runs:updateStatus",
            {"runId": run_id, "status": "cancelled", "completedAt": int(time.time() * 1000)},
        )
        log.info("Run %s cancelled cooperatively", run_id)
    except CostCapExceeded:
        # Per-run cost cap reached (D-07): same terminal landing as cancel.
        await _cc.convex_mutation(
            http,
            "runs:updateStatus",
            {"runId": run_id, "status": "cancelled", "completedAt": int(time.time() * 1000)},
        )
        log.warning("Run %s ended: per-run cost cap exceeded", run_id)
    except Exception:
        # The @agent_node wrapper already wrote 'failed' to Convex.
        # Let the task die quietly.
        log.exception("Run %s background task raised", run_id)


# ── Shared run-launch helper (Phase 25, RUN-01/RUN-02/RUN-03) ───────────────
#
# _start_run contains the SINGLE authoritative trigger body, factored out from
# run_weekly so /pipeline/run (Clerk-authed manual trigger) and /pipeline/tick
# (cron-authed schedule tick) can both call it without duplicating the
# CFG-04-critical ordering or the agent_runs pre-population logic.
#
# Callers pass `app` (the FastAPI application) rather than `request` so
# _start_run can be called from control.py without a live Request object.
# app.state.{graph, convex_http, background_tasks} are the three state slots
# this helper reads — the same ones run_weekly accessed via request.app.state.

async def _start_run(
    app: Any,
    *,
    issue_number: Optional[int],
    trigger_source: str,
    triggered_by: Optional[str] = None,
    force_no_winner: bool = False,
    force_fail_agent: Optional[str] = None,
    narrator_slug: Optional[str] = None,
) -> str:
    """Shared pipeline run launcher. Returns run_id.

    Accepts:
        app:            The FastAPI application (provides app.state.*).
        issue_number:   Explicit issue number (None → auto-increment via Sanity).
        trigger_source: "manual" | "cron" — written to runs:create.
        triggered_by:   Clerk userId (sub claim) for operator attribution, or
                        "cron" for automated tick triggers, or None.
        force_no_winner:    Dev toggle — bypasses winner selection (D-36).
        force_fail_agent:   Dev toggle — forces a named agent to fail (D-37).
        narrator_slug:  Optional narrator override (Phase 16 NRR-05).

    Returns:
        The new run_id string.

    CFG-04 ordering (PRESERVED — do not reorder):
        1. _resolve_issue_number
        2. new_run_id / begin_run
        3. convex_mutation pipelineRuns:create
        4. convex_mutation runs:create (with triggeredBy)
        5. convex_mutation agentRuns:queueForRun
        6. load_run_config + snapshot_config   ← BEFORE asyncio.create_task
        7. asyncio.create_task(_execute_run)
    """
    # Step 1: Resolve issue number (no Sanity read when explicit).
    if issue_number is None:
        issue_number = await _resolve_issue_number(None)

    # Step 2: Generate identifiers and start cost tracking.
    run_id = new_run_id()
    started_at_ms = int(time.time() * 1000)
    begin_run(run_id)

    http = getattr(app.state, "convex_http", None)

    # Step 3: Insert pipelineRuns row BEFORE launching the graph (Anti-Pattern:
    # otherwise the wrapper's failure path calls updateStatus on a missing row).
    # Use _cc.convex_mutation (module-level) so monkeypatching in tests reaches here.
    await _cc.convex_mutation(
        http,
        "pipelineRuns:create",
        {
            "runId": run_id,
            "issueNumber": issue_number,
            "startedAt": started_at_ms,
        },
    )

    # Step 4: Create the dashboard-facing runs row with trigger attribution.
    # Phase 25: pass triggeredBy from the Clerk JWT sub claim (RUN-01 operator
    # attribution). status + startedAt are set server-side by Convex.
    runs_create_args: dict = {
        "workspace_id": "eisenbalm",
        "runId": run_id,
        "triggerSource": trigger_source,
    }
    if triggered_by is not None:
        runs_create_args["triggeredBy"] = triggered_by
    await _cc.convex_mutation(http, "runs:create", runs_create_args)

    # Step 5: Pre-populate agent_runs rows as "queued" (OBS-03).
    agent_keys = [
        "calibrator", "scout", "advocate", "editor_gate_1", "chronicler",
        "researcher", "verify_research",
        *SECTION_WRITERS,
        "validate_sections", "qa", "editor_final", "publisher",
    ]
    await _cc.convex_mutation(
        http,
        "agentRuns:queueForRun",
        {
            "workspace_id": "eisenbalm",
            "runId": run_id,
            "agentKeys": list(agent_keys),
        },
    )

    # Step 6: Load + snapshot RunConfig BEFORE create_task (CFG-04).
    # load_run_config uses convex_query internally via _cc module ref.
    run_config = await load_run_config(http)
    await snapshot_config(http, run_id, run_config)

    # Build initial DispatchState.
    initial_state: dict = {
        "run_id": run_id,
        "issue_number": issue_number,
        "publish_date": date.today().isoformat(),
        "pipeline_started_at": datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
        "_force_no_winner": force_no_winner,
        "_force_fail_agent": force_fail_agent,
        "config": run_config,
    }
    if narrator_slug is not None:
        initial_state["narrator_slug"] = narrator_slug
    config = {"configurable": {"thread_id": run_id}}

    # Step 7: Strong-ref'd background task (research Pattern 3).
    # app.state.background_tasks may be absent in bare-app test scenarios
    # (the lifespan normally sets it; tests that don't use the full lifespan
    # get a graceful no-op rather than an AttributeError).
    bg_tasks = getattr(app.state, "background_tasks", None)
    task = asyncio.create_task(
        _execute_run(app, run_id, initial_state, config)
    )
    if bg_tasks is not None:
        bg_tasks.add(task)
        task.add_done_callback(bg_tasks.discard)

    return run_id


# ── POST /run/weekly ──────────────────────────────────────────────────────

@router.post("/run/weekly")
async def run_weekly(request: Request, body: RunWeeklyBody) -> dict:
    """Trigger a new pipeline run. Returns {runId} immediately.

    Run continues in background (strong-ref'd asyncio.create_task).
    Poll GET /run/{runId}/status for terminal state.

    Phase 25: delegates to _start_run (the shared trigger body). Behavior is
    byte-equivalent to the pre-Phase-25 inlined body — existing tests stay green.
    """
    _require_trigger_secret(request)
    _require_graph(request)

    run_id = await _start_run(
        request.app,
        issue_number=body.issueNumber,
        trigger_source="manual",
        narrator_slug=body.narratorSlug,
        force_no_winner=body.forceNoWinner,
        force_fail_agent=body.forceFailAgent,
    )

    return {"runId": run_id}


# ── GET /run/{run_id}/status ─────────────────────────────────────────────

@router.get("/run/{run_id}/status")
async def run_status(request: Request, run_id: str) -> dict:
    """Return current pipeline state (CONTEXT D-07 + OPS-02).

    Reads Convex pipelineRuns:byRunId — the canonical source for run status.
    """
    # Anyone can call status (no trigger-secret) — public-ish read endpoint
    # behind Railway URL obscurity (CONTEXT "v1 has no users").
    row = await convex_query(
        request.app.state.convex_http,
        "pipelineRuns:byRunId",
        {"runId": run_id},
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run not found: {run_id}",
        )

    return {
        "runId": row.get("runId"),
        "status": row.get("status"),
        "startedAt": row.get("startedAt"),
        "completedAt": row.get("completedAt"),
        "durationMs": row.get("durationMs"),
        "cost": row.get("cost"),
        "errorMessage": row.get("errorMessage"),
    }


# ── POST /run/{run_id}/resume — research §2 + Example 1 ─────────────────

@router.post("/run/{run_id}/resume")
async def resume_run(
    request: Request, run_id: str, body: ResumeBody
) -> dict:
    """Resume a paused (interrupted) pipeline run.

    The graph for this run_id was paused inside Editor gate 1 via
    interrupt(). This endpoint passes Command(resume=...) into a fresh
    graph.ainvoke with the SAME thread_id, which causes LangGraph to load
    the checkpoint and re-run the editor node — interrupt() returns the
    resume value this time (research §2).
    """
    _require_trigger_secret(request)
    graph = _require_graph(request)

    config = {"configurable": {"thread_id": run_id}}

    # Sanity check: is this thread actually paused? (research §2 race-cond
    # mitigation — empty state.next means the graph has moved past the
    # interrupt and a resume would be a no-op-or-worse.)
    state = await graph.aget_state(config)
    if not state or not state.next:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Run {run_id} is not paused (state.next is empty)",
        )

    resume_payload = {"editorSelection": body.selection.charityName}

    async def _resume_run_task() -> None:
        try:
            await graph.ainvoke(
                Command(resume=resume_payload),
                config=config,
            )
        except Exception:
            log.exception("Resume task for %s raised", run_id)

    task = asyncio.create_task(_resume_run_task())
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)

    return {"runId": run_id, "resumed": True}


# ── POST /run/{run_id}/publish — WHK-08 manual fallback (real) ───────────

@router.post("/run/{run_id}/publish")
async def manual_publish(request: Request, run_id: str) -> dict:
    """Manual fallback re-trigger (WHK-08).

    The Sanity webhook handler is the primary trigger for the Publisher.
    This endpoint is the manual re-fire path used when:
      - Sanity webhook failed to deliver (network blip)
      - Webhook signature secret rotated and Sanity has stale cache
      - Andrew wants to re-render a PDF after editing pdfContent in Studio

    Looks up the Sanity issue document by `pipelineMetadata.runId == $runId`
    (the Sanity-side authoritative store), then invokes the SAME _run_publisher
    coroutine the webhook calls — there is exactly one Publisher implementation
    (research Pitfall 7).
    """
    _require_trigger_secret(request)
    log.info("Manual publish requested for runId=%s", run_id)

    # Import here to avoid circular import at module load (agents/publisher
    # imports sanity_client; api/runs.py imports convex_client; lib modules
    # may transitively touch the FastAPI router).
    from eisenbalm_pipeline.agents.publisher import (
        QUERY_ISSUE_BY_RUN_ID,
        _run_publisher,
    )
    from eisenbalm_pipeline.lib.sanity_client import groq_query

    # GROQ filter `*[...][0]` returns one object (or null) — groq_query's
    # contract is "list of results", so it returns [{}] or [].
    result = await groq_query(QUERY_ISSUE_BY_RUN_ID, params={"runId": run_id})
    issue = None
    if isinstance(result, list) and result:
        issue = result[0]
    elif isinstance(result, dict):
        issue = result
    if not issue or not issue.get("_id"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No Sanity weeklyIssue found for runId={run_id}",
        )

    task = asyncio.create_task(
        _run_publisher(
            request.app,
            issue_id=issue["_id"],
            issue_number=issue["issueNumber"],
            run_id=run_id,
        )
    )
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)

    return {
        "runId": run_id,
        "issueId": issue["_id"],
        "issueNumber": issue["issueNumber"],
        "scheduled": True,
    }


# ── Dashboard-control endpoints (Clerk JWT guard) ─────────────────────────
#
# These endpoints require a valid Clerk JWT via Depends(require_clerk_jwt).
# The cron path above (_require_trigger_secret) is intentionally UNTOUCHED.
# D-04 (21-CONTEXT): no synthetic run-trigger this phase — whoami only.

@router.post("/dashboard/whoami")
async def dashboard_whoami(
    claims: dict = Depends(require_clerk_jwt),
) -> dict:
    """Return the signed-in operator's Clerk user ID.

    Minimal dashboard-control endpoint proving the require_clerk_jwt guard
    is wired and that claims["sub"] (the Clerk userId) flows through.
    Used downstream as actorId on audit_log rows and triggeredBy on runs rows
    (attribute shapes defined in 21-CONTEXT D-13; write flows land Phase 23/25).

    Returns:
        {"operatorId": "<clerk-user-id>"} on success
    """
    return {"operatorId": claims.get("sub")}
