"""Phase 45 (REV-02/REV-03/REV-04/REV-05, docs/API_CONTRACTS.md §45) —
Passage-revision endpoint pair: the SINGLE generalization of §42.4a's FCT-06
preview/apply contract (``factcheck.py``'s ``evidence/preview`` +
``evidence/apply``) to arbitrary passage revision (D-01 — do NOT fork a
second endpoint pair).

  POST /issues/{run_id}/revise/preview
    body {sectionName, quotedText, blockIndexHint?, direction, customDirection?, priorProposals?[]}
    -> 200 {proposedText, whatChanged, claimDelta:{added[],removed[],altered[]}}
    -> 409 {reason:"cost_cap_exceeded", ...}                                  (REV-05)

  POST /issues/{run_id}/revise/apply
    body {ifRevisionID, sectionName, quotedText, blockIndexHint?, newText}
    -> 200 {revisionId, resolution:"revision_applied"}
    -> 409 {reason:"revision_mismatch"|"span_not_resolved"|"claim_edit_unavailable", ...}

``revise/preview`` is read-only (mirrors ``voice_pass.py::voice_rewrite`` and
``factcheck.py``'s ``evidence/preview`` exactly): NO Sanity write, NO Convex
mutation of issue content, NO audit row. It runs ONE parametrized house-voice
direction-chip prompt (D-04 — never a single bare undirected-rewrite action)
and returns ``{proposedText, whatChanged, claimDelta}``. It DOES record the LLM call's
own cost durably under the issue's REAL ``run_id`` with a FRESH, distinct
``agentKey`` (recording cost is not a content mutation, D-13) and 409s BEFORE
issuing the LLM call when the projected next call would exceed the per-issue
cost cap (REV-05, D-14).

``revise/apply`` is atomic + audited: delegates to the SAME shared apply core
(``content.py::_patch_prose_span``, extracted in Plan 45-02) that
``factcheck.py::_patch_claim_prose`` also calls (D-01) — span-resolve against
CURRENT Sanity content -> content-patch -> reset touched claims FIRST
(internal to ``_patch_prose_span``) -> revoke active sign-offs -> emit
exactly ONE ``passage_revised`` audit row (§45.4).
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

import eisenbalm_pipeline.lib.convex_client as _cc
import eisenbalm_pipeline.lib.sanity_client as _sc
from eisenbalm_pipeline.api.content import _patch_prose_span, _resolve_sanity_id
from eisenbalm_pipeline.api.control import (
    _emit_audit,
    _require_clerk_jwt_control,
    _revoke_active_signoffs,
)
from eisenbalm_pipeline.lib.agent_wrapper import _truncate
from eisenbalm_pipeline.lib.budget import would_exceed_run_cap
from eisenbalm_pipeline.lib.config_loader import load_run_config
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.sanity_client import get_issue_draft, patch_issue_field
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS

log = logging.getLogger(__name__)
router = APIRouter()

WORKSPACE_ID = "eisenbalm"


# ── §45.1 — direction-chip vocabulary (D-04/D-06/D-07) ──────────────────────

DirectionChip = Literal[
    "make_clearer",
    "make_more_specific",
    "tighten",
    "match_brief",
    "reduce_repetition",
    "try_another_approach",
    "custom",
]

_DIRECTION_CLAUSES: dict[str, str] = {
    "make_clearer": "Make this clearer — simplify sentence structure without losing precision.",
    "make_more_specific": "Make this more specific — add concrete, honestly-available detail.",
    "tighten": "Tighten this — cut words without losing meaning.",
    "reduce_repetition": "Reduce repetition — vary sentence rhythm and word choice from the surrounding prose.",
    # "match_brief" and "custom" are built dynamically below (not static
    # clauses). "try_another_approach" falls through to the generic default —
    # its actual divergence signal is the avoid_block built from
    # priorProposals, not a distinct clause.
}


def _build_directive(
    direction: str,
    *,
    custom_direction: Optional[str] = None,
    brief_context: str = "",
) -> str:
    """One parametrized house-voice directive per chip (§45.1, D-04/D-06/D-07).

    Every chip maps to an explicit clause — never a single undirected,
    unparametrized rewrite action. ``custom`` passes the operator's free
    text verbatim (D-06); ``match_brief`` degrades gracefully to the
    best-available ``brief_context`` (D-07, 45-RESEARCH Pitfall 5) rather
    than hard-depending on the not-yet-built Phase 47 Brief entity.
    """
    if direction == "custom":
        return (custom_direction or "").strip() or "Revise this passage."
    if direction == "match_brief":
        return (
            "Align this passage more closely with the story's voice and "
            f"premise: {brief_context}"
        )
    return _DIRECTION_CLAUSES.get(direction, "Revise this passage.")


# ── Request/response models ──────────────────────────────────────────────────


class _RevisionClaimDelta(BaseModel):
    added: list[str] = []
    removed: list[str] = []
    altered: list[str] = []


class _RevisionPick(BaseModel):
    proposedText: str
    whatChanged: str
    claimDelta: _RevisionClaimDelta


class _RevisePreviewBody(BaseModel):
    sectionName: str
    quotedText: str
    blockIndexHint: Optional[int] = None
    direction: DirectionChip
    customDirection: Optional[str] = None
    priorProposals: list[str] = []


class _ReviseApplyBody(BaseModel):
    ifRevisionID: str
    sectionName: str
    quotedText: str
    blockIndexHint: Optional[int] = None
    newText: str


# ── Best-effort "Match the brief" context (D-07, Pitfall 5) ─────────────────


async def _fetch_brief_context(
    convex_http: Any, sanity_http: Any, *, run_id: str, sanity_id: str
) -> str:
    """Best-effort "Match the brief" context (§45.1/§47.3, D-07).

    Phase 47 (BRF-05, §47.1) landed a real, console-editable Brief. Prefer
    reading its six fields from ``briefs:byRunId`` — the operator-edited
    source of truth — over the pre-Phase-47 degraded Sanity-proxy fallback
    this function used before the Brief entity existed. Falls back to that
    proxy (charity ``missionStatement``/``focusArea``/``scoutNotes`` +
    ``theme.visualDirection``) for legacy runs that predate the Brief, or on
    any Convex read failure/empty row. NEVER crashes: any failure degrades
    to "".
    """
    try:
        brief = await _cc.convex_query(
            convex_http, "briefs:byRunId", {"runId": run_id}
        )
    except Exception:  # noqa: BLE001 — best-effort only, never blocks preview
        log.warning(
            "_fetch_brief_context: briefs:byRunId failed for run_id=%s "
            "(falling back to the legacy Sanity proxy)",
            run_id,
        )
        brief = None

    if brief:
        parts: list[str] = []
        if brief.get("premise"):
            parts.append(f"premise: {brief['premise']}")
        if brief.get("centralClaim"):
            parts.append(f"central claim: {brief['centralClaim']}")
        if brief.get("readerEffect"):
            parts.append(f"reader effect: {brief['readerEffect']}")
        if brief.get("currentPeg"):
            parts.append(f"current peg: {brief['currentPeg']}")
        if brief.get("knownRisks"):
            parts.append(f"known risks: {brief['knownRisks']}")
        if brief.get("voiceIntention"):
            parts.append(f"voice intention: {brief['voiceIntention']}")
        if parts:
            return "; ".join(parts)

    # ── Legacy degraded fallback (pre-Phase-47 runs / empty Brief row) ─────
    try:
        rows = await _sc._groq(
            sanity_http,
            '*[_id == $id][0]{'
            '"visualDirection": theme.visualDirection, '
            '"missionStatement": charity->missionStatement, '
            '"focusArea": charity->focusArea, '
            '"whyOverlooked": charity->scoutNotes'
            "}",
            {"id": sanity_id},
        )
        row = rows[0] if rows else {}
    except Exception:  # noqa: BLE001 — best-effort only, never blocks preview
        log.warning(
            "_fetch_brief_context failed for sanity_id=%s (non-blocking)",
            sanity_id,
        )
        row = {}

    fallback_parts: list[str] = []
    if row.get("visualDirection"):
        fallback_parts.append(f"visual direction: {row['visualDirection']}")
    if row.get("missionStatement"):
        fallback_parts.append(f"charity mission: {row['missionStatement']}")
    if row.get("whyOverlooked"):
        fallback_parts.append(f"why this charity is overlooked: {row['whyOverlooked']}")
    if row.get("focusArea"):
        fallback_parts.append(f"focus area: {row['focusArea']}")
    return "; ".join(fallback_parts)


# ── POST /issues/{run_id}/revise/preview — §45.2/§45.3 ──────────────────────


@router.post("/issues/{run_id}/revise/preview")
async def preview_passage_revision(
    request: Request,
    run_id: str,
    body: _RevisePreviewBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Ask agent to revise — STEP 1 (§45.3).

    Read-only: mirrors ``voice_pass.py::voice_rewrite`` + ``factcheck.py``'s
    ``evidence/preview`` exactly — NO Sanity write, NO Convex mutation of
    issue content, NO audit row. DOES record the LLM call's own cost durably
    (recording cost is not a content mutation) and 409s BEFORE calling the
    LLM when the projected next call would exceed the per-issue cost cap
    (REV-05, D-14).
    """
    convex_http, sanity_http, sanity_id, _actor = await _resolve_sanity_id(
        request, run_id, claims
    )

    # ── Cost guard FIRST (§45.5) — before spending a single LLM call ────────
    cfg = await load_run_config(convex_http)
    over, info = await would_exceed_run_cap(
        convex_http,
        run_id=run_id,
        per_run_cap_usd=cfg.per_run_cap_usd,
        prior_revision_costs=[],
    )
    if over:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "cost_cap_exceeded",
                "message": (
                    "This issue's revision spend would exceed its cost cap."
                ),
                **info,
            },
        )

    brief_context = await _fetch_brief_context(
        convex_http, sanity_http, run_id=run_id, sanity_id=sanity_id
    )
    directive = _build_directive(
        body.direction,
        custom_direction=body.customDirection,
        brief_context=brief_context,
    )
    avoid_block = (
        "\n\nPrevious attempt(s) to avoid repeating:\n"
        + "\n".join(f"- {p}" for p in body.priorProposals)
        if body.priorProposals
        else ""
    )

    messages = [
        {
            "role": "system",
            "content": (
                f"{VOICE_CONSTRAINTS}\n\n"
                "Rewrite the QUOTED PASSAGE per the directive; keep Jesse's "
                "dry, precise, Fortune-500 register; no AI self-reference or "
                "hedging. Also report the claim delta (added/removed/"
                "altered) of factual assertions relative to the original."
            ),
        },
        {
            "role": "user",
            "content": (
                f"DIRECTIVE: {directive}\n"
                f"QUOTED PASSAGE: {body.quotedText}{avoid_block}"
            ),
        },
    ]

    pick, usage = await acomplete(
        agent_id="revision",
        run_id=run_id,
        messages=messages,
        response_format=_RevisionPick,
    )
    if hasattr(pick, "proposedText"):
        proposed_text = pick.proposedText
        what_changed = pick.whatChanged
        claim_delta: Any = pick.claimDelta
    elif isinstance(pick, dict):
        proposed_text = pick.get("proposedText", "")
        what_changed = pick.get("whatChanged", "")
        claim_delta = pick.get("claimDelta") or {}
    else:
        proposed_text = ""
        what_changed = ""
        claim_delta = {}

    if hasattr(claim_delta, "model_dump"):
        claim_delta = claim_delta.model_dump()
    elif not isinstance(claim_delta, dict):
        claim_delta = {"added": [], "removed": [], "altered": []}

    proposed_text = proposed_text or body.quotedText

    # ── Durable cost recording — REAL run_id, FRESH agentKey (D-13, Pitfall 2) ──
    await _cc.convex_mutation(
        convex_http,
        "agentRuns:completed",
        {
            "workspace_id": WORKSPACE_ID,
            "runId": run_id,
            "agentKey": f"revision-{uuid.uuid4().hex[:12]}",
            "completedAt": int(time.time() * 1000),
            "costUsd": usage.get("usd", 0.0),
            "durationMs": 0,
            "tokensIn": usage.get("tokens_in", 0),
            "tokensOut": usage.get("tokens_out", 0),
        },
    )

    return {
        "proposedText": proposed_text,
        "whatChanged": what_changed,
        "claimDelta": claim_delta,
    }


