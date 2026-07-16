"""Phase 47 (BRF-02, docs/API_CONTRACTS.md §47.5) — Story lead Require/Remove
action endpoints.

  POST /issues/{run_id}/leads/{lead_id}/require   body {}        -> 200 {leadId, status:'required'}
  POST /issues/{run_id}/leads/{lead_id}/remove     body {reason}  -> 200 {leadId, status:'removed'}  (422 if reason empty)

Mirrors ``factcheck.py::keep_claim``/``delete_claim`` EXACTLY (47-RESEARCH.md
Pattern 3, CONTEXT D-05): both actions call the pipeline-secret-guarded
``storyLeads:setStatus`` mutation (landed in Plan 47-01) and are routed
through this Clerk-guarded boundary rather than a bare dashboard Convex
mutation.

Require (no reason) is FastAPI-routed for CONSISTENCY with Remove, but stays
OUT of the shared Decision log on purpose: no ``reason=`` kwarg is passed to
``_emit_audit`` and no ``reason``/``heldReason`` key appears in its
after-JSON, so ``auditLog.ts::isDecisionRow`` does not select it — "Require"
is a routine status flip, not a decision.

Remove is reason-mandatory (422 on empty), and its ``_emit_audit`` call
passes the structured ``reason=``/``run_id=`` kwargs (mirrors
``keep_claim``) so it DOES surface in the shared Decision log —
"nothing silent."
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.api.control import _emit_audit, _require_clerk_jwt_control
from eisenbalm_pipeline.lib.agent_wrapper import _truncate

log = logging.getLogger(__name__)
router = APIRouter()


# ── Request body models ────────────────────────────────────────────────────


class _RemoveBody(BaseModel):
    reason: str


# ── Shared helpers ──────────────────────────────────────────────────────────


async def _load_lead(convex_http, run_id: str, lead_id: str) -> dict:
    """Load one story_leads row by (runId, leadId). 404 when absent.

    §47.4 declares only ``storyLeads:byRunId``/``insert``/``setStatus`` — no
    dedicated by-id query — so this filters the run's leads client-side
    (a handful of leads per run, the same scale ``CandidateSlate``'s own
    join helpers accept for equivalent lookups).
    """
    leads = (
        await _cc.convex_query(convex_http, "storyLeads:byRunId", {"runId": run_id}) or []
    )
    for lead in leads:
        if lead.get("_id") == lead_id:
            return lead
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Lead not found for run {run_id}: {lead_id}",
    )


def _lead_snapshot(lead: dict) -> str:
    """Truncated JSON before/after audit snapshot of a story_leads row."""
    return _truncate(
        json.dumps(
            {"premise": lead.get("premise"), "status": lead.get("status")},
            default=str,
        )
    )


# ── POST /issues/{run_id}/leads/{lead_id}/require — BRF-02 ─────────────────


@router.post("/issues/{run_id}/leads/{lead_id}/require")
async def require_lead(
    request: Request,
    run_id: str,
    lead_id: str,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Require this lead (BRF-02) — no reason. FastAPI-routed for
    consistency with Remove; stays OUT of the shared Decision log on
    purpose (module docstring)."""
    convex_http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"

    lead = await _load_lead(convex_http, run_id, lead_id)

    await _cc.convex_mutation(
        convex_http,
        "storyLeads:setStatus",
        {"leadId": lead_id, "status": "required"},
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="lead_required",
        resource_type="story_lead",
        resource_id=f"{run_id}:{lead_id}",
        before=_lead_snapshot(lead),
        after=_truncate(json.dumps({"status": "required"}, default=str)),
    )

    return {"leadId": lead_id, "status": "required"}


# ── POST /issues/{run_id}/leads/{lead_id}/remove — BRF-02 ──────────────────


@router.post("/issues/{run_id}/leads/{lead_id}/remove")
async def remove_lead(
    request: Request,
    run_id: str,
    lead_id: str,
    body: _RemoveBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Remove — add reason (BRF-02): reason mandatory (422 if empty), writes
    an audit_log row + a Decision-log entry via the structured
    ``reason=``/``run_id=`` kwargs (mirrors ``factcheck.py::keep_claim``
    exactly)."""
    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "reason": "empty_reason",
                "message": "A reason is required to remove this lead.",
            },
        )

    convex_http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"

    lead = await _load_lead(convex_http, run_id, lead_id)

    await _cc.convex_mutation(
        convex_http,
        "storyLeads:setStatus",
        {"leadId": lead_id, "status": "removed"},
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="lead_removed",
        resource_type="story_lead",
        resource_id=f"{run_id}:{lead_id}",
        before=_lead_snapshot(lead),
        after=_truncate(
            json.dumps({"status": "removed", "reason": reason}, default=str)
        ),
        reason=reason,
        run_id=run_id,
    )

    return {"leadId": lead_id, "status": "removed"}


__all__ = ["router"]
