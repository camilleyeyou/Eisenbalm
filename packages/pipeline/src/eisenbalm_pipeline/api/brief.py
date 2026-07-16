"""Phase 47 (BRF-05/BRF-06, docs/API_CONTRACTS.md §47.5) — Brief edit +
field-strengthen endpoints.

  PATCH /issues/{run_id}/brief                              body {field, value}    -> 200 {resolution:'brief_field_edited'}
  POST  /issues/{run_id}/brief/{field}/strengthen/preview    body {currentValue}    -> 200 {proposedText, whatChanged}
  POST  /issues/{run_id}/brief/{field}/strengthen/apply      body {newText}         -> 200 {resolution:'brief_field_strengthened'}

``field`` is one of premise|currentPeg|centralClaim|readerEffect|knownRisks|
voiceIntention — every other value 422s (§47).

**PATCH /brief** (BRF-05, D-12) is the guarded content boundary for direct
console edits from ``BriefFieldTable``: Clerk-guarded -> ``briefs:patch`` ->
``_emit_audit`` — a content edit like ``content.py::patch_section``, not a
reason-required decision, so no ``reason=``/``run_id=`` kwargs are passed.

**Field-strengthen preview/apply** (BRF-06, D-03/D-13) generalizes
``revision.py::preview_passage_revision``/``apply_passage_revision`` to a
Brief-FIELD scope exactly as Phase 45 generalized FCT-06 (claim-scope ->
passage-scope) — ONE shared revision idiom, no third fork. ``preview`` is
read-only: budget-guards BEFORE the LLM call (mirrors REV-05/D-14), calls
``acomplete`` with a single "strengthen this field" directive (not the full
7-chip picker — a Brief field isn't claim-bearing prose), and issues NO
Convex write and NO audit row. ``apply`` writes the field via
``briefs:patch`` and emits ONE audit_log row WITH a structured ``reason=``
kwarg (mirrors the plan's explicit "-> Decision log" requirement) so
accepting an agent-strengthened field surfaces in the shared Decision log
the same way Remove-a-lead does.

The Brief has no built-in optimistic-concurrency token (§47.5) — low
collision risk (one operator per run) makes always-overwrite-and-log
acceptable, matching ``story_leads``/``verification_records``'s own lack of
a revision-token concept.
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.api.control import _emit_audit, _require_clerk_jwt_control
from eisenbalm_pipeline.lib.agent_wrapper import _truncate
from eisenbalm_pipeline.lib.budget import would_exceed_run_cap
from eisenbalm_pipeline.lib.config_loader import load_run_config
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS

log = logging.getLogger(__name__)
router = APIRouter()

# ── The six Brief fields (§47.1) — the only valid `field` values ───────────

_BRIEF_FIELDS = (
    "premise",
    "currentPeg",
    "centralClaim",
    "readerEffect",
    "knownRisks",
    "voiceIntention",
)

_FIELD_LABELS: dict[str, str] = {
    "premise": "the story's premise",
    "currentPeg": "the current peg (why this is timely right now)",
    "centralClaim": "the central claim this issue argues",
    "readerEffect": "what a reader should feel, understand, or do",
    "knownRisks": "the known risks flagged for this story",
    "voiceIntention": "the intended voice and visual direction",
}


def _validate_field(field: str) -> None:
    if field not in _BRIEF_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "reason": "unknown_field",
                "message": f"Unknown Brief field: {field!r}.",
            },
        )


def _strengthen_directive(field: str) -> str:
    """One "strengthen this field" directive (BRF-06) — a single action, not
    the full 7-chip picker `revision.py::_build_directive` offers passages;
    a Brief field is not claim-bearing prose to be nudged in a direction, it
    is asked to be made stronger outright."""
    label = _FIELD_LABELS.get(field, field)
    return (
        f"Strengthen {label} — make it sharper, more concrete, and more "
        "persuasive without inventing facts not already present."
    )


async def _fetch_current_field(convex_http, run_id: str, field: str) -> object:
    """Best-effort 'before' snapshot for the audit row. Never raises — a
    missing/degraded read just yields None (mirrors _fetch_brief_context's
    own never-crashes discipline)."""
    try:
        brief = await _cc.convex_query(convex_http, "briefs:byRunId", {"runId": run_id})
    except Exception:  # noqa: BLE001 — best-effort only
        log.warning("briefs:byRunId failed for run_id=%s (non-blocking)", run_id)
        return None
    return (brief or {}).get(field)


# ── Request/response models ──────────────────────────────────────────────────


class _PatchBriefBody(BaseModel):
    field: str
    value: str


class _StrengthenPreviewBody(BaseModel):
    currentValue: str


class _StrengthenApplyBody(BaseModel):
    newText: str


class _BriefFieldPick(BaseModel):
    proposedText: str
    whatChanged: str


# ── PATCH /issues/{run_id}/brief — BRF-05, D-12 ─────────────────────────────


@router.patch("/issues/{run_id}/brief")
async def patch_brief(
    request: Request,
    run_id: str,
    body: _PatchBriefBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Direct Brief field edit from `BriefFieldTable` (BRF-05). Guarded
    content boundary: Clerk -> `briefs:patch` -> `_emit_audit` (D-12) —
    never a bare dashboard `useMutation`."""
    _validate_field(body.field)
    convex_http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"

    before_value = await _fetch_current_field(convex_http, run_id, body.field)

    await _cc.convex_mutation(
        convex_http,
        "briefs:patch",
        {"runId": run_id, "field": body.field, "value": body.value},
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="brief_field_edited",
        resource_type="brief",
        resource_id=f"{run_id}:{body.field}",
        before=_truncate(json.dumps({body.field: before_value}, default=str)),
        after=_truncate(json.dumps({body.field: body.value}, default=str)),
    )

    return {"resolution": "brief_field_edited"}


