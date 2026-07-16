"""Phase 46 Plan 04 — Signal Editor: dated story-lead discovery agent.

Runs *before* Scout (D-01 chain: calibrator -> signal_editor -> scout ->
verify_candidates -> advocate). Responsibilities:

  1. Read Editorial Memory (Phase 39/40 recent-coverage) for a repetition
     avoid-note, reusing the exact ``compute_repetition_note`` algorithm
     (SGE-05, D-15/D-16/D-17) rather than reinventing it. Empty fallback on
     any Convex/Sanity failure — the agent still emits leads.
  2. Run a bounded Tavily web search (``max_tool_calls=8``, AGT-18/D-19) for
     current, dated news so the LLM has real material for the "dated peg +
     source link" requirement.
  3. Call the LLM (Sonnet tier, registered by Plan 46-03) to produce 3-5
     ``StoryLead``-shaped leads (SGE-01), Pydantic-enforced at the boundary.
  4. Enforce the brand-risk/recommended invariant in PYTHON (SGE-02, D-08):
     a lead with ``brandRiskFlag=True`` NEVER has ``recommended=True``, even
     if the LLM output claims otherwise. This is a hard invariant, not a
     prompt trust.
  5. Persist every lead to Convex ``storyLeads:insert`` (nothing silent,
     mirrors Scout's ``pitchLog:insert`` emission) — best-effort, logs and
     continues on failure.
  6. Return ``story_leads`` (JSON-safe ``list[dict]``, SGE-04 checkpoint-safe)
     on state.

The agent is NOT yet wired into the graph — that lands in Plan 46-06.
"""
from __future__ import annotations

import logging
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe, convex_query_safe
from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.prompts import load_prompt
from eisenbalm_pipeline.lib.registry_repetition import compute_repetition_note
from eisenbalm_pipeline.lib.sanity_client import groq_query
from eisenbalm_pipeline.lib.search_client import SearchResult, web_search

WORKSPACE_ID = "eisenbalm"

log = logging.getLogger(__name__)


# Curated CURRENT-news queries (D-19) — dated/charitable-adjacent, distinct
# from Scout's "obscure charity" discovery queries.
SIGNAL_QUERIES: tuple[str, ...] = (
    "this week charitable response breaking news",
    "recent nonprofit relief effort event",
    "current disaster relief community response news",
)


# ── Pydantic output schemas (SGE-01) ─────────────────────────────────────


class StoryLeadModel(BaseModel):
    """The 11 StoryLead fields (docs/API_CONTRACTS.md §46.1), Pydantic-
    enforced at the LLM boundary — mirrors Scout's CharityCandidate."""

    premise: str
    datedPeg: str
    pegSourceUrl: str
    readerEnergy: str
    charitableAngle: str
    category: str
    confidence: Literal["low", "medium", "high"]
    brandRiskFlag: bool = False
    brandRiskReason: Optional[str] = None
    repetitionWarning: Optional[str] = None
    recommended: bool = False


class SignalEditorOutput(BaseModel):
    """Top-level shape returned by the LLM."""

    leads: list[StoryLeadModel] = Field(default_factory=list)


# ── Editorial Memory read (SGE-05, mirrors api/registry.py:99-138) ──────


