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
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import date, datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request, status
from langgraph.types import Command
from pydantic import BaseModel

from eisenbalm_pipeline.lib.convex_client import convex_mutation, convex_query
from eisenbalm_pipeline.lib.cost import begin_run
from eisenbalm_pipeline.lib.ids import new_run_id

log = logging.getLogger(__name__)
router = APIRouter()


# ── Request models (CONTEXT "Claude's Discretion" — BaseModel for bodies) ──

class RunWeeklyBody(BaseModel):
    issueNumber: int = 999  # CONTEXT D-16 default
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
    except Exception:
        # The @agent_node wrapper already wrote 'failed' to Convex.
        # Let the task die quietly.
        log.exception("Run %s background task raised", run_id)


# ── POST /run/weekly ──────────────────────────────────────────────────────

@router.post("/run/weekly")
async def run_weekly(request: Request, body: RunWeeklyBody) -> dict:
    """Trigger a new pipeline run. Returns {runId} immediately.

    Run continues in background (strong-ref'd asyncio.create_task).
    Poll GET /run/{runId}/status for terminal state.
    """
    _require_trigger_secret(request)
    graph = _require_graph(request)

    # CONTEXT D-09: generated EXACTLY ONCE.
    run_id = new_run_id()
    started_at_ms = int(time.time() * 1000)

    # Mark cost-recording start (lib/cost — CONTEXT D-22/D-23).
    begin_run(run_id)

    # CRITICAL: insert pipelineRuns row BEFORE launching the graph (research
    # Anti-Patterns — otherwise the wrapper's failure path would call
    # updateStatus on a missing row, which throws "Run not found").
    await convex_mutation(
        request.app.state.convex_http,
        "pipelineRuns:create",
        {
            "runId": run_id,
            "issueNumber": body.issueNumber,
            "startedAt": started_at_ms,
        },
    )

    # Build initial DispatchState. Underscore-prefixed test toggles carry the
    # forceNoWinner / forceFailAgent flags through state (graph/state.py).
    initial_state: dict = {
        "run_id": run_id,
        "issue_number": body.issueNumber,
        "publish_date": date.today().isoformat(),
        "pipeline_started_at": datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
        "_force_no_winner": body.forceNoWinner,
        "_force_fail_agent": body.forceFailAgent,
    }
    # Phase 16 trigger-path: inject narrator_slug only when explicitly provided.
    # Absent key (vs None) preserves byte-equivalent legacy state shape for
    # Jesse-default runs — the calibrator's resolution chain treats missing
    # and None the same (state.get("narrator_slug") falls through), but
    # omitting the key keeps the state diff minimal in checkpointer storage.
    if body.narratorSlug is not None:
        initial_state["narrator_slug"] = body.narratorSlug
    config = {"configurable": {"thread_id": run_id}}

    # Pattern 3: strong-ref'd background task (research §3).
    task = asyncio.create_task(
        _execute_run(request.app, run_id, initial_state, config)
    )
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)

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