# ── POST /issues/{run_id}/brief/{field}/strengthen/preview — BRF-06 ────────


@router.post("/issues/{run_id}/brief/{field}/strengthen/preview")
async def preview_brief_field_strengthen(
    request: Request,
    run_id: str,
    field: str,
    body: _StrengthenPreviewBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Ask an agent to strengthen a Brief field — STEP 1 (BRF-06).

    Read-only: mirrors `revision.py::preview_passage_revision`'s shape —
    budget-guards BEFORE the LLM call (REV-05/D-14), then issues NO Convex
    write and NO audit row."""
    _validate_field(field)
    convex_http = getattr(request.app.state, "convex_http", None)

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
                "message": "This issue's revision spend would exceed its cost cap.",
                **info,
            },
        )

    directive = _strengthen_directive(field)
    messages = [
        {
            "role": "system",
            "content": (
                f"{VOICE_CONSTRAINTS}\n\n"
                "Rewrite the QUOTED BRIEF FIELD per the directive; keep "
                "Jesse's dry, precise, Fortune-500 register; no AI "
                "self-reference or hedging."
            ),
        },
        {
            "role": "user",
            "content": f"DIRECTIVE: {directive}\nCURRENT VALUE: {body.currentValue}",
        },
    ]

    pick, _usage = await acomplete(
        agent_id="revision",
        run_id=run_id,
        messages=messages,
        response_format=_BriefFieldPick,
    )
    if hasattr(pick, "proposedText"):
        proposed_text = pick.proposedText
        what_changed = pick.whatChanged
    elif isinstance(pick, dict):
        proposed_text = pick.get("proposedText", "")
        what_changed = pick.get("whatChanged", "")
    else:
        proposed_text = ""
        what_changed = ""

    proposed_text = proposed_text or body.currentValue

    return {"proposedText": proposed_text, "whatChanged": what_changed}


# ── POST /issues/{run_id}/brief/{field}/strengthen/apply — BRF-06 ──────────


@router.post("/issues/{run_id}/brief/{field}/strengthen/apply")
async def apply_brief_field_strengthen(
    request: Request,
    run_id: str,
    field: str,
    body: _StrengthenApplyBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Ask an agent to strengthen a Brief field — STEP 2 (BRF-06).

    Writes the accepted proposal via `briefs:patch` and emits ONE audit_log
    row WITH a structured `reason=` kwarg (unlike `revise/apply`'s
    unreasoned `passage_revised` row) so accepting a strengthened field
    surfaces in the shared Decision log, matching the plan's explicit
    "+ audit_log + Decision-log entry" requirement for this action."""
    _validate_field(field)
    convex_http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"

    before_value = await _fetch_current_field(convex_http, run_id, field)

    await _cc.convex_mutation(
        convex_http,
        "briefs:patch",
        {"runId": run_id, "field": field, "value": body.newText},
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="brief_field_strengthened",
        resource_type="brief",
        resource_id=f"{run_id}:{field}",
        before=_truncate(json.dumps({field: before_value}, default=str)),
        after=_truncate(json.dumps({field: body.newText}, default=str)),
        reason=f"Applied agent-strengthened {field}.",
        run_id=run_id,
    )

    return {"resolution": "brief_field_strengthened"}


__all__ = ["router"]
