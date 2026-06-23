"""Phase 5 Scout — Tavily-driven charity discovery (Haiku via OpenRouter).

Replaces Phase 4 stub. Responsibilities:

  1. Load featured-charity archive via one GROQ query (D-10 dedup source).
  2. Run 1-3 Tavily web searches against curated queries to surface candidates.
  3. Use OpenRouter (Haiku, low-temp) to parse Tavily results into structured
     CharityCandidate objects (AGT-03 schema).
  4. Filter out candidates matching featured_charity_keys (AGT-04).
  5. For each surviving candidate: write_charity to Sanity (idempotent
     deterministic _id), then pitchLog:insert to Convex (Phase 4 D-18 order).
  6. Enforce max_tool_calls=8 (AGT-18): a local counter increments before
     every web_search; raises AgentToolCallLimitExceeded when budget would
     be exceeded. @agent_node converts the exception into a
     deliberationEvents 'agent-tool-limit-exceeded' row + status='failed'.

emit_event=None: the Phase 4 stub set this to None; per-candidate pitchLog
rows are the observable per-finding records for the deliberation layer.
Plan 05-07 (Advocate) emits the first 'advocate-argument' event downstream.
"""
from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field, field_validator

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import (
    convex_mutation_safe,
    convex_query,
    get_client as get_convex_http,
)
from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.prompts import load_prompt
from eisenbalm_pipeline.lib.sanity_client import (
    get_client as get_sanity_http,
    write_charity,
)
from eisenbalm_pipeline.lib.search_client import SearchResult, web_search

# Workspace ID — matches the canonical WORKSPACE_ID in config_loader.py.
WORKSPACE_ID = "eisenbalm"

log = logging.getLogger(__name__)


# Curated Tavily queries (RESEARCH §"Scout" lines 397-430).
# Three queries × 5 results = up to 15 raw hits for the LLM to filter.
SCOUT_QUERIES: tuple[str, ...] = (
    "obscure charity small nonprofit overlooked impact",
    "underfunded charitable foundation lesser-known",
    "small charity unique mission narrow focus",
)


# ── Pydantic output schemas ──────────────────────────────────────────────


class CharityCandidate(BaseModel):
    """AGT-03 per-candidate Pydantic shape (RESEARCH §Scout lines 416-426)."""

    name: str
    location: str
    website: str
    assetRange: str = Field(description="e.g. '<$100k', '$100k-$1M', '$1M-$10M'")
    focusArea: str
    missionStatement: str
    scoutSummary: str
    whyOverlooked: str


class ScoutBatchOutput(BaseModel):
    """Top-level shape returned by the LLM after parsing Tavily results."""

    candidates: list[CharityCandidate] = Field(
        default_factory=list,
        description="3-5 candidate charities (AGT-03) — MUST emit at least 1",
    )

    @field_validator("candidates")
    @classmethod
    def _at_least_one(cls, v: list) -> list:
        # AGT-03 contract: Scout must surface candidates. minItems can't live
        # in the JSON schema (Anthropic rejects it), so enforced post-parse.
        # Empty list triggers acomplete's regenerate-once retry.
        if not v:
            raise ValueError(
                "Scout must surface at least 1 candidate (got 0)"
            )
        return v


# ── Dedup helpers (AGT-04) ───────────────────────────────────────────────


def _domain_of(url: str) -> str:
    """Extract bare domain (no scheme, no path, no www.) for dedup. Case-folded."""
    if not url:
        return ""
    no_scheme = url.split("://", 1)[-1]
    domain = no_scheme.split("/", 1)[0].lower().strip()
    return domain[4:] if domain.startswith("www.") else domain


def _candidate_keys(c: CharityCandidate) -> set[str]:
    """Lowercase name + lowercase domain — match keys used in featured set."""
    keys: set[str] = {c.name.strip().lower()}
    d = _domain_of(c.website)
    if d:
        keys.add(d)
    return keys


