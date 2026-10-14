"""Phase 51.1 Plan 03 Task 1 — research_sources persistence + fact_check config."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.researcher import ResearchOutputModel, researcher
from eisenbalm_pipeline.lib.llm_config import (
    MAX_TOKENS_BY_AGENT,
    MODEL_BY_AGENT,
    SAMPLING_BY_AGENT,
)
from eisenbalm_pipeline.lib.search_client import SearchResult

_USAGE = {"tokens_in": 0, "tokens_out": 0, "usd": 0.0, "resolved_model": "anthropic/claude-sonnet-4-6"}


def _out() -> ResearchOutputModel:
    return ResearchOutputModel(summary="s", claims=[])


async def _run(state, results):
    state["winning_charity"] = {"name": "Foo Org", "website": "https://foo.org"}
    with patch(
        "eisenbalm_pipeline.agents.researcher.web_search", AsyncMock(return_value=results)
    ), patch(
        "eisenbalm_pipeline.agents.researcher.acomplete", AsyncMock(return_value=(_out(), _USAGE))
    ), patch(
        "eisenbalm_pipeline.agents.researcher.convex_query_safe", AsyncMock(return_value=[])
    ):
        return await researcher(state)


@pytest.mark.asyncio
async def test_researcher_returns_research_sources(sample_dispatch_state) -> None:
    results = [
        SearchResult(url="https://a.org", title="A", content="aaa", score=0.9),
        SearchResult(url="https://b.org", title="B", content="bbb", score=0.8),
    ]
    res = await _run(sample_dispatch_state, results)
    sources = res["research_sources"]
    assert sources and len(sources) % 2 == 0
    for i, s in enumerate(sources):
        assert set(s) == {"index", "url", "title", "content", "retrievedAt"}
        assert s["index"] == i
    assert sources[0]["url"] == "https://a.org" and sources[0]["title"] == "A"
    assert sources[1]["url"] == "https://b.org" and sources[1]["title"] == "B"


@pytest.mark.asyncio
async def test_research_sources_content_clipped_to_1500(sample_dispatch_state) -> None:
    results = [SearchResult(url="https://a.org", title="A", content="x" * 4000, score=0.9)]
    res = await _run(sample_dispatch_state, results)
    assert all(len(s["content"]) == 1500 for s in res["research_sources"])


@pytest.mark.asyncio
async def test_research_sources_not_inside_research(sample_dispatch_state) -> None:
    results = [SearchResult(url="https://a.org", title="A", content="c", score=0.9)]
    res = await _run(sample_dispatch_state, results)
    assert "research_sources" not in res["research"]
    assert not res["research"].get("sources")


def test_fact_check_llm_config() -> None:
    assert MODEL_BY_AGENT["fact_check"] == "anthropic/claude-haiku-4-5"
    assert SAMPLING_BY_AGENT["fact_check"] == {"temperature": 0.0, "top_p": 1.0}
    assert MAX_TOKENS_BY_AGENT["fact_check"] == 8000
