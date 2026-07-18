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

import asyncio
import json
import logging
import os
import time
from typing import Any, Optional

from eisenbalm_pipeline.lib.budget import would_exceed_monthly_cap
from eisenbalm_pipeline.lib.cost import emit_monthly_alert

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.api.auth import _deployed
from eisenbalm_pipeline.api.runs import (
    ResumeSelection,
    RunWeeklyBody,
    _require_graph,
    _require_trigger_secret,
    _resume_paused_run,
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


# ── Role authorization dependency (Phase 49, ROL-01/ROL-02, §49.4) ────────


async def _require_editor(claims: dict = Depends(_require_clerk_jwt_control)) -> dict:
    """Authorization (not authentication) layered on _require_clerk_jwt_control.
    Local-dev sentinel resolves to Editor-in-chief (D-04) so header-free tests pass.
    A real deployed identity must carry role == 'Editor-in-chief'."""
    if claims.get("sub") == "local-dev-operator":
        return claims
    if claims.get("role") != "Editor-in-chief":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"reason": "forbidden_role", "message": "Editor-in-chief only."},
        )
    return claims


# ── Shared audit helper ────────────────────────────────────────────────────

async def _emit_audit(
    http: Any,
    *,
    actor_id: str,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    before: str | None = None,
    after: str | None = None,
    # ── Phase 43 (§43.2, D-11) — additive decision kwargs ──
    reason: str | None = None,
    issue_number: int | None = None,
    run_id: str | None = None,
    instruction_version: str | None = None,
) -> None:
    """Write one audit_log row via the public auditLog:record Convex mutation.

    Non-blocking: if the write fails, logs a warning but does NOT raise
    (audit failure must never block a run trigger).

    Phase 31 (D-09): `before` / `after` are optional truncated snapshot
    strings (content-patch endpoints pass these; every pre-existing caller
    omits them, so this extension is purely additive/back-compatible).

    Phase 43 (§43.2, D-11): `reason` / `issue_number` / `run_id` /
    `instruction_version` are additive-optional decision kwargs, forwarded
    into the auditLog:record args dict only when non-None — mirrors the
    before/after pattern above. Every pre-existing caller omits these, so
    this extension is purely additive/back-compatible.
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
    if before is not None:
        args["before"] = before
    if after is not None:
        args["after"] = after
    if reason is not None:
        args["reason"] = reason
    if issue_number is not None:
        args["issueNumber"] = issue_number
    if run_id is not None:
        args["runId"] = run_id
    if instruction_version is not None:
        args["instructionVersion"] = instruction_version
    try:
        await _cc.convex_mutation(http, "auditLog:record", args)
    except Exception:  # noqa: BLE001
        log.warning(
            "Audit write failed (non-blocking): action=%r actor=%r resource=%r",
            action, actor_id, resource_id,
        )


# ── Shared sign-off revocation helper ──────────────────────────────────────

async def _revoke_active_signoffs(http: Any, *, run_id: str, reason: str) -> None:
    """Phase 34 (§34.6, D-08) — auto-revoke both sign-off kinds when the issue's
    content changes. Fail-open (mirrors _emit_audit): a revoke failure must NOT
    block the content save the operator is actively doing. The rail (subscribed
    to signOffs:activeByRunId) goes red live; Andrew re-signs after review."""
    try:
        await _cc.convex_mutation(http, "signOffs:revokeAll", {"runId": run_id, "reason": reason})
    except Exception:  # noqa: BLE001
        log.warning("signOffs:revokeAll failed for run=%s (non-blocking)", run_id)


# ── Shared start-gate helper (D-15) ────────────────────────────────────────
#
# Extracted from pipeline_run's inline gate block so /pipeline/run and the
# new /pipeline/run/brief endpoint (Plan 48-04) share ONE copy of the
# one-at-a-time + budget start-gate logic — no drift between two
# independently-maintained 409 checks. Byte-equivalent to the block it
# replaces: same checks, same 409 detail strings, same order.
# pipeline_tick is NOT refactored to use this helper — it has an extra
# scheduled-publish sweep + skip-not-raise semantics (see pipeline_tick's own
# docstring), so its inline gates are intentionally left as-is.


async def _enforce_start_gates(http: Any) -> None:
    """One-at-a-time (D-12) + budget (RUN-06) start gates. Raises 409 on
    either violation; returns None (no side effect) when both pass."""
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

    await _enforce_start_gates(http)

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


# ── POST /pipeline/run/brief (Phase 48, ENT-02/ENT-04, §48.2) ──────────────


class OrganizationInput(BaseModel):
    name: str
    website: Optional[str] = None
    charityNavigatorUrl: Optional[str] = None
    guidestarUrl: Optional[str] = None


class BriefRunBody(BaseModel):
    issueNumber: Optional[int] = None
    premise: str
    peg: str
    organization: OrganizationInput
    sourceMaterial: Optional[str] = None


@router.post("/pipeline/run/brief")
async def pipeline_run_brief(
    request: Request,
    body: BriefRunBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Brief-entry trigger (ENT-02). Clerk JWT auth; records operator identity.

    Operator supplies premise, peg, organization (+ optional source
    material) instead of letting the pipeline discover a charity. The run
    skips Signal Editor/Scout/Advocate/Gate 1 and enters at the Researcher
    (graph fork, Plan 48-03); the human org is still run through
    verify_candidates so its verification record is never absent (ENT-04).

    Reuses the SAME one-at-a-time (D-12) + budget (RUN-06) start gates
    /pipeline/run enforces, via the shared _enforce_start_gates helper
    (D-15) — no independent copy of that logic.

    422s when organization.name is empty/whitespace-only.

    Returns:
        {"runId": "<run_id>"}
    """
    if not body.organization.name.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="organization.name is required",
        )

    operator_id = claims.get("sub")
    http = getattr(request.app.state, "convex_http", None)

    await _enforce_start_gates(http)

    # Human-supplied org as a synthetic CharityCandidate (D-04/D-05) — copies
    # editor.py's D-14 all-candidates-killed synthetic-winner shape: every
    # field present, empty/None where there is no scouted/scored data.
    winning_charity: dict = {
        "name": body.organization.name,
        "location": "",
        "website": body.organization.website or "",
        "charityNavigatorUrl": body.organization.charityNavigatorUrl,
        "guidestarUrl": body.organization.guidestarUrl,
        "foundingYear": None,
        "assetRange": "",
        "focusArea": "",
        "missionStatement": "",
        "scoutSummary": "",
        "whyOverlooked": "",
        "advocateArgument": None,
        "advocateScore": None,
    }

    # The 6-field Brief (D-06/D-08): premise/peg map directly; the remaining
    # four fields start BLANK (voiceIntention included — calibrator hasn't
    # run yet, so style_brief doesn't exist at request time, D-08). The
    # operator fills/sharpens these via the shipped BRF-06 strengthen once
    # Stage 1 loads.
    brief: dict = {
        "premise": body.premise,
        "currentPeg": body.peg,
        "centralClaim": "",
        "readerEffect": "",
        "knownRisks": "",
        "voiceIntention": "",
    }

    # Reduced agentRuns:queueForRun set (D-16) — excludes signal_editor,
    # scout, advocate, editor_gate_1, chronicler (the nodes the brief branch
    # never executes).
    BRIEF_AGENT_KEYS = [
        "calibrator",
        "verify_candidates",
        "researcher",
        "verify_research",
        *SECTION_WRITERS,
        "validate_sections",
        "qa",
        "editor_final",
        "publisher",
    ]

    run_id = await _start_run(
        request.app,
        issue_number=body.issueNumber,
        trigger_source="manual",
        triggered_by=operator_id,
        entry_mode="brief",
        winning_charity=winning_charity,
        brief=brief,
        source_material=body.sourceMaterial,
        agent_keys_override=BRIEF_AGENT_KEYS,
    )

    # Emit audit row (non-blocking on failure) — mirrors pipeline_run's
    # run.triggered audit, marked with an entry_mode indicator.
    await _emit_audit(
        http,
        actor_id=operator_id or "unknown",
        action="run.triggered",
        resource_type="run",
        resource_id=run_id,
        after=json.dumps(
            {"entryMode": "brief", "organization": body.organization.name}
        ),
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

    # Phase 34 (D-08): re-rolling a section changes content — void both sign-offs.
    await _revoke_active_signoffs(http, run_id=run_id, reason="section re-rolled")

    return {"runId": run_id, "agentKey": agent_key, "rerolled": True}


# ── POST /issues/{run_id}/adjudicate — SIG-03, D-12/D-13 ─────────────────────

class AdjudicateBody(BaseModel):
    selection: ResumeSelection
    reason: str


@router.post("/issues/{run_id}/adjudicate")
async def adjudicate(
    request: Request,
    run_id: str,
    body: AdjudicateBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Clerk-guarded Gate-1 adjudication bridge (SIG-03).

    The Signal Desk dashboard is Clerk-guarded, but the existing
    POST /run/{run_id}/resume is guarded by the server-to-server trigger
    secret (cron/CLI only) and has no `reason` field — the browser must
    NEVER see that secret (D-13). This endpoint:

      1. Pre-checks the graph's checkpoint state so a non-paused run 409s
         with ZERO side effects (no audit, no resume attempt).
      2. Audit-logs the operator's pick + reason via _emit_audit ("nothing
         silent") BEFORE the resume is scheduled — `reason` is logged via
         audit_log ONLY. The deliberationEvents.eventType union stays
         FROZEN (no new literal is added, D-13).
      3. Invokes _resume_paused_run (the SAME resume implementation
         resume_run uses, api/runs.py) server-side with the chosen
         charityName — there is exactly one resume implementation.

    The operator never handles PIPELINE_TRIGGER_SECRET.
    """
    http = getattr(request.app.state, "convex_http", None)
    actor_id = claims.get("sub") or "unknown"

    # Pre-check paused state BEFORE any audit/resume side effect (D-13:
    # a non-paused run must 409 with nothing logged).
    graph = _require_graph(request)
    config = {"configurable": {"thread_id": run_id}}
    state = await graph.aget_state(config)
    if not state or not state.next:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Run {run_id} is not paused (state.next is empty)",
        )

    # Audit BEFORE resume ("nothing silent") — pick + reason logged via
    # audit_log ONLY (deliberationEvents.eventType union stays FROZEN).
    await _emit_audit(
        http,
        actor_id=actor_id,
        action="gate1.adjudicate",
        resource_type="run",
        resource_id=run_id,
        after=json.dumps(
            {"charityName": body.selection.charityName, "reason": body.reason}
        ),
    )

    return await _resume_paused_run(request.app, run_id, body.selection.charityName)


# ── POST /issues/{run_id}/publish-manual — WBN-03, D-11/D-12 ─────────────────
#
# docs/API_CONTRACTS.md §50.1 (contract-first). The Clerk-guarded operator
# sibling of the server-to-server POST /run/{run_id}/publish (manual_publish,
# WHK-08, api/runs.py) — SAME _run_publisher work, gated by _require_editor
# (Clerk, Editor-in-chief only) instead of _require_trigger_secret. This is
# the third of 11 §7 Run Details steps (RESEARCH Pitfall 1) with a real
# "Restart from this step" reuse primitive — writers (rerun_agent, §3B.4) and
# the Gate-1 pause (adjudicate above) are the other two. The operator NEVER
# handles PIPELINE_TRIGGER_SECRET.


@router.post("/issues/{run_id}/publish-manual")
async def publish_manual(
    request: Request,
    run_id: str,
    claims: dict = Depends(_require_editor),
) -> dict:
    """Editor-in-chief Publisher-restart bridge (WBN-03, docs/API_CONTRACTS.md §50.1).

    Re-invokes the SAME `_run_publisher` coroutine the Sanity webhook and the
    trigger-secret-guarded `manual_publish` (WHK-08) both call — there is
    exactly one Publisher implementation. Because `_run_publisher` re-renders
    directly against the already-written Sanity draft (no LangGraph
    checkpoint state needed), this genuinely reuses all upstream pipeline
    work — the honest basis for the recovery rail's "completed steps are
    reused, not re-paid" copy on the `publisher` step (D-11/D-12).

    Gated by `_require_editor` (not the weaker `_require_clerk_jwt_control`
    `adjudicate` uses above) — Publisher is irreversible real work (PDF +
    Vercel deploy + Sanity publish), matching the other five Editor-in-chief-
    only actions in §49.4, not merely "any authenticated operator."
    """
    http = getattr(request.app.state, "convex_http", None)
    actor_id = claims.get("sub") or "unknown"

    # Local imports mirror manual_publish's own lazy-import pattern
    # (api/runs.py) — avoids circular imports at module load.
    from eisenbalm_pipeline.agents.publisher import (  # noqa: PLC0415
        QUERY_ISSUE_BY_RUN_ID,
        _run_publisher,
    )
    from eisenbalm_pipeline.lib.sanity_client import groq_query  # noqa: PLC0415

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

    # Two-sign-off gate (mirrors review.py:118-133, publish_issue) — closes
    # the ungated bridge Q1b of the finish-phase-34-retirement audit found:
    # this recovery path must never publish content nobody re-attested to.
    # Sits AFTER the 404 (a nonexistent issue still 404s) and BEFORE the
    # audit + _run_publisher schedule ("nothing silent" — a blocked publish
    # is neither audited as a restart nor scheduled).
    active = await _cc.convex_query(
        http, "signOffs:activeByRunId", {"runId": run_id}
    ) or {}
    missing = [k for k in ("facts-cleared", "sounds-human") if k not in active]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "missing_signoffs",
                "message": (
                    "Both sign-offs (Facts cleared + Sounds human) are "
                    "required before publishing."
                ),
                "missing": missing,
            },
        )

    # Audit BEFORE scheduling the publisher task ("nothing silent").
    await _emit_audit(
        http,
        actor_id=actor_id,
        action="publisher.manual_restart",
        resource_type="run",
        resource_id=run_id,
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