# ── POST /issues/{run_id}/revise/apply — §45.2/§45.4 ────────────────────────


@router.post("/issues/{run_id}/revise/apply")
async def apply_passage_revision(
    request: Request,
    run_id: str,
    body: _ReviseApplyBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Ask agent to revise — STEP 2 (§45.4).

    Atomic + audited: delegates to the SAME shared apply core
    (``content.py::_patch_prose_span``) both this endpoint and
    ``factcheck.py::_patch_claim_prose`` call (D-01) — span-resolve
    ``quotedText`` against CURRENT Sanity content -> content-patch the prose
    -> reset touched claims FIRST (internal to ``_patch_prose_span``) ->
    revoke active sign-offs -> emit exactly ONE ``passage_revised`` audit
    row. Passage revision has no claim-specific terminal status of its own,
    so no additional reset-first/terminal-last ordering concern applies here
    beyond what ``_patch_prose_span`` already does (45-RESEARCH Pitfall 4).

    Forwards THIS module's own ``get_issue_draft``/``patch_issue_field``
    bindings into the shared core (mirrors ``factcheck.py::_patch_claim_prose``,
    Plan 45-02's documented seam) so this file's own test suite's
    monkeypatches of ``revision.get_issue_draft``/``revision.patch_issue_field``
    are honored exactly as ``test_factcheck_endpoints.py``'s are.
    """
    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )

    new_rev = await _patch_prose_span(
        convex_http,
        sanity_http,
        sanity_id=sanity_id,
        run_id=run_id,
        section_name=body.sectionName,
        quoted_text=body.quotedText,
        block_index_hint=body.blockIndexHint,
        new_text=body.newText,
        if_revision_id=body.ifRevisionID,
        _get_issue_draft=get_issue_draft,
        _patch_issue_field=patch_issue_field,
    )

    await _revoke_active_signoffs(
        convex_http, run_id=run_id, reason="passage revised"
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="passage_revised",
        resource_type="passage",
        resource_id=f"{run_id}:{body.sectionName}",
        before=_truncate(
            json.dumps(
                {"sectionName": body.sectionName, "quotedText": body.quotedText},
                default=str,
            )
        ),
        after=_truncate(json.dumps({"newText": body.newText}, default=str)),
        run_id=run_id,
    )

    return {"revisionId": new_rev, "resolution": "revision_applied"}


__all__ = ["router"]
