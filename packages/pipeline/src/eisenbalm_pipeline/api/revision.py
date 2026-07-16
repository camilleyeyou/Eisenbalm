"""Phase 45 (REV-02/REV-03/REV-05, docs/API_CONTRACTS.md §45) — Passage-
revision endpoint pair: the SINGLE generalization of §42.4a's FCT-06
preview/apply contract (``factcheck.py``'s ``evidence/preview`` +
``evidence/apply``) to arbitrary passage revision (D-01 — do NOT fork a
second endpoint pair).

  POST /issues/{run_id}/revise/preview
    body {sectionName, quotedText, blockIndexHint?, direction, customDirection?, priorProposals?[]}
    -> 200 {proposedText, whatChanged, claimDelta:{added[],removed[],altered[]}}
    -> 409 {reason:"cost_cap_exceeded", ...}                                  (REV-05)

``revise/preview`` is read-only (mirrors ``voice_pass.py::voice_rewrite`` and
``factcheck.py``'s ``evidence/preview`` exactly): NO Sanity write, NO Convex
mutation of issue content, NO audit row. It runs ONE parametrized house-voice
direction-chip prompt (D-04 — never a single bare undirected-rewrite action)
and returns ``{proposedText, whatChanged, claimDelta}``. It DOES record the LLM call's
own cost durably under the issue's REAL ``run_id`` with a FRESH, distinct
``agentKey`` (recording cost is not a content mutation, D-13) and 409s BEFORE
issuing the LLM call when the projected next call would exceed the per-issue
cost cap (REV-05, D-14).

Plan 45-03 Task 2 adds ``revise/apply`` (atomic + audited) to this same
module and mounts the router in ``api/main.py``.
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

import eisenbalm_pipeline.lib.convex_client as _cc
import eisenbalm_pipeline.lib.sanity_client as _sc
from eisenbalm_pipeline.api.content import _resolve_sanity_id
from eisenbalm_pipeline.api.control import _require_clerk_jwt_control
from eisenbalm_pipeline.lib.budget import would_exceed_run_cap
from eisenbalm_pipeline.lib.config_loader import load_run_config
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.sanity_client import get_issue_draft, patch_issue_field  # noqa: F401 — Task 2 (apply) forwards these into _patch_prose_span
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


# ── Best-effort "Match the brief" context (D-07, Pitfall 5) ─────────────────


async def _fetch_brief_context(sanity_http: Any, sanity_id: str) -> str:
    """Best-effort degraded "Match the brief" context (§45.1, D-07).

    ``style_brief`` itself is an ephemeral LangGraph-only value with no
    durable Sanity/Convex row to read back at review time EXCEPT the one
    field the DesignAgent carries forward verbatim onto
    ``theme.visualDirection``. This combines that with the winning charity's
    ``missionStatement``/``focusArea``/``scoutNotes`` (the closest existing
    proxy for "why this charity is overlooked" — no Phase 47 Brief entity
    exists yet). NEVER crashes: any failure degrades to "".
    """
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

    parts: list[str] = []
    if row.get("visualDirection"):
        parts.append(f"visual direction: {row['visualDirection']}")
    if row.get("missionStatement"):
        parts.append(f"charity mission: {row['missionStatement']}")
    if row.get("whyOverlooked"):
        parts.append(f"why this charity is overlooked: {row['whyOverlooked']}")
    if row.get("focusArea"):
        parts.append(f"focus area: {row['focusArea']}")
    return "; ".join(parts)


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

    brief_context = await _fetch_brief_context(sanity_http, sanity_id)
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


__all__ = ["router"]
