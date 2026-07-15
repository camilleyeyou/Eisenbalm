"""Phase 5 Researcher — Tavily-driven deep-dive (Sonnet via OpenRouter).

Replaces Phase 4 stub. Responsibilities:

  1. Receive state['winning_charity'] from Editor gate 1.
  2. Run up to 12 Tavily searches (D-21) on official website, founder, case-
     study subject, statistics, funding.
  3. Use Sonnet (low-temp) to parse Tavily results into ResearchOutputModel
     (AGT-07 schema). MUST emit founderName + founderNameSourceUrl pointing
     to a page on the charity's own domain (or null + role-only).
  4. Enforce max_tool_calls=12 (AGT-18); overrun raises
     AgentToolCallLimitExceeded which @agent_node converts to
     eventType='agent-tool-limit-exceeded'.
  5. Record resolved model into state['model_versions']['researcher'].

emit_event='section-draft': decorator emits one deliberationEvents row with
eventType='section-draft' on the success path (research IS a kind of
section-draft for purposes of live deliberation visualization).
"""
from __future__ import annotations

import logging
import time
from typing import Any, Literal

from pydantic import BaseModel, Field

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.charity_registry import make_dedup_key
from eisenbalm_pipeline.lib.convex_client import convex_query_safe
from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.prompts import load_prompt
from eisenbalm_pipeline.lib.search_client import SearchResult, web_search
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS

log = logging.getLogger(__name__)

MAX_TOOL_CALLS: int = 12  # AGT-18 / D-21

# MEM-03/D-08: workspace slug used across the pipeline's Convex reads (Scout's
# registry read + the coverage-strip endpoint both use the same literal).
WORKSPACE_ID = "eisenbalm"


class ClaimOutput(BaseModel):
    """§35.1 (Phase 35 PRV-01) — the LLM emits a source INDEX, never a URL.

    Code numbers each Tavily result (S0, S1, … — 0-based, aligned with the
    ``tavily_results`` list position) before the parse call; the LLM
    references those indices only. ``sourceIndex=None`` means the writer
    asserts no source. A hallucinated URL is structurally impossible because
    the model has no URL field to fill in.
    """

    text: str = ""
    sourceIndex: int | None = None
    # FCT-01 (Phase 42, D-01/D-02): the Researcher tags every claim it
    # surfaces with an importance tier. Defaults to 'Supporting' when the
    # model omits the field (stub mode's model_construct() and any
    # under-specified real response both land here safely) — never
    # silently 'Load-bearing' (D-03).
    importance: Literal['Load-bearing', 'Supporting', 'Incidental'] = 'Supporting'


class ResearchOutputModel(BaseModel):
    """AGT-07 output (RESEARCH §"Researcher" lines 552-567).

    Field defaults match StyleBriefOutput pattern (Plan 05-05 SUMMARY): every
    non-list field has a default so Pydantic.model_construct() succeeds in
    stub mode (FakeOpenRouterClient skips validation).
    """

    summary: str = ""
    foundingYear: int | None = None
    annualBudget: str | None = None
    founderName: str | None = None
    founderNameSourceUrl: str | None = None
    founderRole: str = "founder"
    founderBio: str = ""
    subjectName: str | None = None
    subjectNameSourceUrl: str | None = None
    subjectRole: str = "a program participant"
    subjectStory: str = ""
    fundingSources: list[str] = Field(default_factory=list)
    claims: list[ClaimOutput] = Field(default_factory=list)  # §35.1 (Phase 35 PRV-01)


def _build_queries(charity: dict) -> list[str]:
    """Five candidate queries; cap fan-out via the max_tool_calls counter."""
    name = charity.get("name", "")
    website = charity.get("website", "")
    domain = website.split("://", 1)[-1].split("/", 1)[0] if website else ""
    return [
        f"{name} founder about page site:{domain}" if domain else f"{name} founder",
        f"{name} mission history founding year",
        f"{name} annual report budget revenue",
        f"{name} program participant case study",
        f"{name} key statistics impact",
    ]


def _map_claims(
    raw_claims: list[Any],
    tavily_results: list[SearchResult],
    retrieved_at_by_index: list[int],
    run_id: str,
) -> list[dict[str, Any]]:
    """§35.2 (PRV-01) + FCT-01 (Phase 42, D-02): map each LLM-emitted
    sourceIndex to the real Tavily URL at that position + the code-stamped
    retrievedAt, and carry the LLM-emitted importance tier through (default
    'Supporting' when the model omits it — D-03). Out-of-range/absent
    sourceIndex -> sourceUrl=None, retrievedAt=None (honestly unsourced —
    never a fabricated or best-guess URL). Pure, synchronous — extracted so
    it is independently unit-testable without a network call.
    """
    mapped_claims: list[dict[str, Any]] = []
    for i, claim in enumerate(raw_claims):
        claim_dict = claim if isinstance(claim, dict) else dict(claim)
        source_index = claim_dict.get("sourceIndex")
        source_url: str | None = None
        retrieved_at: int | None = None
        if isinstance(source_index, int) and 0 <= source_index < len(tavily_results):
            source_url = tavily_results[source_index].url
            retrieved_at = retrieved_at_by_index[source_index]
        mapped_claims.append({
            "claimId": f"{run_id[:8]}-{i}",
            "text": claim_dict.get("text", ""),
            "sourceUrl": source_url,
            "retrievedAt": retrieved_at,
            "importance": claim_dict.get("importance", "Supporting"),
        })
    return mapped_claims


