"""Phase 26 (RVW-03) — Review-gate decision endpoints.

Three Clerk-JWT-guarded POST routes for the dispatch-control dashboard:
  POST /issues/{run_id}/publish   — approve + publish immediately
  POST /issues/{run_id}/schedule  — approve + schedule for future publish
  POST /issues/{run_id}/reject    — reject (run stays awaiting-review)

Security: Depends(_require_clerk_jwt_control) — dev-mode sentinel when
CLERK_JWT_ISSUER_DOMAIN is unset (same guard as api/control.py).

Every decision writes:
  - a reviewActions:record row (canonical action vocabulary §26.5)
  - an auditLog:record row via _emit_audit (non-blocking)

Publish + schedule both enforce the claims-signoff gate server-side
(claimChecks:allSignedOff → 409 when not all signed off — Pitfall 6).

The publish endpoint does NOT call _run_publisher directly.  It calls
_flip_sanity_published (lib/sanity_publish.py), which flips
weeklyIssue.status='published' and fires the existing Sanity webhook →
asyncio.create_task(_run_publisher(...)) chain (D-01).  The charities
registry upsert (D-03/REG-01) also happens inside _run_publisher, not here,
so it fires exactly once per publish whether triggered manually or via the
tick sweep.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.api.control import (
    _emit_audit,
    _require_clerk_jwt_control,
)
from eisenbalm_pipeline.lib.sanity_publish import _flip_sanity_published

log = logging.getLogger(__name__)
router = APIRouter()

WORKSPACE_ID = "eisenbalm"


# ── Request body models ────────────────────────────────────────────────────


class _ScheduleBody(BaseModel):
    scheduledAt: int  # Unix ms


class _RejectBody(BaseModel):
    note: Optional[str] = None


# ── POST /issues/{run_id}/publish ──────────────────────────────────────────


@router.post("/issues/{run_id}/publish")
async def publish_issue(
    request: Request,
    run_id: str,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Approve and publish a run immediately.

    Guards (in order):
      1. run must exist → 404 if not
      2. run.status == "awaiting-review" → 409 {reason:"wrong_status"} if not
      3. claimChecks:allSignedOff → 409 {reason:"claims_not_signed_off"} if pending
      4. pipelineRuns.sanityIssueId must be set → 409 {reason:"no_sanity_issue"}

    Action:
      - _flip_sanity_published → fires existing Sanity webhook → _run_publisher
        (PDF + Vercel deploy + pipelineRuns:updateStatus status="complete")
      - reviewActions:record action="approved_and_published"
      - auditLog:record action="run.approved_and_published"

    Returns:
        {"issueId": str, "published": true}
    """
    http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"

    # 1. Run lookup
    run = await _cc.convex_query(http, "pipelineRuns:byRunId", {"runId": run_id})
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run not found: {run_id}",
        )

    # 2. Status guard
    if run.get("status") != "awaiting-review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "wrong_status",
                "message": "This run cannot be published in its current state.",
            },
        )

    # 3. Claims signoff gate (Pitfall 6 — server-side guard, not just disabled button)
    signoff = await _cc.convex_query(
        http, "claimChecks:allSignedOff", {"runId": run_id}
    ) or {}
    if not signoff.get("allSignedOff"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "claims_not_signed_off",
                "message": "All claim checks must be signed off before publishing.",
            },
        )

    # 4. Sanity issue ID guard
    sanity_id = run.get("sanityIssueId")
    if not sanity_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "no_sanity_issue",
                "message": "No Sanity issue ID found for this run.",
            },
        )

    # Action: flip Sanity status → fires webhook → _run_publisher (D-01).
    # The Sanity http client is registered at the app level; for the flip we
    # use the shared sanity_http (base_url = *.api.sanity.io) not convex_http.
    sanity_http = getattr(request.app.state, "sanity_http", None)
    await _flip_sanity_published(sanity_http, sanity_id)

    # Record review action (non-critical — log on failure).
    try:
        await _cc.convex_mutation(
            http,
            "reviewActions:record",
            {
                "workspace_id": WORKSPACE_ID,
                "runId": run_id,
                "actorId": actor,
                "action": "approved_and_published",
            },
        )
    except Exception:  # noqa: BLE001
        log.warning("reviewActions:record failed for run=%s (non-critical)", run_id)

    # Audit log (non-blocking).
    await _emit_audit(
        http,
        actor_id=actor,
        action="run.approved_and_published",
        resource_type="run",
        resource_id=run_id,
    )

    return {"issueId": sanity_id, "published": True}


# ── POST /issues/{run_id}/schedule ─────────────────────────────────────────


