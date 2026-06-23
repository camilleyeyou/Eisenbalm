"""Phase 25 (RUN-01/RUN-02/RUN-03) — Run-control endpoints for the dashboard.

Two routes:
  - POST /pipeline/run   — Clerk-JWT-authed manual trigger (operator-attributed)
  - POST /pipeline/tick  — Trigger-secret-authed cron tick (kill-switch-gated)

Distinct from the legacy /run/weekly (trigger-secret, no operator attribution).
Both routes delegate to the shared _start_run helper in api/runs.py so the
CFG-04 launch ordering is maintained in one place.

Security model:
  /pipeline/run  → require_clerk_jwt (Depends) — operator identity from JWT sub
  /pipeline/tick → _require_trigger_secret — Railway cron, no Clerk session

Audit model:
  /pipeline/run  → emits auditLog:record with action="run.triggered"
  /pipeline/tick → emits auditLog:record with actorId="cron" on fire
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.api.runs import (
    RunWeeklyBody,
    _require_trigger_secret,
    _start_run,
)
from eisenbalm_pipeline.lib.scheduler import _is_due, compute_next_run_at

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

    # Budget start-gate inserted by Plan 04 (RUN-06) here

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

    # Budget start-gate inserted by Plan 04 (RUN-06) here

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

    # ── STEP 2: Cadence gate ───────────────────────────────────────────────
    now_ms = int(time.time() * 1000)
    if not _is_due(pc, now_ms):
        return {"status": "skipped", "reason": "not_due"}

    # ── STEP 3: One-at-a-time ──────────────────────────────────────────────
    latest = await _cc.convex_query(http, "runs:latest", {"workspace_id": WORKSPACE_ID})
    if latest and latest.get("status") == "running":
        return {"status": "skipped", "reason": "run_in_progress"}

    # ── STEP 4: Budget start-gate (Plan 04 seam) ──────────────────────────
    # Budget start-gate inserted by Plan 04 (RUN-06) here
    # (returns {"status":"skipped","reason":"budget_projection_exceeds_cap"} when over)

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

    return {"status": "triggered", "runId": run_id}
