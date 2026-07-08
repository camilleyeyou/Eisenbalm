"""Phase 33 (EDT-04, docs/API_CONTRACTS.md §33.3) — findings action endpoints.

Three Clerk-JWT-guarded POST routes that make QA findings actionable from the
dispatch-control galley:

  POST /issues/{run_id}/findings/{finding_id}/accept   body {ifRevisionID}
  POST /issues/{run_id}/findings/{finding_id}/dismiss  body {reason}
  POST /issues/{run_id}/findings/{finding_id}/reopen   no body

Accept is the write engine: it re-resolves the finding's ``quotedSpan``
server-side (lib/span_resolver.py, §33.5 — never guess), replaces it with
``suggestedFix`` via the Phase 31 scoped-patch machinery
(``patch_issue_field`` on the plain ``issue-{n}`` id), flips the Convex
resolution through the secret-guarded ``qaCorrections:setResolution``
mutation, and writes a truncated before/after audit row ("nothing silent").

Dismiss and reopen touch Convex + audit only — NEVER Sanity (D-04: reopen
does not revert text).
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.api.content import _resolve_sanity_id
from eisenbalm_pipeline.api.control import _emit_audit, _require_clerk_jwt_control
from eisenbalm_pipeline.lib.agent_wrapper import _truncate
from eisenbalm_pipeline.lib.portable_text import compose_section_body
from eisenbalm_pipeline.lib.sanity_client import get_issue_draft, patch_issue_field
from eisenbalm_pipeline.lib.span_resolver import resolve_span

log = logging.getLogger(__name__)
router = APIRouter()

# QA `sectionName` -> draft section key. Python mirror of
# apps/dispatch-control/lib/galley/sectionIdMap.ts — `problem` ->
# `problemStatement` is the one non-obvious mapping. `game` is intentionally
# ABSENT (no {type,text} block body -> accept 409 accept_unavailable);
# `bonus` maps but is only patchable when the issue's bonusType is specAd.
_QA_SECTION_TO_DRAFT_KEY = {
    "origin_story": "originStory",
    "problem": "problemStatement",
    "founder_bio": "founderBio",
    "case_study": "caseStudy",
    "bonus": "bonus",
}


# ── Request body models ────────────────────────────────────────────────────


class _AcceptBody(BaseModel):
    ifRevisionID: str


class _DismissBody(BaseModel):
    reason: str


# ── Shared helpers ─────────────────────────────────────────────────────────


async def _load_finding(convex_http, run_id: str, finding_id: str) -> dict:
    """Load one qaCorrections row by Convex _id. 404 when missing or when
    the row belongs to a different run (§33.3 step 1)."""
    finding = await _cc.convex_query(
        convex_http, "qaCorrections:byId", {"id": finding_id}
    )
    if finding is None or finding.get("runId") != run_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding not found for run {run_id}: {finding_id}",
        )
    return finding


def _require_open(finding: dict) -> None:
    """409 already_resolved when the finding has a resolution set."""
    if finding.get("resolution"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "already_resolved",
                "message": (
                    f"This finding was already {finding['resolution']}. "
                    "Reopen it first to act on it again."
                ),
            },
        )


def _accept_unavailable(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"reason": "accept_unavailable", "message": message},
    )


# ── POST /issues/{run_id}/findings/{finding_id}/accept ─────────────────────


@router.post("/issues/{run_id}/findings/{finding_id}/accept")
async def accept_finding(
    request: Request,
    run_id: str,
    finding_id: str,
    body: _AcceptBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Apply a finding's suggestedFix to the real Sanity draft (§33.3).

    Flow: load finding (404 / 409 already_resolved) -> 409 accept_unavailable
    (no fix / no span / no block body) -> get_issue_draft -> resolve_span
    (None -> 409 span_not_resolved, D-05 never guess) -> scoped
    patch_issue_field (stale rev -> 409 revision_mismatch, D-06) -> Convex
    setResolution flip -> before/after audit row.
    """
    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    finding = await _load_finding(convex_http, run_id, finding_id)
    _require_open(finding)

    quoted_span = finding.get("quotedSpan")
    suggested_fix = finding.get("suggestedFix")
    if not suggested_fix or not quoted_span:
        # D-07 — nothing to apply / nothing to anchor.
        raise _accept_unavailable(
            "This finding has no suggested fix or quoted span to apply. "
            "Use Edit inline instead."
        )

    section = finding.get("sectionName") or ""
    draft_key = _QA_SECTION_TO_DRAFT_KEY.get(section)
    if draft_key is None:
        # Covers `game` (and any unmapped section) — no block body to patch.
        raise _accept_unavailable(
            f"Section '{section}' has no editable block body. "
            "Use Edit inline instead."
        )

    draft = await get_issue_draft(sanity_http, sanity_id)

    if draft_key == "bonus":
        if draft.get("bonusType") != "specAd":
            raise _accept_unavailable(
                "Only spec-ad bonuses have an editable block body. "
                "Use Edit inline instead."
            )
        blocks = list((draft.get("bonus") or {}).get("body") or [])
        field_path = "bonus.body"
    else:
        blocks = list(
            (draft.get("sections", {}).get(draft_key) or {}).get("blocks") or []
        )
        field_path = f"{draft_key}.body"

    match = resolve_span(blocks, quoted_span, finding.get("blockIndexHint"))
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "span_not_resolved",
                "message": (
                    "Couldn't locate this text in the current draft. "
                    "Use Edit inline instead."
                ),
            },
        )

    text = blocks[match.block_index]["text"]
    blocks[match.block_index] = {
        **blocks[match.block_index],
        "text": text[: match.start] + suggested_fix + text[match.end :],
    }

    # Phase 31 scoped patch — a stale ifRevisionID raises the standard 409
    # {reason: "revision_mismatch"} from patch_issue_field (propagated, D-06).
    new_rev = await patch_issue_field(
        sanity_http,
        issue_id=sanity_id,
        field_path=field_path,
        value=compose_section_body(blocks),
        if_revision_id=body.ifRevisionID,
    )

    # Pitfall 6: the Sanity patch has ALREADY been applied. If the Convex
    # resolution flip fails now, the finding would stay "open" while its
    # text is fixed — the gate is load-bearing, so surface this loudly.
    try:
        await _cc.convex_mutation(
            convex_http,
            "qaCorrections:setResolution",
            {
                "id": finding_id,
                "resolution": "accepted",
                "resolvedBy": actor,
                "resolvedAt": int(time.time() * 1000),
            },
        )
    except Exception as exc:  # noqa: BLE001
        log.error(
            "qaCorrections:setResolution failed AFTER Sanity patch for "
            "run=%s finding=%s: %r",
            run_id,
            finding_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "reason": "resolution_flip_failed",
                "message": (
                    "The text fix WAS applied to the draft, but the finding "
                    "could not be marked accepted. Reload the galley and "
                    "dismiss this finding manually."
                ),
            },
        ) from exc

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="finding.accepted",
        resource_type="finding",
        resource_id=f"{run_id}:{finding_id}",
        before=_truncate(quoted_span),
        after=_truncate(suggested_fix),
    )

    return {"revisionId": new_rev, "findingId": finding_id, "resolution": "accepted"}


