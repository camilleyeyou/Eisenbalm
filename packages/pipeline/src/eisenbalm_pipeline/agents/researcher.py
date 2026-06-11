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

from typing import Any

from pydantic import BaseModel, Field

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.prompts import load_prompt
from eisenbalm_pipeline.lib.search_client import SearchResult, web_search
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


MAX_TOOL_CALLS: int = 12  # AGT-18 / D-21


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
    keyStatistics: list[str] = Field(default_factory=list)
    fundingSources: list[str] = Field(default_factory=list)


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


def _build_messages(
    *, charity: dict, tavily_results: list[SearchResult]
) -> list[dict[str, str]]:
    """System prompt embeds verification + role-fallback rules verbatim
    from RESEARCH §"Researcher" lines 533-549.
    """
    results_block = "\n\n---\n\n".join(
        f"URL: {r.url}\nTitle: {r.title}\nContent: {r.content[:1200]}"
        for r in tavily_results
    )
    system = load_prompt("researcher").replace("{VOICE_CONSTRAINTS}", VOICE_CONSTRAINTS)
    user = (
        f"WINNING CHARITY:\n{charity}\n\n"
        f"TAVILY RESEARCH RESULTS:\n{results_block}\n\n"
        "Return JSON ResearchOutputModel with all narrative fields filled "
        "and all source-URL fields either populated (pointing to charity's "
        "own domain) or null."
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

    run_id = state["run_id"]
    queries = _build_queries(charity)

    # AGT-18: Enforce max_tool_calls=12 across all web_search calls.
    tool_calls = 0
    tavily_results: list[SearchResult] = []
    for q in queries:
        if tool_calls >= MAX_TOOL_CALLS:
            # Plan 05-03 Task 1 — 3-arg constructor for introspection.
            raise AgentToolCallLimitExceeded(
                agent_id="researcher", attempts=tool_calls, limit=MAX_TOOL_CALLS,
            )
        tool_calls += 1
        batch = await web_search(q, max_results=4)
        tavily_results.extend(batch)

    # Defensive guard: if the loop list itself exceeds MAX_TOOL_CALLS (e.g.
    # patched _build_queries in tests), the in-loop pre-check above raises
    # on iteration MAX_TOOL_CALLS+1. Mirror Scout's belt-and-braces check.
    if tool_calls > MAX_TOOL_CALLS:
        raise AgentToolCallLimitExceeded(
            agent_id="researcher", attempts=tool_calls, limit=MAX_TOOL_CALLS,
        )

    messages = _build_messages(charity=charity, tavily_results=tavily_results)
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

    # AGT-17: record resolved model.
    model_versions = dict(state.get("model_versions") or {})
    model_versions["researcher"] = usage["resolved_model"]

    return {
        **state,
        "research": research_dict,
        "model_versions": model_versions,
    }
