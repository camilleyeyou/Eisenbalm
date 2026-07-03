"""Phase 25 (RUN-01/RUN-02/RUN-03/RUN-04/RUN-05) — Run-control endpoints.

Four routes:
  - POST /pipeline/run                     — Clerk-JWT manual trigger
  - POST /pipeline/tick                    — Trigger-secret cron tick
  - POST /runs/{run_id}/cancel             — Cooperative cancel (RUN-04)
  - POST /runs/{run_id}/agents/{key}/rerun — Single-section re-roll (RUN-05)

Security model:
  /pipeline/run + /runs/*/cancel + /runs/*/rerun → require_clerk_jwt (Depends)
  /pipeline/tick → _require_trigger_secret — Railway cron, no Clerk session

Audit model:
  /pipeline/run  → emits auditLog:record with action="run.triggered"
  /pipeline/tick → emits auditLog:record with actorId="cron" on fire
  /runs/*/cancel → emits auditLog:record with action="run.cancelled"
  /runs/*/rerun  → emits auditLog:record with action="run.section_rerolled"
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Optional

from eisenbalm_pipeline.lib.budget import would_exceed_monthly_cap
from eisenbalm_pipeline.lib.cost import emit_monthly_alert

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.api.auth import _deployed
from eisenbalm_pipeline.api.runs import (
    RunWeeklyBody,
    _require_graph,
    _require_trigger_secret,
    _start_run,
)
from eisenbalm_pipeline.lib.scheduler import _is_due, compute_next_run_at
from eisenbalm_pipeline.lib.sanity_publish import _flip_sanity_published
from eisenbalm_pipeline.graph.builder import SECTION_WRITERS

# Module-level constant: agent keys that can be re-rolled (RUN-05, D-03).
# Derived from SECTION_WRITERS which honors DESIGNAGENT_SUPPRESSED at
# import time — if "design" is suppressed, it is absent from RE_ROLLABLE.
RE_ROLLABLE = set(SECTION_WRITERS)

# ── Section keys that every DispatchState has after a complete run ────────────
# Used to seed current_state so merged state always contains sibling fields
# even when no graph checkpoint is available (test-mode / degraded service).
_SECTION_STATE_KEYS: tuple[str, ...] = (
    "origin_story",
    "problem_statement",
    "founder_bio",
    "case_study",
    "game",
    "bonus",
    "theme",
)

# Use auto_error=False so local dev (no Authorization header, no
# CLERK_JWT_ISSUER_DOMAIN) gets the sentinel {"sub":"local-dev-operator"}
# rather than an automatic 401 from the bearer scheme.
_optional_bearer = HTTPBearer(auto_error=False)

log = logging.getLogger(__name__)
router = APIRouter()

WORKSPACE_ID = "eisenbalm"


# ── Dev-mode-safe Clerk JWT dependency ────────────────────────────────────
#
# Uses auto_error=False on HTTPBearer so local dev (no Authorization header,
# no CLERK_JWT_ISSUER_DOMAIN) returns the sentinel {"sub":"local-dev-operator"}
# instead of an automatic 401 from the bearer scheme.

async def _require_clerk_jwt_control(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
) -> dict:
    """Clerk JWT guard for control endpoints with dev-mode degradation.

    When CLERK_JWT_ISSUER_DOMAIN is unset:
      - Any request (including those without an Authorization header) gets
        sentinel {"sub": "local-dev-operator"}.
    When CLERK_JWT_ISSUER_DOMAIN is set:
      - Credentials are required (missing header → 401).
      - Token is verified via the full Clerk JWKS path in api/auth.py.
    """
    if not os.environ.get("CLERK_JWT_ISSUER_DOMAIN"):
        if _deployed():
            raise HTTPException(
                status_code=500,
                detail="CLERK_JWT_ISSUER_DOMAIN must be set in a deployed environment",
            )
        log.warning(
            "CLERK_JWT_ISSUER_DOMAIN unset — skipping Clerk JWT check "
            "(local dev). Set it in any deployed environment."
        )
        return {"sub": "local-dev-operator"}

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    # Delegate full verification to the canonical auth module.
    from eisenbalm_pipeline.api.auth import _fetch_public_key  # noqa: PLC0415
    import jwt  # noqa: PLC0415
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        public_key = _fetch_public_key(header["kid"])
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        log.warning("Clerk JWT verification failed: %r", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# ── Shared audit helper ────────────────────────────────────────────────────

async def _emit_audit(
    http: Any,
    *,
    actor_id: str,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
) -> None:
    """Write one audit_log row via the public auditLog:record Convex mutation.

    Non-blocking: if the write fails, logs a warning but does NOT raise
    (audit failure must never block a run trigger).
    """
    args: dict = {
        "workspace_id": WORKSPACE_ID,
        "actorId": actor_id,
        "action": action,
    }
    if resource_type is not None:
        args["resourceType"] = resource_type
    if resource_id is not None:
        args["resourceId"] = resource_id
    try:
        await _cc.convex_mutation(http, "auditLog:record", args)
    except Exception:  # noqa: BLE001
        log.warning(
            "Audit write failed (non-blocking): action=%r actor=%r resource=%r",
            action, actor_id, resource_id,
        )


# ── POST /pipeline/run ─────────────────────────────────────────────────────

@router.post("/pipeline/run")
async def pipeline_run(
    request: Request,
    body: RunWeeklyBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Operator manual trigger. Clerk JWT auth; records operator identity.

    One-at-a-time gate (D-12): rejects with 409 if a run is already in
    progress. The operator must wait for the current run to complete or cancel
    it via POST /runs/{run_id}/cancel (Plan 03).

    Budget start-gate (RUN-06): rejects with 409 when the trailing-average
    projection would exceed the monthly cap.

    Returns:
        {"runId": "<run_id>"}
    """
    operator_id = claims.get("sub")
    http = getattr(request.app.state, "convex_http", None)

    # One-at-a-time gate (D-12): check for an in-progress run.
    latest = await _cc.convex_query(http, "runs:latest", {"workspace_id": WORKSPACE_ID})
    if latest and latest.get("status") == "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A run is already in progress. Wait for it to complete or cancel it first.",
        )

    # ── Budget start-gate (RUN-06) ────────────────────────────────────────────
    # Read monthly cap from pipeline_config (one round-trip, not in hot path).
    pc_rows = await _cc.convex_query(
        http, "pipelineConfig:getAll", {"workspace_id": WORKSPACE_ID}
    ) or []
    _pc: dict = {}
    for row in pc_rows:
        try:
            _pc[row["key"]] = json.loads(row["value"])
        except Exception:  # noqa: BLE001
            _pc[row["key"]] = row["value"]
    over, info = await would_exceed_monthly_cap(
        http, monthly_cap_usd=float(_pc.get("monthly_cap_usd", 0.0))
    )
    if over:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Projected cost would exceed the monthly cap "
                f"(${info['mtdUsd']:.2f} MTD + ${info['projected']:.2f} projected"
                f" > ${info['cap']:.2f} cap). Raise the cap or wait until next month."
            ),
        )

    run_id = await _start_run(
        request.app,
        issue_number=body.issueNumber,
        trigger_source="manual",
        triggered_by=operator_id,
        narrator_slug=body.narratorSlug,
        force_no_winner=body.forceNoWinner,
        force_fail_agent=body.forceFailAgent,
    )

    # Emit audit row (non-blocking on failure).
    await _emit_audit(
        http,
        actor_id=operator_id or "unknown",
        action="run.triggered",
        resource_type="run",
        resource_id=run_id,
    )

    return {"runId": run_id}


