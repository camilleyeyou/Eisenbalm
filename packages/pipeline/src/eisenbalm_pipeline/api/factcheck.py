"""Phase 42 (FCT-05/FCT-06, docs/API_CONTRACTS.md §42.4) — Fact Check claim
action endpoints.

Six Clerk-JWT-guarded routes covering the four non-evidence claim actions
plus the two-step "Ask agent for better evidence" agent-revision contract:

  POST   /issues/{run_id}/claims/{claim_index}/keep             body {reason}
  PATCH  /issues/{run_id}/claims/{claim_index}                  body {ifRevisionID?, text?, sourceUrl?, retrievedAt?}
  POST   /issues/{run_id}/claims/{claim_index}/replace-source   body {sourceUrl, retrievedAt?}
  DELETE /issues/{run_id}/claims/{claim_index}                  body {reason?}
  POST   /issues/{run_id}/claims/{claim_index}/evidence/preview body {}
  POST   /issues/{run_id}/claims/{claim_index}/evidence/apply   body {ifRevisionID, sourceUrl, retrievedAt, rewrittenClaim}

Confirm (dashboard -> claimChecks:setStatus, requireOperator) stays a direct
Convex mutation and is NOT in this router — only the content-touching and
decision-log-writing actions route through the pipeline boundary (D-14).

RATIONALE — "Keep as written" is pipeline-side ON PURPOSE (checker Warning
4): even though it mutates no Sanity content, it must write a D-18 decision-
log/audit_log entry, and ``convex/auditLog.ts::record`` is
``requirePipelineSecret``-guarded — so a decision-log write is ONLY
reachable from this pipeline layer. Do not "simplify" Keep-as-written to a
bare dashboard Convex mutation; that would silently drop the decision-log
entry FCT-05/D-18 requires.

"Ask agent for better evidence" (evidence/preview + evidence/apply) is a
near-verbatim clone of the already-shipped
``voice_pass.py::voice_rewrite`` (read-only preview) +
``findings.py::accept_finding`` (span-resolve + scoped patch + Convex flip +
audit) pair — see 42-RESEARCH.md's "highest-leverage finding". This
ESTABLISHES the span-scoped agent-revision contract claim-scoped first;
Phase 45 generalizes the SAME endpoint pair to arbitrary passage revision —
do not fork a second one.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

import eisenbalm_pipeline.lib.convex_client as _cc
import eisenbalm_pipeline.lib.sanity_client as _sc
from eisenbalm_pipeline.api.content import (
    _reset_touched_claims,
    _resolve_sanity_id,
    _touched_block_indices,
)
from eisenbalm_pipeline.api.control import (
    _emit_audit,
    _require_clerk_jwt_control,
    _revoke_active_signoffs,
)
from eisenbalm_pipeline.lib.agent_wrapper import _truncate
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.portable_text import compose_section_body
from eisenbalm_pipeline.lib.sanity_client import get_issue_draft, patch_issue_field
from eisenbalm_pipeline.lib.search_client import web_search
from eisenbalm_pipeline.lib.span_resolver import resolve_span

log = logging.getLogger(__name__)
router = APIRouter()

# claim_checks.sectionName is ALREADY galley vocabulary (lib/claims.py's
# _SECTION_TO_GALLEY_ID) — unlike qaCorrections' snake_case vocabulary,
# findings.py's _QA_SECTION_TO_DRAFT_KEY mapping is not needed here.
_LONG_READ_SECTIONS = frozenset(
    {"originStory", "problemStatement", "founderBio", "caseStudy"}
)


# ── Request body models ────────────────────────────────────────────────────


class _KeepBody(BaseModel):
    reason: str


class _PatchClaimBody(BaseModel):
    ifRevisionID: Optional[str] = None
    text: Optional[str] = None
    sourceUrl: Optional[str] = None
    retrievedAt: Optional[int] = None


class _ReplaceSourceBody(BaseModel):
    sourceUrl: str
    retrievedAt: Optional[int] = None


class _RemoveBody(BaseModel):
    reason: Optional[str] = None


class _EvidenceApplyBody(BaseModel):
    ifRevisionID: str
    sourceUrl: str
    retrievedAt: int
    rewrittenClaim: str


class _EvidencePick(BaseModel):
    """§35.1-style index-selection discipline: the LLM emits a source INDEX
    into the numbered Tavily results, never a raw URL — a hallucinated
    source is structurally impossible."""

    sourceIndex: int
    rewrittenClaim: str


# ── Shared helpers ──────────────────────────────────────────────────────────


async def _load_claim(convex_http: Any, run_id: str, claim_index: int) -> dict:
    """Load one claim_checks row by (runId, claimIndex). 404 when absent."""
    claim = await _cc.convex_query(
        convex_http,
        "claimChecks:byRunIdAndIndex",
        {"runId": run_id, "claimIndex": claim_index},
    )
    if claim is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Claim not found for run {run_id}: index {claim_index}",
        )
    return claim


def _claim_snapshot(claim: dict) -> str:
    """Truncated JSON before/after audit snapshot of a claim row."""
    return _truncate(
        json.dumps(
            {
                "text": claim.get("text"),
                "status": claim.get("status"),
                "sourceUrl": claim.get("sourceUrl"),
            },
            default=str,
        )
    )


def _claim_section_blocks(draft: dict, section_name: str) -> tuple[list[dict], str]:
    """Resolve a claim's (blocks, field_path) from its ``sectionName``.

    claim_checks rows only ever anchor to the 4 long-read sections or
    "bonus" (lib/claims.py's ``_SECTION_TO_GALLEY_ID`` vocabulary) —
    ``sectionName`` IS the draft key directly. Raises 409
    ``claim_edit_unavailable`` for a bonus claim on a non-specAd issue (no
    editable block body) or an unrecognized section.
    """
    if section_name in _LONG_READ_SECTIONS:
        blocks = list(
            (draft.get("sections", {}).get(section_name) or {}).get("blocks") or []
        )
        return blocks, f"{section_name}.body"
    if section_name == "bonus":
        if draft.get("bonusType") != "specAd":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "reason": "claim_edit_unavailable",
                    "message": "Only spec-ad bonuses have an editable block body.",
                },
            )
        blocks = list((draft.get("bonus") or {}).get("body") or [])
        return blocks, "bonus.body"
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "reason": "claim_edit_unavailable",
            "message": f"Section '{section_name}' has no editable block body.",
        },
    )


async def _patch_claim_prose(
    convex_http: Any,
    sanity_http: Any,
    *,
    sanity_id: str,
    run_id: str,
    claim: dict,
    new_text: str,
    if_revision_id: str,
) -> str:
    """Shared apply path for PATCH(text) and evidence/apply (§42.4a).

    Re-resolves the claim's CURRENT phrase against live Sanity content via
    ``claim_checks.text`` + ``blockIndexHint`` — NEVER ``claimSpans``, which
    is never forwarded to Sanity (§35.3, 42-RESEARCH.md Pitfall 5) — then
    scoped-patches it and resets any claim anchored to the touched block(s)
    (§42.5/D-19/D-20). Returns the new Sanity revisionId. Raises 409
    ``span_not_resolved`` / ``revision_mismatch`` / ``claim_edit_unavailable``.
    """
    draft = await get_issue_draft(sanity_http, sanity_id)
    section_name = claim.get("sectionName") or ""
    blocks, field_path = _claim_section_blocks(draft, section_name)

    match = resolve_span(blocks, claim.get("text", ""), claim.get("blockIndexHint"))
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "span_not_resolved",
                "message": "Couldn't locate this claim's text in the current draft.",
            },
        )

    before_blocks = [dict(b) for b in blocks]
    text = blocks[match.block_index]["text"]
    blocks[match.block_index] = {
        **blocks[match.block_index],
        "text": text[: match.start] + new_text + text[match.end :],
    }

    new_rev = await patch_issue_field(
        sanity_http,
        issue_id=sanity_id,
        field_path=field_path,
        value=compose_section_body(blocks),
        if_revision_id=if_revision_id,
    )

    # §42.5/Pitfall 3: reset touched claims FIRST — the caller sets the acted
    # claim's own terminal status AFTER this returns, so the explicit action
    # always wins over this generic block-level reset.
    touched = _touched_block_indices(before_blocks, blocks)
    await _reset_touched_claims(
        convex_http, run_id=run_id, section_name=section_name, touched=touched
    )
    return new_rev


# ── POST /issues/{run_id}/claims/{claim_index}/keep — D-14/D-18 ────────────


@router.post("/issues/{run_id}/claims/{claim_index}/keep")
async def keep_claim(
    request: Request,
    run_id: str,
    claim_index: int,
    body: _KeepBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Keep as written — a checked-equivalent terminal status + a mandatory-
    reason decision-log entry (D-14/D-18). NO Sanity write. Pipeline-side on
    purpose (module RATIONALE): the audit/decision-log write requires the
    pipeline secret, so this must route through this Clerk-guarded endpoint
    rather than a bare dashboard Convex mutation.
    """
    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "reason": "empty_reason",
                "message": "A reason is required to keep this claim as written.",
            },
        )

    convex_http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"

    claim = await _load_claim(convex_http, run_id, claim_index)

    await _cc.convex_mutation(
        convex_http,
        "claimChecks:keepAsWritten",
        {"runId": run_id, "claimIndex": claim_index},
    )

    # Phase 43 (§43.2, D-11/D-13): the operator's reason + run scope are
    # threaded through the extended _emit_audit as structured decision
    # kwargs (alongside the existing after-JSON reason) so this row projects
    # through auditLog.listDecisions the same as the Convex-side decisions.
    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="claim_kept",
        resource_type="claim",
        resource_id=f"{run_id}:{claim_index}",
        before=_claim_snapshot(claim),
        after=_truncate(json.dumps({"status": "checked", "reason": reason}, default=str)),
        reason=reason,
        run_id=run_id,
    )

    return {"claimIndex": claim_index, "status": "checked"}


