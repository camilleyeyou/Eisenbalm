"""Phase 34 (§34.3, D-01/D-05/D-06) — two-sign-off record endpoint.

One Clerk-JWT-guarded POST route:

  POST /issues/{run_id}/sign-off   body {kind: "facts-cleared" | "sounds-human"}

`facts-cleared` carries the machine-checkable prerequisites RELOCATED
verbatim from `review.py::publish_issue` / `schedule_issue` (D-04): all
claim checks must be signed off, and there must be no open (unresolved)
error-severity QA findings on a FACTUAL axis (voice-axis errors are excluded
— they belong to `sounds-human`, §36.7a). `sounds-human` is now
server-enforced (§36.7b, upgrading Phase 34 D-06's interim ungated
attestation now that voice IS machine-checkable, per Phase 36 D-12/D-14):
it 409s when any open error-severity finding carries a voice axis.

There is NO manual revoke endpoint — revocation happens ONLY via the D-08
auto-revoke-on-content-mutation path (§34.6, Plan 34-05). There is NO
override path (D-03) — a missing/ambiguous sign-off always resolves to
"not signed."
"""
from __future__ import annotations

import logging
import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.api.control import _emit_audit, _require_clerk_jwt_control

log = logging.getLogger(__name__)
router = APIRouter()

WORKSPACE_ID = "eisenbalm"

# §36.3/§36.7 — voice-axis findings gate "sounds-human"; everything else
# (including a missing/None axis, the conservative factual default) gates
# "facts-cleared". Keep in lockstep with docs/API_CONTRACTS.md §36.3.
VOICE_AXES = {"gravity", "sentiment", "irony-signaling", "machine-tell"}


# ── Request body model ──────────────────────────────────────────────────────


class _SignOffBody(BaseModel):
    kind: Literal["facts-cleared", "sounds-human"]


# ── POST /issues/{run_id}/sign-off ──────────────────────────────────────────


@router.post("/issues/{run_id}/sign-off")
async def record_sign_off(
    request: Request,
    run_id: str,
    body: _SignOffBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Record a facts-cleared or sounds-human sign-off for a run (§34.3).

    Guards (in order):
      1. run must exist → 404 if not
      2. `kind == "facts-cleared"` only:
         a. claimChecks:allSignedOff → 409 {reason:"claims_not_signed_off"}
         b. open error-severity findings on a FACTUAL axis (not in
            VOICE_AXES; anchor-blind, D-11b) →
            409 {reason:"open_error_findings", count:n}
      3. `kind == "sounds-human"` only (§36.7b):
         open error-severity findings on a VOICE axis (anchor-blind) →
            409 {reason:"open_voice_findings", count:n}

    Action:
      - signOffs:record({workspace_id, runId, kind, actorId})
      - auditLog:record action="signoff.recorded"

    Returns:
        {"runId": run_id, "kind": kind, "signedAt": <ms>}
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

    if body.kind == "facts-cleared":
        # 2a. Claims signoff gate — relocated verbatim from review.py (D-04).
        signoff = await _cc.convex_query(
            http, "claimChecks:allSignedOff", {"runId": run_id}
        ) or {}
        if not signoff.get("allSignedOff"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "reason": "claims_not_signed_off",
                    "message": (
                        "All claim checks must be signed off before "
                        "clearing facts."
                    ),
                },
            )

        # 2b. Open-error-findings gate — relocated verbatim from review.py
        # (D-04). Anchor-blind (D-11b): an orphaned error finding (whose
        # quotedSpan no longer resolves) still has no `resolution` and still
        # blocks — losing an anchor must never silently un-block.
        # §36.7a: NARROWED to exclude voice-axis findings — those belong to
        # `sounds-human` below, not `facts-cleared`. A missing/None axis is
        # NOT in VOICE_AXES, so it still blocks facts-cleared (the safe
        # factual default).
        findings = await _cc.convex_query(
            http, "qaCorrections:byRunId", {"runId": run_id}
        ) or []
        open_errors = [
            f for f in findings
            if f.get("severity") == "error"
            and not f.get("resolution")
            and f.get("axis") not in VOICE_AXES
        ]
        if open_errors:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "reason": "open_error_findings",
                    "message": (
                        f"{len(open_errors)} error finding(s) must be "
                        "accepted or dismissed before clearing facts."
                    ),
                    "count": len(open_errors),
                },
            )
    elif body.kind == "sounds-human":
        # §36.7b: server-enforced prerequisite (D-12/D-14) — upgrades Phase
        # 34 D-06's interim ungated attestation now that voice IS
        # machine-checkable. Anchor-blind exactly like facts-cleared's
        # D-11b guard: an orphaned voice-axis error finding still has no
        # `resolution` and still blocks.
        findings = await _cc.convex_query(
            http, "qaCorrections:byRunId", {"runId": run_id}
        ) or []
        open_voice_errors = [
            f for f in findings
            if f.get("severity") == "error"
            and not f.get("resolution")
            and f.get("axis") in VOICE_AXES
        ]
        if open_voice_errors:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "reason": "open_voice_findings",
                    "message": (
                        f"{len(open_voice_errors)} voice finding(s) must be "
                        "accepted or dismissed before signing sounds-human."
                    ),
                    "count": len(open_voice_errors),
                },
            )

    # Record the sign-off (upsert by (runId, kind) on the Convex side).
    await _cc.convex_mutation(
        http,
        "signOffs:record",
        {
            "workspace_id": WORKSPACE_ID,
            "runId": run_id,
            "kind": body.kind,
            "actorId": actor,
        },
    )

    # Audit log (non-blocking).
    await _emit_audit(
        http,
        actor_id=actor,
        action="signoff.recorded",
        resource_type="run",
        resource_id=f"{run_id}:{body.kind}",
    )

    return {
        "runId": run_id,
        "kind": body.kind,
        "signedAt": int(time.time() * 1000),
    }
