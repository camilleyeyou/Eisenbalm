"""Tavily web search wrapper. Used only by Scout + Researcher (D-09).

Honors ``EISENBALM_STUB_MODE``: in stub mode returns a deterministic 3-item
fixture list so Scout / Researcher tests don't hit the live API.

Import-path resilience: tries ``langchain_tavily`` first (the canonical
0.2.18 package — verified by Plan 05-02 Task 1 SUMMARY); falls back to
``langchain_community.utilities.tavily_search`` and bare ``tavily.TavilyClient``
if the canonical path drifts (RESEARCH Pitfall 1).
"""
from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any

from eisenbalm_pipeline.stubs.fake_openrouter import is_stub_mode

log = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Tavily search hit. Stable shape for Scout + Researcher consumption."""
    url: str
    title: str
    content: str
    score: float


_STUB_RESULTS = [
    SearchResult(
        url="https://example.org/quiet-foundation",
        title="The Quiet Foundation",
        content="A small Vermont charity preserving library acoustic environments.",
        score=0.92,
    ),
    SearchResult(
        url="https://example.org/backroad-cartography",
        title="The Backroad Cartography Trust",
        content="Cartographers documenting forgotten New England backroads.",
        score=0.81,
    ),
    SearchResult(
        url="https://example.org/seed-savers",
        title="Heritage Seed Savers Collective",
        content="Preserving heirloom seed varieties across the Midwest.",
        score=0.75,
    ),
]


# ── Wrapper cache (one TavilyClient per process) ─────────────────────────


_wrapper: Any = None


def _get_wrapper() -> Any:
    """Resolve a Tavily client object; tries multiple import paths."""
    global _wrapper
    if _wrapper is not None:
        return _wrapper
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        raise RuntimeError(
            "TAVILY_API_KEY not set. Required by Scout + Researcher when "
            "EISENBALM_STUB_MODE is false."
        )

    # Canonical path at 0.2.18 — verified by Plan 05-02 Task 1 SUMMARY.
    try:
        from langchain_tavily import TavilySearch
        _wrapper = TavilySearch(tavily_api_key=api_key, max_results=10)
        log.info("search_client: using langchain_tavily.TavilySearch")
        return _wrapper
    except ImportError:
        pass

    # Fallback: langchain_community wrapper.
    try:
        from langchain_community.utilities.tavily_search import TavilySearchAPIWrapper
        _wrapper = TavilySearchAPIWrapper(tavily_api_key=api_key)
        log.info("search_client: using langchain_community TavilySearchAPIWrapper")
        return _wrapper
    except ImportError:
        pass

    # Last resort: tavily-python directly.
    from tavily import TavilyClient
    _wrapper = TavilyClient(api_key=api_key)
    log.info("search_client: using tavily-python TavilyClient (bare)")
    return _wrapper


# ── Public API ──────────────────────────────────────────────────────────


async def web_search(query: str, *, max_results: int = 5) -> list[SearchResult]:
    """Search Tavily. Stub-mode returns deterministic fixtures.

    Args:
        query: Free-text search query.
        max_results: Cap on returned hits (Tavily's max is typically 10).

    Returns:
        List of SearchResult, possibly empty on transient failure (logged).
    """
    if is_stub_mode():
        return list(_STUB_RESULTS[:max_results])

    wrapper = _get_wrapper()

    # langchain_tavily.TavilySearch exposes .ainvoke(query) returning
    # {"results": [...]}; TavilySearchAPIWrapper exposes .aresults(query, max_results);
    # tavily-python TavilyClient exposes .search(query) (sync) — wrap in to_thread.
    raw_list: list[dict] = []
    try:
        # Detect interface heuristically.
        if hasattr(wrapper, "ainvoke") and callable(getattr(wrapper, "ainvoke")):
            raw = await wrapper.ainvoke({"query": query, "max_results": max_results})
            raw_list = raw.get("results", []) if isinstance(raw, dict) else []
        elif hasattr(wrapper, "aresults") and callable(getattr(wrapper, "aresults")):
            raw_list = await wrapper.aresults(query, max_results=max_results)
        elif hasattr(wrapper, "search") and callable(getattr(wrapper, "search")):
            raw = await asyncio.to_thread(wrapper.search, query, max_results=max_results)
            raw_list = raw.get("results", []) if isinstance(raw, dict) else []
        else:
            log.error("search_client: unknown Tavily client interface on %r", type(wrapper))
            return []
    except Exception as exc:  # noqa: BLE001 — network errors must not crash agents
        log.warning("Tavily search failed (query=%r): %r", query, exc)
        return []

    results: list[SearchResult] = []
    for r in raw_list[:max_results]:
        if not isinstance(r, dict):
            continue
        results.append(SearchResult(
            url=str(r.get("url", "")),
            title=str(r.get("title", "")),
            content=str(r.get("content", r.get("snippet", ""))),
            score=float(r.get("score", 0.0) or 0.0),
        ))
    return results
