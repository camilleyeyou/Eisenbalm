"""Phase 38 Plan 03 — RED/GREEN tests for the pure ``discover_candidates()``.

Covers the plan's 3 behaviors:

  1. ``discover_candidates(run_id="shadow-x", config=None)`` in
     stub/monkeypatched mode returns ``(surviving, featured_keys, usage)``
     with the dedup filter applied.
  2. ``discover_candidates`` never calls ``write_charity`` or
     ``convex_mutation_safe`` — it is a pure, no-write function (D-12 seam
     that Plan 38-03's shadow-run endpoint depends on).
  3. ``scout()`` still calls ``discover_candidates`` then performs its
     existing writes (write_charity + convex_mutation_safe) — the refactor
     preserves scout()'s real-run behavior.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

from eisenbalm_pipeline.agents.scout import (
    CharityCandidate,
    ScoutBatchOutput,
    discover_candidates,
    scout,
)
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


async def test_discover_candidates_returns_surviving_dedup_applied() -> None:
    """Behavior 1: discover_candidates returns (surviving, featured_keys, usage)
    with the Python dedup filter applied against the registry keys."""
    featured = ["foo org", "foo.example"]
    cands = [
        _make_candidate("Foo Org", "https://foo.example"),
        _make_candidate("Bar Org", "https://bar.example"),
        _make_candidate("Baz Org", "https://baz.example"),
        _make_candidate("Qux Org", "https://qux.example"),
    ]
    batch = ScoutBatchOutput(candidates=cands)
    usage = {
        "tokens_in": 10,
        "tokens_out": 5,
        "usd": 0.001,
        "resolved_model": "anthropic/claude-haiku-4-5",
    }

    with patch(
        "eisenbalm_pipeline.agents.scout.web_search",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout.acomplete",
        AsyncMock(return_value=(batch, usage)),
    ), patch(
        "eisenbalm_pipeline.agents.scout._load_registry_keys",
        AsyncMock(return_value=featured),
    ), patch(
        "eisenbalm_pipeline.agents.scout.get_convex_http",
        return_value=object(),  # non-None sentinel so the None branch isn't taken
    ):
        surviving, featured_keys, returned_usage = await discover_candidates(
            run_id="shadow-x", config=None
        )

    names = {c["name"] for c in surviving}
    assert "Foo Org" not in names, "dedup must drop the matched name"
    assert {"Bar Org", "Baz Org", "Qux Org"}.issubset(names)
    assert featured_keys == featured
    assert returned_usage["resolved_model"] == "anthropic/claude-haiku-4-5"


async def test_discover_candidates_never_writes() -> None:
    """Behavior 2 (D-12 seam): discover_candidates makes NO call to
    write_charity or convex_mutation_safe — it is pure discovery only."""
    tavily_results = [
        SearchResult(
            url=f"https://org{i}.example", title=f"Org {i}", content="...", score=0.9
        )
        for i in range(3)
    ]
    cands = [_make_candidate(f"Org {i}", f"https://org{i}.example") for i in range(3)]
    batch = ScoutBatchOutput(candidates=cands)
    usage = {
        "tokens_in": 10,
        "tokens_out": 5,
        "usd": 0.001,
        "resolved_model": "anthropic/claude-haiku-4-5",
    }

    write_charity_spy = AsyncMock()
    convex_mutation_safe_spy = AsyncMock()

    with patch(
        "eisenbalm_pipeline.agents.scout.web_search",
        AsyncMock(return_value=tavily_results),
    ), patch(
        "eisenbalm_pipeline.agents.scout.acomplete",
        AsyncMock(return_value=(batch, usage)),
    ), patch(
        "eisenbalm_pipeline.agents.scout._load_registry_keys",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout.get_convex_http",
        return_value=object(),
    ), patch(
        "eisenbalm_pipeline.agents.scout.write_charity", write_charity_spy
    ), patch(
        "eisenbalm_pipeline.agents.scout.convex_mutation_safe",
        convex_mutation_safe_spy,
    ):
        surviving, _featured_keys, _usage = await discover_candidates(
            run_id="shadow-y", config=None
        )

    assert len(surviving) == 3
    write_charity_spy.assert_not_called()
    convex_mutation_safe_spy.assert_not_called()


async def test_scout_calls_discover_candidates_then_writes(sample_dispatch_state) -> None:
    """Behavior 3: the real scout() node still calls discover_candidates()
    then performs its existing Sanity + Convex writes unchanged."""
    surviving = [
        _make_candidate(f"Org {i}", f"https://org{i}.example").model_dump()
        for i in range(3)
    ]
    featured_keys = ["blocked org"]
    usage = {
        "tokens_in": 10,
        "tokens_out": 5,
        "usd": 0.001,
        "resolved_model": "anthropic/claude-haiku-4-5",
    }
    discover_mock = AsyncMock(return_value=(surviving, featured_keys, usage))
    write_charity_spy = AsyncMock(
        side_effect=lambda http, c: f"charity-{c['name'].lower().replace(' ', '-')}"
    )
    convex_mutation_safe_spy = AsyncMock()

    with patch(
        "eisenbalm_pipeline.agents.scout.discover_candidates", discover_mock
    ), patch(
        "eisenbalm_pipeline.agents.scout.get_sanity_http", return_value=None
    ), patch(
        "eisenbalm_pipeline.agents.scout.write_charity", write_charity_spy
    ), patch(
        "eisenbalm_pipeline.agents.scout.convex_mutation_safe",
        convex_mutation_safe_spy,
    ):
        result = await scout(sample_dispatch_state)

    discover_mock.assert_awaited_once_with(
        run_id=sample_dispatch_state["run_id"],
        config=sample_dispatch_state.get("config"),
    )
    assert write_charity_spy.await_count == 3, "scout() must write_charity for every surviving candidate"
    assert result["candidates"] == surviving
    assert result["featured_charity_keys"] == featured_keys
    assert result["model_versions"]["scout"] == "anthropic/claude-haiku-4-5"