async def _load_registry_keys(http) -> list[str]:
    """Query Convex charities registry for featured + blocklisted dedup keys.

    Replaces the previous GROQ-based ``_load_featured_keys()`` (D-03 / REG-02).
    The Convex charities registry is now the single authoritative dedup source.

    The Convex query ``charities:listForDedup`` returns only featured +
    blocklisted rows (API_CONTRACTS §26.6). Each row carries a ``dedupKey``
    of the form ``"name_lower|domain"`` — we split on ``"|"`` to get both
    components, matching the flat key set that ``_candidate_keys()`` produces.

    On any Convex exception (cold environment, missing CONVEX_DEPLOY_KEY,
    transient network) returns [] — first-run safety. Scout still runs; the
    dedup just doesn't filter anything on the first ever run.

    Args:
        http: The httpx.AsyncClient registered for Convex. Passed in so this
              function can be unit-tested without a live client.

    Returns:
        Sorted list of dedup key strings (JSON-serializable — no set).
    """
    try:
        rows = await convex_query(
            http,
            "charities:listForDedup",
            {"workspace_id": WORKSPACE_ID},
        )
        # rows: list of {dedupKey, name, domain, status}
        keys: set[str] = set()
        for r in rows or []:
            if r.get("dedupKey"):
                for part in r["dedupKey"].split("|"):
                    if part:
                        keys.add(part)
        return sorted(keys)  # deterministic order for testing + JSON-safe
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "Scout registry dedup: Convex failed (%r) — empty fallback", exc
        )
        return []


# ── Prompt construction ─────────────────────────────────────────────────


def _build_messages(
    *, state: DispatchState, tavily_results: list[SearchResult], featured_keys: list[str]
) -> list[dict[str, str]]:
    """System prompt embeds rejection rule + max_tool_calls budget verbatim
    from RESEARCH §Scout. featured_keys are interpolated for the LLM to use
    defensively (the real filter runs in Python after the model returns).

    Phase 22 (CFG-01): the base system prompt is read from
    state["config"].agents["scout"].system_prompt when present, falling back to
    the on-disk default only on legacy/test paths without a resolved config.
    """
    results_block = "\n\n".join(
        f"URL: {r.url}\nTitle: {r.title}\nContent: {r.content[:600]}"
        for r in tavily_results
    )
    cfg = state.get("config")
    base = cfg.agents["scout"].system_prompt if cfg else load_prompt("scout")
    system = base.replace("{featured_keys}", f"{featured_keys}")
    # Phase 24 (PRM-01): user template read from config, on-disk .md fallback.
    user_tmpl = (
        cfg.user_templates.get("scout_user")
        if cfg and cfg.user_templates.get("scout_user")
        else load_prompt("scout_user")
    )
    user = user_tmpl.replace("{results_block}", results_block)
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


# ── Agent body ──────────────────────────────────────────────────────────


