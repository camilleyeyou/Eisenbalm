"""Phase 5 Scout unit tests — implemented by Plan 05-06.

Validation: AGT-03 (candidate count), AGT-04 (dedup), AGT-18 (tool limit),
AGT-17 (modelVersions recording).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.scout import (
    CharityCandidate,
    ScoutBatchOutput,
    _candidate_keys,
    _domain_of,
    scout,
)
from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded
from eisenbalm_pipeline.lib.search_client import SearchResult


def _make_candidate(name: str, website: str) -> CharityCandidate:
    return CharityCandidate(
        name=name,
        location="NYC",
        website=website,
        assetRange="<$1M",
        focusArea="education",
        missionStatement="m",
        scoutSummary="s",
        whyOverlooked="o",
    )


def test_domain_of() -> None:
    """AGT-04 dedup helper: domain extraction is case-folded and www-stripped."""
    assert _domain_of("https://www.foo.org/about") == "foo.org"
    assert _domain_of("http://bar.example/x") == "bar.example"
    assert _domain_of("") == ""


def test_candidate_keys() -> None:
    """AGT-04 dedup helper: candidate keys include lowercase name + domain."""
    c = _make_candidate("Foo Org", "https://www.foo.org")
    keys = _candidate_keys(c)
    assert "foo org" in keys
    assert "foo.org" in keys


async def test_candidate_count(sample_dispatch_state) -> None:
    """AGT-03: Scout returns 3-5 candidates."""
    five = [
        _make_candidate(f"Org {i}", f"https://org{i}.example") for i in range(5)
    ]
    batch = ScoutBatchOutput(candidates=five)
    tavily_results = [
        SearchResult(
            url=f"https://org{i}.example",
            title=f"Org {i}",
            content="...",
            score=0.9,
        )
        for i in range(7)
    ]

    with patch(
        "eisenbalm_pipeline.agents.scout.web_search",
        AsyncMock(return_value=tavily_results),
    ), patch(
        "eisenbalm_pipeline.agents.scout.acomplete",
        AsyncMock(
            return_value=(
                batch,
                {
                    "tokens_in": 100,
                    "tokens_out": 50,
                    "usd": 0.01,
                    "resolved_model": "anthropic/claude-haiku-4-5",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.scout._load_registry_keys",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout.get_convex_http",
        return_value=object(),  # non-None sentinel so the None branch isn't taken
    ), patch(
        "eisenbalm_pipeline.agents.scout.write_charity",
        AsyncMock(
            side_effect=lambda http, c: f"charity-{c['name'].lower().replace(' ', '-')}"
        ),
    ), patch(
        "eisenbalm_pipeline.agents.scout.convex_mutation_safe",
        AsyncMock(),
    ), patch(
        "eisenbalm_pipeline.agents.scout.get_sanity_http",
        return_value=None,
    ):
        result = await scout(sample_dispatch_state)

    assert 3 <= len(result["candidates"]) <= 5
    # AGT-17: resolved model is recorded.
    assert result["model_versions"]["scout"] == "anthropic/claude-haiku-4-5"


async def test_dedup(sample_dispatch_state) -> None:
    """AGT-04: Scout filters candidates matching featured archive."""
    featured = ["foo org", "foo-org", "foo.example"]
    cands = [
        _make_candidate("Foo Org", "https://foo.example"),
        _make_candidate("Bar Org", "https://bar.example"),
        _make_candidate("Baz Org", "https://baz.example"),
        _make_candidate("Qux Org", "https://qux.example"),
    ]
    batch = ScoutBatchOutput(candidates=cands)

    with patch(
        "eisenbalm_pipeline.agents.scout.web_search",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout.acomplete",
        AsyncMock(
            return_value=(
                batch,
                {
                    "tokens_in": 0,
                    "tokens_out": 0,
                    "usd": 0.0,
                    "resolved_model": "anthropic/claude-haiku-4-5",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.scout._load_registry_keys",
        AsyncMock(return_value=featured),
    ), patch(
        "eisenbalm_pipeline.agents.scout.get_convex_http",
        return_value=object(),  # non-None sentinel
    ), patch(
        "eisenbalm_pipeline.agents.scout.write_charity",
        AsyncMock(
            side_effect=lambda http, c: f"charity-{c['name'].lower().replace(' ', '-')}"
        ),
    ), patch(
        "eisenbalm_pipeline.agents.scout.convex_mutation_safe",
        AsyncMock(),
    ), patch(
        "eisenbalm_pipeline.agents.scout.get_sanity_http",
        return_value=None,
    ):
        result = await scout(sample_dispatch_state)

    names = {c["name"] for c in result["candidates"]}
    assert "Foo Org" not in names, "dedup must drop the matched name"
    # The three non-matching candidates survived.
    assert {"Bar Org", "Baz Org", "Qux Org"}.issubset(names)
    # featured_charity_keys persisted as list (JSON-safe per Pitfall 7).
    assert isinstance(result["featured_charity_keys"], list)
    assert result["featured_charity_keys"] == featured


async def test_tool_limit_exceeded(sample_dispatch_state) -> None:
    """AGT-18: Scout raises AgentToolCallLimitExceeded when web_search budget exceeded.

    Synthesize the overrun by patching SCOUT_QUERIES to 9 entries (>8).
    The decorator's max_tool_calls=8 budget is mirrored by the in-body
    counter; the 9th query trips the AGT-18 raise.
    """
    from eisenbalm_pipeline.agents import scout as scout_mod

    nine_queries = tuple(f"q{i}" for i in range(9))
    with patch.object(scout_mod, "SCOUT_QUERIES", nine_queries), patch(
        "eisenbalm_pipeline.agents.scout.web_search",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout._load_registry_keys",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout.get_convex_http",
        return_value=object(),  # non-None sentinel
    ):
        with pytest.raises(AgentToolCallLimitExceeded) as excinfo:
            await scout(sample_dispatch_state)

    # AGT-18: exception carries introspectable attributes for the wrapper /
    # deliberationEvents emission (Plan 05-01 schema patch).
    assert excinfo.value.agent_id == "scout"
    assert excinfo.value.limit == 8
    assert excinfo.value.attempts >= 8