def _build_corrections_block(corrections: list[dict] | None) -> str:
    """MEM-03/D-08: render prior corrections as a bulleted block for prompt
    injection. Empty string when there are none (byte-equivalent messages
    for the common no-corrections case)."""
    if not corrections:
        return ""
    bullets = "\n".join(f"- {c.get('text', '')}" for c in corrections)
    return f"PRIOR EDITORIAL CORRECTIONS (account for these):\n{bullets}"


def _build_messages(
    *,
    state: DispatchState,
    charity: dict,
    tavily_results: list[SearchResult],
    corrections: list[dict] | None = None,
) -> list[dict[str, str]]:
    """System prompt embeds verification + role-fallback rules verbatim
    from RESEARCH §"Researcher" lines 533-549.

    Phase 22 (CFG-01): base prompt read from
    state["config"].agents["researcher"].system_prompt, disk fallback otherwise.
    """
    # §35.1/§35.2 (PRV-01): each result is prefixed with a stable [Si] index
    # label. Index i is 0-based and MUST equal the sourceIndex the researcher()
    # mapping step (post-acomplete) uses to look up tavily_results[i] — keep
    # this enumeration and that mapping aligned; do not renumber independently.
    results_block = "\n\n---\n\n".join(
        f"[S{i}] URL: {r.url}\nTitle: {r.title}\nContent: {r.content[:1200]}"
        for i, r in enumerate(tavily_results)
    )
    cfg = state.get("config")
    base = cfg.agents["researcher"].system_prompt if cfg else load_prompt("researcher")
    system = base.replace("{VOICE_CONSTRAINTS}", VOICE_CONSTRAINTS)
    # Phase 24 (PRM-01): user template read from config, on-disk .md fallback.
    user_tmpl = (
        cfg.user_templates.get("researcher_user")
        if cfg and cfg.user_templates.get("researcher_user")
        else load_prompt("researcher_user")
    )
    corrections_block = _build_corrections_block(corrections)
    user = (
        user_tmpl
        .replace("{charity}", f"{charity}")
        .replace("{results_block}", results_block)
        .replace("{corrections}", corrections_block)
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


@agent_node(name="researcher", emit_event="section-draft", max_tool_calls=12)
async def researcher(state: DispatchState) -> DispatchState:
    charity = state.get("winning_charity") or {}
    if not charity:
        raise RuntimeError(
            "researcher: state['winning_charity'] missing — Editor gate 1 "
            "must run first."
        )

    # MEM-03/D-08/D-09: re-read this charity's append-only corrections log
    # via the SHARED dedup-key helper (do not reimplement — Pitfall 2: a
    # fourth independent key implementation risks silent drift that would
    # make corrections invisibly never match).
    dedup_key = make_dedup_key(charity.get("name", ""), charity.get("website"))
    corrections = await convex_query_safe(
        "charityCorrections:listByCharityKey",
        {"workspace_id": WORKSPACE_ID, "charityKey": dedup_key},
    ) or []
    log.info(
        "Researcher: read %d correction(s) for charity=%r (dedupKey=%r) — %s",
        len(corrections), charity.get("name"), dedup_key,
        "injected into research context" if corrections else "none found",
    )

    run_id = state["run_id"]
    queries = _build_queries(charity)

    # AGT-18: Enforce max_tool_calls=12 across all web_search calls.
    tool_calls = 0
    tavily_results: list[SearchResult] = []
    # §35.2 (PRV-01): parallel, same-length list — each tavily_results[i] gets
    # its retrieval timestamp stamped at the moment its batch returned.
    retrieved_at_by_index: list[int] = []
    for q in queries:
        if tool_calls >= MAX_TOOL_CALLS:
            # Plan 05-03 Task 1 — 3-arg constructor for introspection.
            raise AgentToolCallLimitExceeded(
                agent_id="researcher", attempts=tool_calls, limit=MAX_TOOL_CALLS,
            )
        tool_calls += 1
        batch = await web_search(q, max_results=4)
        batch_retrieved_at = int(time.time() * 1000)
        tavily_results.extend(batch)
        retrieved_at_by_index.extend([batch_retrieved_at] * len(batch))

    # Defensive guard: if the loop list itself exceeds MAX_TOOL_CALLS (e.g.
    # patched _build_queries in tests), the in-loop pre-check above raises
    # on iteration MAX_TOOL_CALLS+1. Mirror Scout's belt-and-braces check.
    if tool_calls > MAX_TOOL_CALLS:
        raise AgentToolCallLimitExceeded(
            agent_id="researcher", attempts=tool_calls, limit=MAX_TOOL_CALLS,
        )

    messages = _build_messages(
        state=state, charity=charity, tavily_results=tavily_results, corrections=corrections,
    )
    out_obj, usage = await acomplete(
        agent_id="researcher",
        run_id=run_id,
        messages=messages,
        response_format=ResearchOutputModel,
    )

    # Defensive dict extraction: stub-mode returns model_construct() (empty
    # fields with defaults); real mode returns a populated ResearchOutputModel.
    research_dict: dict[str, Any]
    if hasattr(out_obj, "model_dump"):
        research_dict = out_obj.model_dump()
    elif isinstance(out_obj, dict):
        research_dict = dict(out_obj)
    else:
        research_dict = {}

    # §35.2 (PRV-01) + FCT-01 (Phase 42): map each LLM-emitted sourceIndex to
    # the real Tavily URL/retrievedAt and carry the importance tier through.
    raw_claims = research_dict.get("claims") or []
    mapped_claims = _map_claims(raw_claims, tavily_results, retrieved_at_by_index, run_id)
    research_dict["claims"] = mapped_claims

    # AGT-17: record resolved model.
    model_versions = dict(state.get("model_versions") or {})
    model_versions["researcher"] = usage["resolved_model"]

    return {
        **state,
        "research": research_dict,
        "model_versions": model_versions,
    }