@router.post("/issues/{run_id}/schedule")
async def schedule_issue(
    request: Request,
    run_id: str,
    body: _ScheduleBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Approve and schedule a run for future publish.

    Guards (in order):
      1. run must exist → 404 if not
      2. run.status == "awaiting-review" → 409 if not
      3. claimChecks:allSignedOff → 409 {reason:"claims_not_signed_off"} if pending
      4. pipelineRuns.sanityIssueId must be set → 409 {reason:"no_sanity_issue"}
      5. scheduledAt > now → 400 {reason:"schedule_in_past"} if not

    Action:
      - runs:setScheduledPublish({runId, scheduledPublishAt})
      - reviewActions:record action="approved_and_scheduled"
      - auditLog:record action="run.approved_and_scheduled"

    The existing Phase 25 tick sweep (pipeline_tick) checks
    runs:dueForPublish each tick and fires _flip_sanity_published for any
    due scheduled runs (D-02) — no new scheduler needed.

    Returns:
        {"issueId": str, "scheduledAt": int}
    """
    http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"
    now_ms = int(time.time() * 1000)

    # 1. Run lookup
    run = await _cc.convex_query(http, "pipelineRuns:byRunId", {"runId": run_id})
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run not found: {run_id}",
        )

    # 2. Status guard
    if run.get("status") != "awaiting-review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "wrong_status",
                "message": "This run cannot be scheduled in its current state.",
            },
        )

    # 3. Claims signoff gate
    signoff = await _cc.convex_query(
        http, "claimChecks:allSignedOff", {"runId": run_id}
    ) or {}
    if not signoff.get("allSignedOff"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "claims_not_signed_off",
                "message": "All claim checks must be signed off before scheduling.",
            },
        )

    # 4. Sanity issue ID guard
    sanity_id = run.get("sanityIssueId")
    if not sanity_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "no_sanity_issue",
                "message": "No Sanity issue ID found for this run.",
            },
        )

    # 5. Future timestamp guard
    if body.scheduledAt <= now_ms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "reason": "schedule_in_past",
                "message": "Choose a time in the future.",
            },
        )

    # Action: write scheduledPublishAt to Convex runs table.
    await _cc.convex_mutation(
        http,
        "runs:setScheduledPublish",
        {"runId": run_id, "scheduledPublishAt": body.scheduledAt},
    )

    # Record review action.
    try:
        await _cc.convex_mutation(
            http,
            "reviewActions:record",
            {
                "workspace_id": WORKSPACE_ID,
                "runId": run_id,
                "actorId": actor,
                "action": "approved_and_scheduled",
                "note": f"scheduledAt={body.scheduledAt}",
            },
        )
    except Exception:  # noqa: BLE001
        log.warning("reviewActions:record failed for run=%s (non-critical)", run_id)

    # Audit log (non-blocking).
    await _emit_audit(
        http,
        actor_id=actor,
        action="run.approved_and_scheduled",
        resource_type="run",
        resource_id=run_id,
    )

    return {"issueId": sanity_id, "scheduledAt": body.scheduledAt}


# ── POST /issues/{run_id}/reject ───────────────────────────────────────────


@router.post("/issues/{run_id}/reject")
async def reject_issue(
    request: Request,
    run_id: str,
    body: _RejectBody = None,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Reject a run — no status change; the run stays in awaiting-review.

    No claims gate required — reject is always allowed while awaiting-review
    so operators can un-stick a run that has stale claims.

    Action:
      - reviewActions:record action="rejected", note=body.note
      - auditLog:record action="run.rejected"
      - run.status UNCHANGED

    Returns:
        {"issueId": str, "rejected": true}
    """
    http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"

    # Run lookup (needed to return issueId; reject is non-blocking on failure).
    run = await _cc.convex_query(http, "pipelineRuns:byRunId", {"runId": run_id})
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run not found: {run_id}",
        )

    note = (body.note if body else None)

    # Record review action.
    try:
        record_args: dict = {
            "workspace_id": WORKSPACE_ID,
            "runId": run_id,
            "actorId": actor,
            "action": "rejected",
        }
        if note:
            record_args["note"] = note
        await _cc.convex_mutation(http, "reviewActions:record", record_args)
    except Exception:  # noqa: BLE001
        log.warning("reviewActions:record failed for run=%s (non-critical)", run_id)

    # Audit log (non-blocking).
    await _emit_audit(
        http,
        actor_id=actor,
        action="run.rejected",
        resource_type="run",
        resource_id=run_id,
    )

    sanity_id = run.get("sanityIssueId")
    return {"issueId": sanity_id, "rejected": True}