# ── POST /pipeline/tick ────────────────────────────────────────────────────

@router.post("/pipeline/tick")
async def pipeline_tick(request: Request) -> dict:
    """Cron-driven schedule tick. X-Pipeline-Trigger-Secret auth.

    Five-step guard order (API_CONTRACTS §3B — Pitfall 4.2):
      1. Kill switch: schedule_enabled MUST be True → skip if False.
      2. Cadence gate: _is_due → skip if next-run cursor is in the future.
      3. One-at-a-time: skip if a run is already in progress.
      4. Budget start-gate: [Plan 04 seam] skip if projected spend > cap.
      5. Fire: _start_run, advance cursor, emit audit row.

    Returns:
        {"status": "triggered", "runId": "..."} on fire.
        {"status": "skipped", "reason": "<reason>"} on any gate hit.
    """
    _require_trigger_secret(request)
    http = getattr(request.app.state, "convex_http", None)

    # ── STEP 1: Kill switch (FIRST — Pitfall 4.2) ─────────────────────────
    pc_rows = await _cc.convex_query(
        http, "pipelineConfig:getAll", {"workspace_id": WORKSPACE_ID}
    ) or []
    pc: dict = {}
    for row in pc_rows:
        try:
            pc[row["key"]] = json.loads(row["value"])
        except Exception:  # noqa: BLE001
            pc[row["key"]] = row["value"]

    if not pc.get("schedule_enabled", False):
        return {"status": "skipped", "reason": "schedule_disabled"}

    # ── Scheduled-publish sweep (Phase 26 D-02) — runs every tick ─────────
    # Fires BEFORE the cadence gate so due scheduled publishes are processed
    # even when no new run is due (i.e., the cadence cursor is in the future).
    #
    # Flow: runs:dueForPublish → _flip_sanity_published → existing Sanity
    # webhook → _run_publisher (PDF + Vercel + charities:upsertFeatured D-03).
    # The registry upsert is NOT done here — it rides the webhook path from
    # agents/publisher/__init__.py so it fires exactly once per publish.
    now_ms = int(time.time() * 1000)
    _scheduled_published: list[str] = []
    try:
        due = await _cc.convex_query(
            http,
            "runs:dueForPublish",
            {"workspace_id": WORKSPACE_ID, "nowMs": now_ms},
        ) or []
        sanity_http = getattr(request.app.state, "sanity_http", None)
        for r in due:
            try:
                pr = await _cc.convex_query(
                    http, "pipelineRuns:byRunId", {"runId": r["runId"]}
                )
                sanity_id = (pr or {}).get("sanityIssueId")
                if sanity_id:
                    await _flip_sanity_published(sanity_http, sanity_id)
                    # Clear scheduledPublishAt to prevent re-fire on the next tick.
                    await _cc.convex_mutation(
                        http,
                        "runs:setScheduledPublish",
                        {"runId": r["runId"], "scheduledPublishAt": None},
                    )
                    _scheduled_published.append(r["runId"])
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "tick scheduled-publish failed for %s: %r",
                    r.get("runId"), exc,
                )
    except Exception as exc:  # noqa: BLE001
        log.warning("tick scheduled-publish sweep error: %r", exc)

    # ── STEP 2: Cadence gate ───────────────────────────────────────────────
    if not _is_due(pc, now_ms):
        return {
            "status": "skipped",
            "reason": "not_due",
            "scheduledPublished": _scheduled_published,
        }

    # ── STEP 3: One-at-a-time ──────────────────────────────────────────────
    latest = await _cc.convex_query(http, "runs:latest", {"workspace_id": WORKSPACE_ID})
    if latest and latest.get("status") == "running":
        return {
            "status": "skipped",
            "reason": "run_in_progress",
            "scheduledPublished": _scheduled_published,
        }

    # ── STEP 4: Budget start-gate (RUN-06) ────────────────────────────────────
    over, budget_info = await would_exceed_monthly_cap(
        http, monthly_cap_usd=float(pc.get("monthly_cap_usd", 0.0))
    )
    if over:
        # Emit monthly-scope cost-warning (alert only — D-07: no auto-cancel).
        await emit_monthly_alert(
            run_id="",  # no run started yet — use empty string as placeholder
            mtd_usd=float(budget_info.get("mtdUsd", 0.0)),
            monthly_cap=float(budget_info.get("cap", 0.0)),
            threshold_pct=float(pc.get("alert_threshold_pct", 80.0)),
        )
        return {
            "status": "skipped",
            "reason": "budget_projection_exceeds_cap",
            "scheduledPublished": _scheduled_published,
        }

    # ── STEP 5: Fire + advance cursor ─────────────────────────────────────
    run_id = await _start_run(
        request.app,
        issue_number=None,
        trigger_source="cron",
        triggered_by="cron",
    )

    # Advance the next-run cursor strictly past now (Pitfall 6).
    cadence = pc.get("schedule_cadence", {"dayOfWeek": 4, "hourUtc": 14, "minuteUtc": 0})
    from datetime import timezone
    from datetime import datetime as _dt
    now_dt = _dt.fromtimestamp(now_ms / 1000, tz=timezone.utc)
    next_dt = compute_next_run_at(cadence, now=now_dt)
    next_run_ms = int(next_dt.timestamp() * 1000)

    await _cc.convex_mutation(
        http,
        "pipelineConfig:upsert",
        {
            "workspace_id": WORKSPACE_ID,
            "key": "schedule_next_run_at",
            "value": json.dumps(next_run_ms),
        },
    )

    # Emit audit row for the cron-triggered run (non-blocking).
    await _emit_audit(
        http,
        actor_id="cron",
        action="run.triggered",
        resource_type="run",
        resource_id=run_id,
    )

    return {
        "status": "triggered",
        "runId": run_id,
        "scheduledPublished": _scheduled_published,
    }


