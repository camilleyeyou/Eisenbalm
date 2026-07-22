"""Phase 5 Scout unit tests — implemented by Plan 05-06.

Validation: AGT-03 (candidate count), AGT-04 (dedup), AGT-18 (tool limit),
AGT-17 (modelVersions recording).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.scout import (
    SCOUT_QUERIES,
    CharityCandidate,
    ScoutBatchOutput,
    _candidate_keys,
    _domain_of,
    discover_candidates,
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


async def test_empty_then_populated_retry(sample_dispatch_state) -> None:
    """Corrective-retry: first acomplete returns empty candidates, second returns 3.

    Scout must call acomplete exactly twice and return the populated batch.
    AGT-17: the retry's resolved_model is recorded in model_versions.
    """
    USAGE = {
        "tokens_in": 100,
        "tokens_out": 50,
        "usd": 0.01,
        "resolved_model": "anthropic/claude-haiku-4-5",
    }
    empty_batch = ScoutBatchOutput(candidates=[])
    populated_batch = ScoutBatchOutput(
        candidates=[_make_candidate(f"Org {i}", f"https://org{i}.example") for i in range(3)]
    )

    acomplete_mock = AsyncMock(side_effect=[(empty_batch, USAGE), (populated_batch, USAGE)])

    with patch(
        "eisenbalm_pipeline.agents.scout.web_search",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout.acomplete",
        acomplete_mock,
    ), patch(
        "eisenbalm_pipeline.agents.scout._load_registry_keys",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout.get_convex_http",
        return_value=object(),
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

    assert acomplete_mock.call_count == 2, "Scout must call acomplete exactly twice on empty-then-retry"
    assert len(result["candidates"]) == 3
    assert result["model_versions"]["scout"] == "anthropic/claude-haiku-4-5"


async def test_empty_twice_then_populated_second_retry(sample_dispatch_state) -> None:
    """Corrective-retry (scout-zero-candidates fix): first two acomplete calls
    return empty candidates, third (second retry) returns 3.

    Scout must call acomplete exactly three times and return the populated
    batch — verifies the widened retry budget (1 initial + 2 retries) added
    to reduce the odds of a fully-empty run dying after only 2 attempts.
    """
    USAGE = {
        "tokens_in": 100,
        "tokens_out": 50,
        "usd": 0.01,
        "resolved_model": "anthropic/claude-haiku-4-5",
    }
    empty_batch = ScoutBatchOutput(candidates=[])
    populated_batch = ScoutBatchOutput(
        candidates=[_make_candidate(f"Org {i}", f"https://org{i}.example") for i in range(3)]
    )

    acomplete_mock = AsyncMock(
        side_effect=[(empty_batch, USAGE), (empty_batch, USAGE), (populated_batch, USAGE)]
    )

    with patch(
        "eisenbalm_pipeline.agents.scout.web_search",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout.acomplete",
        acomplete_mock,
    ), patch(
        "eisenbalm_pipeline.agents.scout._load_registry_keys",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout.get_convex_http",
        return_value=object(),
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

    assert acomplete_mock.call_count == 3, "Scout must call acomplete a third time (second retry) before giving up"
    assert len(result["candidates"]) == 3


async def test_empty_three_times_raises_runtimeerror(sample_dispatch_state) -> None:
    """Corrective-retry: all three acomplete calls return empty candidates.

    Scout must raise a descriptive RuntimeError (not pydantic ValidationError)
    and call acomplete exactly three times (1 initial + 2 retries) before
    giving up.
    """
    USAGE = {
        "tokens_in": 100,
        "tokens_out": 50,
        "usd": 0.01,
        "resolved_model": "anthropic/claude-haiku-4-5",
    }
    empty_batch = ScoutBatchOutput(candidates=[])

    acomplete_mock = AsyncMock(
        side_effect=[(empty_batch, USAGE), (empty_batch, USAGE), (empty_batch, USAGE)]
    )

    with patch(
        "eisenbalm_pipeline.agents.scout.web_search",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout.acomplete",
        acomplete_mock,
    ), patch(
        "eisenbalm_pipeline.agents.scout._load_registry_keys",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout.get_convex_http",
        return_value=object(),
    ):
        with pytest.raises(RuntimeError):
            await scout(sample_dispatch_state)

    assert acomplete_mock.call_count == 3, "Scout must call acomplete exactly three times before giving up"


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


# ── bug scout-zero-candidates: query-pool + instrumentation regression ────
#
# Live repro (2026-07-22, see .planning/debug/resolved/scout-zero-candidates.md)
# proved the original 3 SCOUT_QUERIES reliably surfaced ZERO extractable
# charity content (meta-commentary/listicle/how-to articles about the
# nonprofit sector, never naming a specific org) — a genuinely empty batch
# that no amount of corrective-retry wording could recover from, since every
# retry re-sends the same stale results. 2 site:guidestar.org/profile queries
# (validated live to reliably return named-charity profile content) were
# added to SCOUT_QUERIES as the primary fix. These tests guard against a
# silent revert of that fix and lock in the new empty-batch instrumentation.


def test_scout_queries_include_guidestar_targeted_queries() -> None:
    """Regression guard (scout-zero-candidates): the guidestar.org/profile
    queries added 2026-07-22 must stay present — they are the primary fix
    for the "Tavily batch had zero extractable charities" root cause. Losing
    them silently (e.g. an unrelated refactor reverting SCOUT_QUERIES) would
    reopen the bug without any test failing elsewhere, since the corrective
    retry loop's own tests use mocked acomplete()/web_search() and can't
    detect real-world query-quality regressions.
    """
    assert len(SCOUT_QUERIES) >= 5
    guidestar_queries = [q for q in SCOUT_QUERIES if "guidestar.org/profile" in q]
    assert len(guidestar_queries) == 2, (
        "expected exactly 2 site:guidestar.org/profile-targeted queries in "
        "SCOUT_QUERIES (the scout-zero-candidates root-cause fix)"
    )


def test_scout_queries_within_tool_call_budget() -> None:
    """AGT-18: the real (unpatched) SCOUT_QUERIES must stay <= max_tool_calls
    (8) — adding queries to fix scout-zero-candidates must not itself trip
    the tool-call budget on every real run.
    """
    assert len(SCOUT_QUERIES) <= 8


async def test_empty_first_attempt_logs_tavily_titles(caplog) -> None:
    """Instrumentation regression (scout-zero-candidates follow-up #1): when
    the LLM returns zero candidates on the FIRST attempt, discover_candidates
    must log the actual Tavily titles/URLs at WARNING — this is the evidence
    that let this bug be diagnosed and must not be lost. Previously only
    len(tavily_results) was reported, which couldn't distinguish "well-known
    content correctly rejected" from "no extractable charity at all" (the
    real cause).
    """
    import logging

    tavily_results = [
        SearchResult(
            url="https://example.com/some-article",
            title="A Very Specific Article Title",
            content="...",
            score=0.5,
        ),
    ]
    empty_batch = ScoutBatchOutput(candidates=[])
    populated_batch = ScoutBatchOutput(
        candidates=[_make_candidate("Org 0", "https://org0.example")]
    )
    USAGE = {
        "tokens_in": 10, "tokens_out": 8, "usd": 0.001,
        "resolved_model": "anthropic/claude-haiku-4-5",
    }
    acomplete_mock = AsyncMock(
        side_effect=[(empty_batch, USAGE), (populated_batch, USAGE)]
    )

    with caplog.at_level(logging.WARNING, logger="eisenbalm_pipeline.agents.scout"):
        with patch(
            "eisenbalm_pipeline.agents.scout.web_search",
            AsyncMock(return_value=tavily_results),
        ), patch(
            "eisenbalm_pipeline.agents.scout.acomplete", acomplete_mock,
        ), patch(
            "eisenbalm_pipeline.agents.scout._load_registry_keys",
            AsyncMock(return_value=[]),
        ), patch(
            "eisenbalm_pipeline.agents.scout.get_convex_http",
            return_value=object(),
        ):
            await discover_candidates(run_id="test-instrumentation", config=None)

    matching = [
        r for r in caplog.records
        if "zero candidates on first attempt" in r.message
    ]
    assert matching, "expected a WARNING logging the first-attempt empty batch"
    assert "A Very Specific Article Title" in matching[0].message
    assert "https://example.com/some-article" in matching[0].message
