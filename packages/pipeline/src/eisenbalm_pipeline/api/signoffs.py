"""Phase 34 (§34.3, D-01/D-05/D-06) — sign-off record endpoint.

Quick 261021-7aw: sign-offs are now OPTIONAL attestations. Nothing requires
them — the open-findings / claims prerequisites that used to 409 here are
removed (agents self-fix; see agents/qa/self_fix.py). Only run existence,
no_sanity_issue, and (sounds-human) role + run_not_reviewable still apply.

Historical (pre-261021-7aw) description follows.

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

# Quick 261021-7aw: VOICE_AXES moved to agents/qa/self_fix.py (agents now
# rewrite voice tells themselves); re-exported for existing importers.
from eisenbalm_pipeline.agents.qa.self_fix import VOICE_AXES  # noqa: E402,F401


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
      2. `kind == "sounds-human"` only:
         a. role gate (§49.4) → 403 {reason:"forbidden_role"}
         b. quick 260723-4a6 (§37.4(c)): run paused at Gate 1 (awaiting-review
            with no completedAt) or failed → 409 {reason:"run_not_reviewable"}

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

    # quick 260719-w6o (F5) — a run with no Sanity issue has produced no
    # reviewable content: it failed early, or paused at Gate 1 before any
    # draft was written (editor.py:378-398 / 526-538). No sign-off can
    # attest content that does not exist. ONE guard covers BOTH the failed
    # and Gate-1-paused shapes without enumerating status values, closing
    # the same class as quick 260718-51o at the source. A genuinely
    # reviewable run always carries sanityIssueId (written at draft time —
    # content.py's edit routes already require it), so this never over-gates.
    sanity_id = run.get("sanityIssueId")
    if not sanity_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "no_sanity_issue",
                "message": "This run has produced no reviewable content to sign off.",
            },
        )

    if body.kind == "sounds-human":
        # Phase 49 (ROL-01/ROL-02, §49.4, D-06) — role gate, IN-HANDLER
        # branch (not a route Depends swap, since this route also handles
        # kind=="facts-cleared", which stays ungated — RESEARCH Open Q2).
        # Local-dev sentinel still resolves to Editor-in-chief (D-04).
        if (
            claims.get("sub") != "local-dev-operator"
            and claims.get("role") != "Editor-in-chief"
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"reason": "forbidden_role", "message": "Editor-in-chief only."},
            )

        # quick 260723-4a6 (§37.4(c)) — a run paused at Gate 1 (awaiting-review
        # with no completedAt — editor.py writes awaiting-review WITHOUT
        # completedAt) or a failed run has no reviewable final draft to
        # attest. A genuine final-review run (publisher writes awaiting-review
        # WITH completedAt) is unaffected. Named `run_status` (not `status`)
        # to avoid shadowing the imported fastapi `status` module used below.
        run_status = run.get("status")
        completed_at = run.get("completedAt")
        if run_status == "failed" or (run_status == "awaiting-review" and not completed_at):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "reason": "run_not_reviewable",
                    "message": "This run is not in a reviewable state to sign off.",
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