# ── PATCH /issues/{run_id}/claims/{claim_index} — D-14/D-15 ────────────────


@router.patch("/issues/{run_id}/claims/{claim_index}")
async def patch_claim(
    request: Request,
    run_id: str,
    claim_index: int,
    body: _PatchClaimBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Edit claim (D-15): metadata-only patch (sourceUrl/retrievedAt) when
    ``text`` is absent — no Sanity write. When ``text`` is present, this also
    content-patches Sanity: resolves the claim's phrase against CURRENT
    draft blocks, scoped-patches it, resets any claim anchored to the
    touched block(s) FIRST, then sets THIS claim's terminal status LAST so
    the explicit edit always wins over that generic reset (42-RESEARCH.md
    Pitfall 3), then revokes active sign-offs.
    """
    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    claim = await _load_claim(convex_http, run_id, claim_index)

    if body.text is None:
        patch_args: dict[str, Any] = {"runId": run_id, "claimIndex": claim_index}
        if body.sourceUrl is not None:
            patch_args["sourceUrl"] = body.sourceUrl
        if body.retrievedAt is not None:
            patch_args["retrievedAt"] = body.retrievedAt

        await _cc.convex_mutation(convex_http, "claimChecks:updateClaim", patch_args)

        await _emit_audit(
            convex_http,
            actor_id=actor,
            action="claim_edited",
            resource_type="claim",
            resource_id=f"{run_id}:{claim_index}",
            before=_claim_snapshot(claim),
            after=_truncate(
                json.dumps(
                    {"sourceUrl": body.sourceUrl, "retrievedAt": body.retrievedAt},
                    default=str,
                )
            ),
        )
        return {"claimIndex": claim_index, "revisionId": None}

    if not body.ifRevisionID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "reason": "missing_revision_id",
                "message": "ifRevisionID is required when editing claim text.",
            },
        )

    new_rev = await _patch_claim_prose(
        convex_http,
        sanity_http,
        sanity_id=sanity_id,
        run_id=run_id,
        claim=claim,
        new_text=body.text,
        if_revision_id=body.ifRevisionID,
    )

    patch_args = {"runId": run_id, "claimIndex": claim_index, "text": body.text}
    if body.sourceUrl is not None:
        patch_args["sourceUrl"] = body.sourceUrl
    if body.retrievedAt is not None:
        patch_args["retrievedAt"] = body.retrievedAt
    await _cc.convex_mutation(convex_http, "claimChecks:updateClaim", patch_args)

    # Terminal status set LAST (Pitfall 3) — wins over _patch_claim_prose's
    # generic block-level reset that may have just touched this same claim.
    await _cc.convex_mutation(
        convex_http,
        "claimChecks:keepAsWritten",
        {"runId": run_id, "claimIndex": claim_index},
    )

    await _revoke_active_signoffs(convex_http, run_id=run_id, reason="claim edited")

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="claim_edited",
        resource_type="claim",
        resource_id=f"{run_id}:{claim_index}",
        before=_claim_snapshot(claim),
        after=_truncate(
            json.dumps(
                {
                    "text": body.text,
                    "sourceUrl": body.sourceUrl,
                    "retrievedAt": body.retrievedAt,
                },
                default=str,
            )
        ),
    )

    return {"claimIndex": claim_index, "revisionId": new_rev}


# ── POST /issues/{run_id}/claims/{claim_index}/replace-source — D-14/D-15 ──


@router.post("/issues/{run_id}/claims/{claim_index}/replace-source")
async def replace_claim_source(
    request: Request,
    run_id: str,
    claim_index: int,
    body: _ReplaceSourceBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Replace source — metadata-only claimChecks update (sourceUrl + a
    code-stamped retrievedAt when the client doesn't supply one). NO Sanity
    write (D-15)."""
    convex_http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"

    claim = await _load_claim(convex_http, run_id, claim_index)
    retrieved_at = (
        body.retrievedAt if body.retrievedAt is not None else int(time.time() * 1000)
    )

    await _cc.convex_mutation(
        convex_http,
        "claimChecks:updateClaim",
        {
            "runId": run_id,
            "claimIndex": claim_index,
            "sourceUrl": body.sourceUrl,
            "retrievedAt": retrieved_at,
        },
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="claim_source_replaced",
        resource_type="claim",
        resource_id=f"{run_id}:{claim_index}",
        before=_claim_snapshot(claim),
        after=_truncate(
            json.dumps(
                {"sourceUrl": body.sourceUrl, "retrievedAt": retrieved_at}, default=str
            )
        ),
    )

    return {"claimIndex": claim_index, "sourceUrl": body.sourceUrl, "retrievedAt": retrieved_at}


# ── DELETE /issues/{run_id}/claims/{claim_index} — D-14/D-15 ───────────────


@router.delete("/issues/{run_id}/claims/{claim_index}")
async def remove_claim(
    request: Request,
    run_id: str,
    claim_index: int,
    body: Optional[_RemoveBody] = None,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Remove claim — soft-delete via ``status: 'removed'`` (D-15,
    42-RESEARCH.md Pitfall 4 — satisfies allSignedOff's ``status !== 'pending'``
    gate with zero code change to that function). NO Sanity write."""
    convex_http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"
    reason = (body.reason if body else None) or ""

    claim = await _load_claim(convex_http, run_id, claim_index)

    await _cc.convex_mutation(
        convex_http,
        "claimChecks:remove",
        {"runId": run_id, "claimIndex": claim_index},
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="claim_removed",
        resource_type="claim",
        resource_id=f"{run_id}:{claim_index}",
        before=_claim_snapshot(claim),
        after=_truncate(json.dumps({"status": "removed", "reason": reason}, default=str)),
    )

    return {"claimIndex": claim_index, "status": "removed"}


# ── POST /issues/{run_id}/claims/{claim_index}/evidence/preview — §42.4a ──


@router.post("/issues/{run_id}/claims/{claim_index}/evidence/preview")
async def preview_claim_evidence(
    request: Request,
    run_id: str,
    claim_index: int,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Ask agent for better evidence — STEP 1 (§42.4a, FCT-06).

    Read-only: mirrors ``voice_pass.py::voice_rewrite`` exactly. Generates a
    replacement source AND a rewritten claim for a comparison card — NEVER
    mutates Convex or Sanity, and writes NO audit row. The client passes the
    result into evidence/apply (STEP 2) to actually commit it.

    This establishes the span-scoped agent-revision contract claim-scoped
    first — Phase 45 generalizes this SAME endpoint to arbitrary passage
    revision (do not fork a second endpoint).
    """
    convex_http, sanity_http, sanity_id, _actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    claim = await _load_claim(convex_http, run_id, claim_index)

    # 42-RESEARCH.md Pitfall 6: a small scoped GROQ projection for charity
    # name/website — get_issue_draft's projection has no charity context,
    # and dereferencing it there would be a wholesale expansion for a
    # single-endpoint need (mirrors content.py::_fetch_before's pattern).
    charity_rows = await _sc._groq(
        sanity_http,
        '*[_id == $id][0]{"charityName": charity->name, "charityWebsite": charity->website}',
        {"id": sanity_id},
    )
    charity = charity_rows[0] if charity_rows else {}
    charity_name = charity.get("charityName") or ""

    query = f"{claim.get('text', '')} {charity_name}".strip()
    tavily_results = await web_search(query, max_results=5)
    if not tavily_results:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "no_evidence_found",
                "message": "No candidate sources were found for this claim.",
            },
        )

    # §35.1-style index-selection discipline (researcher.py) — number each
    # result [Si] and have the LLM pick an index, never emit a raw URL.
    results_block = "\n\n---\n\n".join(
        f"[S{i}] URL: {r.url}\nTitle: {r.title}\nContent: {r.content[:1200]}"
        for i, r in enumerate(tavily_results)
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You are a fact-checker for Jesse A. Eisenbalm's Dispatch. "
                "Given a claim and numbered search results, pick the BEST "
                "supporting result by its [Si] index (never invent a URL) "
                "and rewrite the claim so it is fully supported by that "
                "source. Keep Jesse's dry, precise, Fortune-500 register — "
                "no hedging, no AI self-reference."
            ),
        },
        {
            "role": "user",
            "content": (
                f"CLAIM: {claim.get('text', '')}\n"
                f"CHARITY: {charity_name}\n\n"
                f"SEARCH RESULTS:\n{results_block}"
            ),
        },
    ]

    pick, _usage = await acomplete(
        agent_id="researcher",
        run_id=f"evidence-preview-{run_id}",
        messages=messages,
        response_format=_EvidencePick,
    )
    if hasattr(pick, "sourceIndex"):
        source_index = pick.sourceIndex
        rewritten_claim = pick.rewrittenClaim
    elif isinstance(pick, dict):
        source_index = pick.get("sourceIndex")
        rewritten_claim = pick.get("rewrittenClaim", "")
    else:
        source_index = None
        rewritten_claim = ""

    if not isinstance(source_index, int) or not (0 <= source_index < len(tavily_results)):
        # Never a raw LLM-emitted URL and never a crash on a bad index —
        # fall back to the top-ranked search result.
        source_index = 0
    chosen = tavily_results[source_index]
    source_publisher = urlparse(chosen.url).netloc or chosen.url

    return {
        "sourceUrl": chosen.url,
        "sourcePublisher": source_publisher,
        "retrievedAt": int(time.time() * 1000),
        "rewrittenClaim": rewritten_claim or claim.get("text", ""),
    }