@agent_node(name="scout", emit_event=None, max_tool_calls=8)
async def scout(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    max_calls = 8  # mirrors @agent_node decorator parameter (AGT-18)

    # 1. Registry dedup load (D-03 / REG-02) — Convex charities registry.
    # Replaces the prior GROQ-based _load_featured_keys() (D-10).
    # _load_registry_keys returns [] on any Convex failure (first-run safety).
    try:
        convex_http = get_convex_http()
    except RuntimeError:
        convex_http = None  # type: ignore[assignment]

    if convex_http is not None:
        featured_keys = await _load_registry_keys(convex_http)
    else:
        log.warning("Scout: Convex client unavailable — empty registry fallback")
        featured_keys = []
    featured_set = set(featured_keys)

    # 2. Tavily searches with iteration-limit enforcement (AGT-18).
    tavily_results: list[SearchResult] = []
    tool_calls = 0
    for query in SCOUT_QUERIES:
        if tool_calls >= max_calls:
            raise AgentToolCallLimitExceeded(
                agent_id="scout", attempts=tool_calls, limit=max_calls,
            )
        tool_calls += 1
        batch = await web_search(query, max_results=5)
        tavily_results.extend(batch)

    # Guard for any future query lists that exceed max_calls before the loop
    # would catch them (e.g. patched SCOUT_QUERIES in tests).
    if tool_calls > max_calls:
        raise AgentToolCallLimitExceeded(
            agent_id="scout", attempts=tool_calls, limit=max_calls,
        )

    # 3. LLM parses Tavily output into Pydantic-validated candidates.
    messages = _build_messages(
        state=state, tavily_results=tavily_results, featured_keys=featured_keys
    )
    batch_out, usage = await acomplete(
        agent_id="scout",
        run_id=run_id,
        messages=messages,
        response_format=ScoutBatchOutput,
    )

    # Defensive shape extraction: stub-mode returns model_construct() (empty
    # candidates list); real mode returns a populated ScoutBatchOutput.
    # Tests also exercise both paths.
    candidates_raw: list[Any]
    if hasattr(batch_out, "candidates"):
        candidates_raw = list(batch_out.candidates or [])
    elif isinstance(batch_out, dict):
        candidates_raw = list(batch_out.get("candidates") or [])
    else:
        candidates_raw = []

    # 4. Python-side dedup (defensive — model may ignore the system rule).
    surviving: list[dict] = []
    for cand in candidates_raw:
        c = (
            cand
            if isinstance(cand, CharityCandidate)
            else CharityCandidate(**cand)
        )
        keys = _candidate_keys(c)
        if keys & featured_set:
            continue
        surviving.append(c.model_dump())

    # 5. Sanity + Convex writes per Phase 4 D-18 order (verbatim from
    # Phase 4 stub: Sanity halts the pipeline on failure; Convex logs+continues).
    try:
        sanity_http = get_sanity_http()
    except RuntimeError as exc:
        # Same surface as Phase 4 stub on Sanity failure: re-raise wrapped
        # RuntimeError so the @agent_node wrapper sets status='failed'.
        raise RuntimeError(f"Sanity client unavailable: {exc!r}") from exc

    for candidate in surviving:
        try:
            charity_id = await write_charity(sanity_http, candidate)
        except Exception as exc:
            raise RuntimeError(
                f"Sanity write_charity failed: {exc!r}"
            ) from exc

        await convex_mutation_safe(
            "pitchLog:insert",
            {
                "runId": run_id,
                "charityId": charity_id,
                "charityName": candidate["name"],
                "charityLocation": candidate.get("location", ""),
                "charityWebsite": candidate.get("website"),
                "assetRange": candidate.get("assetRange"),
                "focusArea": candidate.get("focusArea"),
                "scoutSummary": candidate.get("scoutSummary", ""),
                "selected": False,
            },
        )

        # Phase 26 REG-01: log surviving candidate to Convex charity registry.
        # Best-effort: per-candidate try/except so one failure doesn't abort the rest.
        # Pitfall 3 (RESEARCH): upsertCandidate never downgrades featured/blocklisted.
        try:
            await convex_mutation_safe(
                "charities:upsertCandidate",
                {
                    "workspace_id": WORKSPACE_ID,
                    "name": candidate["name"],
                    "website": candidate.get("website"),
                    "runId": run_id,
                },
            )
        except Exception as _upsert_exc:  # noqa: BLE001
            log.warning(
                "Scout: charities:upsertCandidate failed for %r (%r) — continuing",
                candidate.get("name"),
                _upsert_exc,
            )

    # 6. AGT-17: record resolved model.
    model_versions = dict(state.get("model_versions") or {})
    model_versions["scout"] = usage["resolved_model"]

    return {
        **state,
        "candidates": surviving,
        # list[str] (NOT set) — JSON-serializable for LangGraph checkpoint
        # per RESEARCH Pitfall 7.
        "featured_charity_keys": featured_keys,
        "model_versions": model_versions,
    }
