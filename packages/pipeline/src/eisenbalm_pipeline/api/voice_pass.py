"""Phase 36 (VOX-02/VOX-04, docs/API_CONTRACTS.md §36.4/§36.5) — Voice Pass
on-demand endpoints.

Two Clerk-JWT-guarded POST routes:

  POST /issues/{run_id}/voice-recheck   # no body
  POST /issues/{run_id}/voice-rewrite   # body {findingId}

voice-recheck re-runs the EXISTING Opus judge (agents/qa/judge.py::run_llm_judge)
against the CURRENT (post-edit) draft — never a new detector (VOX-04) — writing
fresh voice findings tagged agentId="qa-recheck", after superseding any prior
still-open qa-recheck findings so repeated clicks never double the tell count
(Research Pitfall 4). Rule-layer findings (agentId="qa") are stable/idempotent
and are never touched here.
"""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, Request

import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.agents.qa.judge import run_llm_judge
from eisenbalm_pipeline.api.content import _resolve_sanity_id
from eisenbalm_pipeline.api.control import _emit_audit, _require_clerk_jwt_control
from eisenbalm_pipeline.lib.sanity_client import get_issue_draft

log = logging.getLogger(__name__)
router = APIRouter()


def _rows_to_text(rows) -> str:
    """Flatten a get_issue_draft() {type,text}[] block-row list to plain text."""
    return " ".join(r.get("text", "") for r in (rows or []))


def _draft_to_qa_sections(draft: dict) -> dict[str, str]:
    """Mirror agents/qa/__init__.py::_extract_sections's flattening logic, but
    read get_issue_draft()'s ``{headline, blocks, lossy}`` per-section shape
    (§36.4 step 2) instead of DispatchState's Portable-Text-block-list shape.
    """
    sections = draft.get("sections") or {}
    bonus = draft.get("bonus") or {}
    return {
        "origin_story": _rows_to_text((sections.get("originStory") or {}).get("blocks")),
        "problem": _rows_to_text((sections.get("problemStatement") or {}).get("blocks")),
        "founder_bio": _rows_to_text((sections.get("founderBio") or {}).get("blocks")),
        "case_study": _rows_to_text((sections.get("caseStudy") or {}).get("blocks")),
        "game": (draft.get("game") or {}).get("description", "") or "",
        "bonus": _rows_to_text(bonus.get("body")) if draft.get("bonusType") == "specAd" else "",
    }


# ── POST /issues/{run_id}/voice-recheck — §36.4 ────────────────────────────


@router.post("/issues/{run_id}/voice-recheck")
async def voice_recheck(
    request: Request,
    run_id: str,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Re-run the existing Opus judge against the CURRENT draft (§36.4).

    Dedup (Research Pitfall 4): any still-OPEN prior qa-recheck finding is
    superseded (dismissed with reason "superseded by re-check") BEFORE the new
    findings are written, so repeated clicks never double the tell count.
    Rule-layer (agentId="qa") findings are NEVER touched here — they are
    stable/idempotent (same predicate, same text, same result every time).

    narrator is always None (Research Pitfall 6): narrator resolution is an
    in-memory, run-start-only concern with no persisted, independently
    queryable record — the byte-compatible legacy default (NRR-10).

    Uses the RAISING ``convex_mutation`` (not ``convex_mutation_safe``) for
    every write here — this is a live, synchronous, operator-triggered call;
    a silently-swallowed failure would let the operator believe they got a
    fresh check when they got nothing.
    """
    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    draft = await get_issue_draft(sanity_http, sanity_id)
    sections = _draft_to_qa_sections(draft)

    existing = (
        await _cc.convex_query(convex_http, "qaCorrections:byRunId", {"runId": run_id}) or []
    )
    for row in existing:
        if row.get("agentId") == "qa-recheck" and not row.get("resolution"):
            await _cc.convex_mutation(
                convex_http,
                "qaCorrections:setResolution",
                {
                    "id": row["_id"],
                    "resolution": "dismissed",
                    "resolutionReason": "superseded by re-check",
                    "resolvedBy": actor,
                    "resolvedAt": int(time.time() * 1000),
                },
            )

    findings, _resolved_model = await run_llm_judge(
        sections, run_id=run_id, narrator=None, rubric=None
    )

    for f in findings:
        await _cc.convex_mutation(
            convex_http,
            "qaCorrections:insert",
            {
                "runId": run_id,
                "agentId": "qa-recheck",
                "sectionName": f.section,
                "severity": f.severity,
                "axis": f.axis,
                "quotedSpan": f.quotedSpan,
                "reason": f.reason,
                "suggestedFix": f.suggestedFix,
                "accepted": False,
            },
        )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="voice.recheck",
        resource_type="run",
        resource_id=run_id,
    )

    return {"runId": run_id, "findingCount": len(findings)}


__all__ = ["router"]