async def _read_repetition_note() -> dict:
    """Read the last-8 featured charities' cause/geo, derive an "avoid X ·
    avoid Y" note via the shared Phase-40 algorithm (D-15).

    Wrapped in try/except -> ``{"note": None, "avoid": [], "sampleSize": 0}``
    on ANY failure (D-17), mirroring Scout's ``_load_registry_keys``
    []-on-failure posture. First-run safety: the Signal Editor still emits
    its leads; it simply omits repetition warnings that run.
    """
    try:
        rows = (
            await convex_query_safe(
                "charities:listRecentFeatured",
                {"workspace_id": WORKSPACE_ID, "limit": 8},
            )
            or []
        )
        ids = [r["sanityCharityId"] for r in rows if r.get("sanityCharityId")]
        sanity_rows = (
            await groq_query(
                '*[_type=="charity" && _id in $ids]{_id, focusArea, location}',
                params={"ids": ids},
            )
            if ids
            else []
        )
        avoid_note = compute_repetition_note(sanity_rows)
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "signal_editor: Editorial Memory read failed (%r) — empty fallback",
            exc,
        )
        avoid_note = {"note": None, "avoid": [], "sampleSize": 0}

    log.info(
        "signal_editor: read %d recent-coverage row(s) — %s",
        avoid_note.get("sampleSize", 0),
        avoid_note.get("note") or "no repetition",
    )
    return avoid_note


# ── Prompt construction ───────────────────────────────────────────────────


def _build_messages(
    *, config: Any, tavily_results: list[SearchResult], avoid_note: dict
) -> list[dict[str, str]]:
    """System prompt embeds the brand-risk rubric + repetition-warning
    phrasing (prompts/signal_editor.md, Plan 46-03). ``{avoid_note}`` is
    filled with the deterministic note string (empty string when None)."""
    results_block = "\n\n".join(
        f"URL: {r.url}\nTitle: {r.title}\nContent: {r.content[:600]}"
        for r in tavily_results
    )
    base = (
        config.agents["signal_editor"].system_prompt
        if config
        else load_prompt("signal_editor")
    )
    system = base.replace("{avoid_note}", avoid_note.get("note") or "")

    user_tmpl = (
        config.user_templates.get("signal_editor_user")
        if config and config.user_templates.get("signal_editor_user")
        else load_prompt("signal_editor_user")
    )
    user = user_tmpl.replace("{results_block}", results_block)

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


# ── Agent body ─────────────────────────────────────────────────────────


@agent_node(name="signal_editor", emit_event=None, max_tool_calls=8)
async def signal_editor(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    max_calls = 8  # mirrors @agent_node decorator parameter (AGT-18)

    # 1. Editorial Memory read (SGE-05) — empty fallback on any failure.
    avoid_note = await _read_repetition_note()

    # 2. Bounded Tavily search for current, dated news (D-19).
    tavily_results: list[SearchResult] = []
    tool_calls = 0
    for query in SIGNAL_QUERIES:
        if tool_calls >= max_calls:
            raise AgentToolCallLimitExceeded(
                agent_id="signal_editor", attempts=tool_calls, limit=max_calls,
            )
        tool_calls += 1
        batch = await web_search(query, max_results=5)
        tavily_results.extend(batch)

    if tool_calls > max_calls:
        raise AgentToolCallLimitExceeded(
            agent_id="signal_editor", attempts=tool_calls, limit=max_calls,
        )

    # 3. LLM call — 3-5 StoryLead-shaped leads (SGE-01).
    out, usage = await acomplete(
        agent_id="signal_editor",
        run_id=run_id,
        messages=_build_messages(
            config=state.get("config"),
            tavily_results=tavily_results,
            avoid_note=avoid_note,
        ),
        response_format=SignalEditorOutput,
    )

    leads = [l.model_dump() for l in getattr(out, "leads", [])]

    # 4. PYTHON INVARIANT (SGE-02, D-08): never trust the LLM alone —
    # a brand-risk-flagged lead is NEVER recommended, even if the model
    # output claims otherwise.
    for lead in leads:
        if lead.get("brandRiskFlag"):
            lead["recommended"] = False

    # 5. Per-lead Convex emission (nothing silent, mirrors pitchLog:insert).
    for lead in leads:
        await convex_mutation_safe("storyLeads:insert", {"runId": run_id, **lead})

    # 6. AGT-17: record resolved model.
    model_versions = dict(state.get("model_versions") or {})
    model_versions["signal_editor"] = usage["resolved_model"]

    return {
        **state,
        "story_leads": leads,
        "model_versions": model_versions,
    }