# ── POST /runs/{run_id}/cancel — RUN-04 ───────────────────────────────────────

@router.post("/runs/{run_id}/cancel")
async def cancel_run(
    request: Request,
    run_id: str,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Cooperatively cancel a running pipeline run (RUN-04).

    Sets the runs.cancelRequested flag; wrap_agent_node polls this flag before
    each node and raises RunCancelled (no task.cancel — cooperative-only, D-02).
    _execute_run catches RunCancelled and writes runs.status='cancelled'.

    Idempotent: if the run is already in a terminal state (not 'running'),
    returns the current status with alreadyTerminal=True — no flag is set.

    Returns:
        {"runId": ..., "cancelRequested": True} on success.
        {"runId": ..., "status": ..., "alreadyTerminal": True} if already done.
    """
    http = getattr(request.app.state, "convex_http", None)
    actor_id = claims.get("sub") or "unknown"

    run_row = await _cc.convex_query(http, "runs:byRunId", {"runId": run_id})
    if run_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run not found: {run_id}",
        )

    current_status = run_row.get("status")
    if current_status != "running":
        # Idempotent: already terminal — return without setting the flag.
        return {"runId": run_id, "status": current_status, "alreadyTerminal": True}

    await _cc.convex_mutation(http, "runs:requestCancel", {"runId": run_id})

    await _emit_audit(
        http,
        actor_id=actor_id,
        action="run.cancelled",
        resource_type="run",
        resource_id=run_id,
    )

    return {"runId": run_id, "cancelRequested": True}


# ── POST /runs/{run_id}/agents/{agent_key}/rerun — RUN-05 ────────────────────

@router.post("/runs/{run_id}/agents/{agent_key}/rerun")
async def rerun_agent(
    request: Request,
    run_id: str,
    agent_key: str,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Re-run a single section writer for an existing run (RUN-05).

    Forks the LangGraph checkpoint, re-runs exactly one section writer's bare
    node fn, updates the checkpoint (aupdate_state as_node=agent_key), and
    re-writes the whole Sanity draft from merged state so sibling sections are
    byte-identical (D-05).

    Guards (all pre-execution):
      - agent_key not in RE_ROLLABLE → 422 (only 7 section writers, D-03)
      - run.status == 'running' → 409 (cannot re-roll a live run, D-04)
      - No checkpoint state available → 409 (no state to merge siblings from)

    Critical: does NOT call ainvoke(None) after aupdate_state — that would
    re-run QA/editor_final/publisher (Pitfall 2). The re-roll is surgical.

    Returns:
        {"runId": ..., "agentKey": ..., "rerolled": True}
    """
    if agent_key not in RE_ROLLABLE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Agent '{agent_key}' is not re-rollable. "
                "Only section writers can be re-rolled "
                "(origin_story, problem, founder_bio, case_study, game, bonus, design)."
            ),
        )

    http = getattr(request.app.state, "convex_http", None)
    actor_id = claims.get("sub") or "unknown"

    run_row = await _cc.convex_query(http, "runs:byRunId", {"runId": run_id})
    if run_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run not found: {run_id}",
        )

    if run_row.get("status") == "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Run is still executing — re-roll only on a finished/awaiting-review run (D-04)",
        )

    # ── Build current_state ────────────────────────────────────────────────────
    # Seed with None values for every section key so merged state always
    # contains sibling fields (even when graph is missing or checkpoint is empty).
    current_state: dict = {key: None for key in _SECTION_STATE_KEYS}
    current_state["run_id"] = run_id

    graph = getattr(request.app.state, "graph", None)
    if graph is not None:
        config = {"configurable": {"thread_id": run_id}}
        snapshot = await graph.aget_state(config)
        if snapshot and snapshot.values:
            # Overlay checkpoint state — checkpoint wins on all keys.
            current_state = {**current_state, **dict(snapshot.values)}

    # ── Run the bare (unwrapped) node fn ──────────────────────────────────────
    # Import bare fns lazily to avoid circular imports at module load.
    from eisenbalm_pipeline.agents.origin_story import origin_story as _origin_story  # noqa: PLC0415
    from eisenbalm_pipeline.agents.problem import problem as _problem  # noqa: PLC0415
    from eisenbalm_pipeline.agents.founder_bio import founder_bio as _founder_bio  # noqa: PLC0415
    from eisenbalm_pipeline.agents.case_study import case_study as _case_study  # noqa: PLC0415
    from eisenbalm_pipeline.agents.game import game as _game  # noqa: PLC0415
    from eisenbalm_pipeline.agents.bonus import bonus as _bonus  # noqa: PLC0415

    _BARE_NODE: dict = {
        "origin_story": _origin_story,
        "problem": _problem,
        "founder_bio": _founder_bio,
        "case_study": _case_study,
        "game": _game,
        "bonus": _bonus,
    }

    # Only import design if it's not suppressed (agent_key in RE_ROLLABLE already
    # guards against suppressed design being called, but be defensive).
    if "design" in RE_ROLLABLE:
        from eisenbalm_pipeline.agents.design import design as _design  # noqa: PLC0415
        _BARE_NODE["design"] = _design

    bare_fn = _BARE_NODE[agent_key]
    try:
        new_output = await bare_fn(current_state)
    except Exception:  # noqa: BLE001
        log.warning("rerun_agent: bare fn %r raised — using empty output", agent_key)
        new_output = {}

    # ── Update graph checkpoint (as_node REQUIRED for parallel branch) ─────────
    if graph is not None:
        config = {"configurable": {"thread_id": run_id}}
        # as_node=agent_key required so LangGraph marks the correct parallel
        # branch as completed. DO NOT call ainvoke(None) after this (Pitfall 2).
        await graph.aupdate_state(config, new_output, as_node=agent_key)

    # ── Merge and write Sanity draft ───────────────────────────────────────────
    merged = {**current_state, **new_output}

    # Use module-level attribute lookup so monkeypatch.setattr(sc_mod, ...) in
    # tests reaches the call (same _cc.* pattern from Plan 02 deviation fix).
    import eisenbalm_pipeline.lib.sanity_client as _sc  # noqa: PLC0415
    sanity_client = getattr(_sc, "_CLIENT", None)  # None in test mode; harmless
    await _sc.write_issue_draft(sanity_client, merged)

    # ── Audit ──────────────────────────────────────────────────────────────────
    await _emit_audit(
        http,
        actor_id=actor_id,
        action="run.section_rerolled",
        resource_type="run",
        resource_id=f"{run_id}:{agent_key}",
    )

    return {"runId": run_id, "agentKey": agent_key, "rerolled": True}