# ── POST /issues/{run_id}/claims/{claim_index}/evidence/apply — §42.4a ────


@router.post("/issues/{run_id}/claims/{claim_index}/evidence/apply")
async def apply_claim_evidence(
    request: Request,
    run_id: str,
    claim_index: int,
    body: _EvidenceApplyBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Ask agent for better evidence — STEP 2 (§42.4a, FCT-06).

    Applies the STEP 1 preview atomically: re-resolves the claim's phrase
    against CURRENT Sanity content (never ``claimSpans`` — §35.3, Pitfall
    5), content-patches the prose, resets any claim anchored to the touched
    block(s) FIRST, then sets THIS claim's terminal status LAST (Pitfall 3),
    updates the claim's sourceUrl/retrievedAt/text, revokes active
    sign-offs, and writes one decision-log (audit_log) row (D-18).

    Span-scoped by ``claim_index`` in the URL only — the request/response
    shape (ifRevisionID/sourceUrl/retrievedAt/rewrittenClaim) is claim-
    agnostic so Phase 45 generalizes this SAME endpoint to arbitrary passage
    revision rather than forking a second one.
    """
    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    claim = await _load_claim(convex_http, run_id, claim_index)

    new_rev = await _patch_claim_prose(
        convex_http,
        sanity_http,
        sanity_id=sanity_id,
        run_id=run_id,
        claim=claim,
        new_text=body.rewrittenClaim,
        if_revision_id=body.ifRevisionID,
    )

    await _cc.convex_mutation(
        convex_http,
        "claimChecks:updateClaim",
        {
            "runId": run_id,
            "claimIndex": claim_index,
            "text": body.rewrittenClaim,
            "sourceUrl": body.sourceUrl,
            "retrievedAt": body.retrievedAt,
        },
    )

    # Terminal status set LAST (Pitfall 3) — wins over _patch_claim_prose's
    # generic block-level reset that may have just touched this same claim.
    await _cc.convex_mutation(
        convex_http,
        "claimChecks:keepAsWritten",
        {"runId": run_id, "claimIndex": claim_index},
    )

    await _revoke_active_signoffs(
        convex_http, run_id=run_id, reason="claim evidence applied"
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="claim_evidence_applied",
        resource_type="claim",
        resource_id=f"{run_id}:{claim_index}",
        before=_claim_snapshot(claim),
        after=_truncate(
            json.dumps(
                {
                    "text": body.rewrittenClaim,
                    "sourceUrl": body.sourceUrl,
                    "retrievedAt": body.retrievedAt,
                },
                default=str,
            )
        ),
    )

    return {
        "revisionId": new_rev,
        "claimIndex": claim_index,
        "resolution": "evidence_applied",
    }


__all__ = ["router"]