# ── POST /issues/{run_id}/findings/{finding_id}/dismiss ────────────────────


@router.post("/issues/{run_id}/findings/{finding_id}/dismiss")
async def dismiss_finding(
    request: Request,
    run_id: str,
    finding_id: str,
    body: _DismissBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Dismiss a finding with a required reason (§33.3). NO Sanity write."""
    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "reason": "empty_reason",
                "message": "A dismissal reason is required.",
            },
        )

    convex_http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"

    finding = await _load_finding(convex_http, run_id, finding_id)
    _require_open(finding)

    await _cc.convex_mutation(
        convex_http,
        "qaCorrections:setResolution",
        {
            "id": finding_id,
            "resolution": "dismissed",
            "resolutionReason": reason,
            "resolvedBy": actor,
            "resolvedAt": int(time.time() * 1000),
        },
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="finding.dismissed",
        resource_type="finding",
        resource_id=f"{run_id}:{finding_id}",
        after=_truncate(reason),
    )

    return {"findingId": finding_id, "resolution": "dismissed"}


# ── POST /issues/{run_id}/findings/{finding_id}/reopen ─────────────────────


@router.post("/issues/{run_id}/findings/{finding_id}/reopen")
async def reopen_finding(
    request: Request,
    run_id: str,
    finding_id: str,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Reopen a resolved finding (§33.3, D-04 — never reverts text).

    Sends setResolution with `resolution` OMITTED, which clears
    resolution/resolutionReason/resolvedBy/resolvedAt and sets
    accepted=false (§33.1).
    """
    convex_http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"

    finding = await _load_finding(convex_http, run_id, finding_id)
    if not finding.get("resolution"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "not_resolved",
                "message": "This finding is already open.",
            },
        )

    await _cc.convex_mutation(
        convex_http,
        "qaCorrections:setResolution",
        {"id": finding_id},
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="finding.reopened",
        resource_type="finding",
        resource_id=f"{run_id}:{finding_id}",
    )

    return {"findingId": finding_id, "resolution": None}
