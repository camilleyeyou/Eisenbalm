"""Phase 5 Researcher unit tests — implemented by Plan 05-09.

Validation: AGT-07 (founder fields), AGT-18 (tool limit), AGT-17 (modelVersions).
"""
from __future__ import annotations

import logging
from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.researcher import (
    MAX_TOOL_CALLS,
    ClaimOutput,
    ResearchOutputModel,
    researcher,
)
from eisenbalm_pipeline.lib.charity_registry import make_dedup_key
from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded
from eisenbalm_pipeline.lib.search_client import SearchResult


def _make_research(
    founder: str | None = "Jane Doe",
    claims: list[ClaimOutput] | None = None,
) -> ResearchOutputModel:
    return ResearchOutputModel(
        summary="summary text",
        foundingYear=2003,
        annualBudget="$500k",
        founderName=founder,
        founderNameSourceUrl="https://foo.example/about" if founder else None,
        founderRole="founder",
        founderBio="bio text",
        subjectName="Alex Park",
        subjectNameSourceUrl="https://foo.example/stories/alex",
        subjectRole="a program participant",
        subjectStory="story text",
        fundingSources=["donors"],
        claims=claims or [],
    )


@pytest.mark.asyncio
async def test_founder_fields(sample_dispatch_state) -> None:
    """AGT-07: Researcher emits founderName + founderNameSourceUrl."""
    sample_dispatch_state["winning_charity"] = {
        "name": "Foo Org", "website": "https://foo.org",
    }
    out = _make_research("Jane Doe")

    with patch(
        "eisenbalm_pipeline.agents.researcher.web_search",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.researcher.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await researcher(sample_dispatch_state)

    assert result["research"]["founderName"] == "Jane Doe"
    assert result["research"]["founderNameSourceUrl"] == "https://foo.example/about"
    assert result["research"]["subjectName"] == "Alex Park"
    assert result["research"]["founderRole"] == "founder"


@pytest.mark.asyncio
async def test_max_tool_calls_constant() -> None:
    assert MAX_TOOL_CALLS == 12


@pytest.mark.asyncio
async def test_tool_limit_exceeded(sample_dispatch_state) -> None:
    """AGT-18: Researcher raises AgentToolCallLimitExceeded when >12 queries."""
    sample_dispatch_state["winning_charity"] = {"name": "Foo", "website": ""}
    thirteen_queries = [f"q{i}" for i in range(13)]

    with patch(
        "eisenbalm_pipeline.agents.researcher._build_queries",
        return_value=thirteen_queries,
    ), patch(
        "eisenbalm_pipeline.agents.researcher.web_search",
        AsyncMock(return_value=[]),
    ):
        with pytest.raises(AgentToolCallLimitExceeded):
            await researcher(sample_dispatch_state)


@pytest.mark.asyncio
async def test_model_version_recorded(sample_dispatch_state) -> None:
    """AGT-17: model_versions['researcher'] populated."""
    sample_dispatch_state["winning_charity"] = {"name": "Foo", "website": ""}
    out = _make_research()
    with patch(
        "eisenbalm_pipeline.agents.researcher.web_search",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.researcher.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6-20251101",
        })),
    ):
        result = await researcher(sample_dispatch_state)
    assert result["model_versions"]["researcher"] == "anthropic/claude-sonnet-4-6-20251101"


# ── PRV-01: index-bound claims (Phase 35 Plan 02) ───────────────────────────


@pytest.mark.asyncio
async def test_claims_index_binding(sample_dispatch_state) -> None:
    """A claim with a valid sourceIndex maps to the real Tavily URL at that
    position + a code-stamped int retrievedAt (never an LLM-written URL)."""
    sample_dispatch_state["winning_charity"] = {
        "name": "Foo Org", "website": "https://foo.org",
    }
    results = [
        SearchResult(url="https://foo.example/one", title="One", content="c1", score=0.9),
        SearchResult(url="https://foo.example/two", title="Two", content="c2", score=0.8),
    ]
    out = _make_research(claims=[ClaimOutput(text="$2.3M budget", sourceIndex=0)])

    with patch(
        "eisenbalm_pipeline.agents.researcher.web_search",
        AsyncMock(return_value=results),
    ), patch(
        "eisenbalm_pipeline.agents.researcher.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await researcher(sample_dispatch_state)

    claims = result["research"]["claims"]
    assert len(claims) == 1
    assert claims[0]["text"] == "$2.3M budget"
    assert claims[0]["sourceUrl"] == results[0].url
    assert isinstance(claims[0]["retrievedAt"], int)


@pytest.mark.asyncio
async def test_claims_out_of_range_or_none_index_is_honestly_unsourced(
    sample_dispatch_state,
) -> None:
    """An out-of-range or absent sourceIndex yields sourceUrl=None AND
    retrievedAt=None — never a fabricated or best-guess URL."""
    sample_dispatch_state["winning_charity"] = {
        "name": "Foo Org", "website": "https://foo.org",
    }
    results = [
        SearchResult(url="https://foo.example/one", title="One", content="c1", score=0.9),
    ]
    out = _make_research(claims=[
        ClaimOutput(text="out of range claim", sourceIndex=99),
        ClaimOutput(text="no source claim", sourceIndex=None),
    ])

    with patch(
        "eisenbalm_pipeline.agents.researcher.web_search",
        AsyncMock(return_value=results),
    ), patch(
        "eisenbalm_pipeline.agents.researcher.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await researcher(sample_dispatch_state)

    claims = result["research"]["claims"]
    assert len(claims) == 2
    for claim in claims:
        assert claim["sourceUrl"] is None
        assert claim["retrievedAt"] is None


@pytest.mark.asyncio
async def test_claim_ids_unique_and_non_empty(sample_dispatch_state) -> None:
    """Every mapped claim carries a non-empty, collision-free claimId."""
    sample_dispatch_state["winning_charity"] = {
        "name": "Foo Org", "website": "https://foo.org",
    }
    results = [
        SearchResult(url="https://foo.example/one", title="One", content="c1", score=0.9),
    ]
    out = _make_research(claims=[
        ClaimOutput(text="a", sourceIndex=0),
        ClaimOutput(text="b", sourceIndex=None),
        ClaimOutput(text="c", sourceIndex=99),
    ])

    with patch(
        "eisenbalm_pipeline.agents.researcher.web_search",
        AsyncMock(return_value=results),
    ), patch(
        "eisenbalm_pipeline.agents.researcher.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await researcher(sample_dispatch_state)

    ids = [c["claimId"] for c in result["research"]["claims"]]
    assert all(ids)
    assert len(set(ids)) == len(ids)


def test_key_statistics_field_removed() -> None:
    """D-02: keyStatistics is absorbed by the claims list and removed."""
    assert "keyStatistics" not in ResearchOutputModel.model_fields


# ── MEM-03: corrections read + injection + log line (Phase 39 Plan 04) ─────


@pytest.mark.asyncio
async def test_researcher_reads_and_injects_corrections(sample_dispatch_state, caplog) -> None:
    """MEM-03/D-08/D-09/D-10: the Researcher computes the dedupKey via the
    shared make_dedup_key (NOT a reimplementation), reads
    charityCorrections:listByCharityKey for that key, and injects both
    corrections' text into the messages passed to acomplete — logging the
    count read so a repeat-charity run demonstrably shows the re-read."""
    sample_dispatch_state["winning_charity"] = {
        "name": "Acme Trust", "website": "https://acme.org",
    }
    expected_key = make_dedup_key("Acme Trust", "https://acme.org")
    correction_rows = [
        {"text": "Founder is anonymous per 2024 filing"},
        {"text": "AUM figure was wrong; use $4.2M"},
    ]
    out = _make_research()

    mock_convex_query_safe = AsyncMock(return_value=correction_rows)
    mock_acomplete = AsyncMock(return_value=(out, {
        "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
        "resolved_model": "anthropic/claude-sonnet-4-6",
    }))

    with patch(
        "eisenbalm_pipeline.agents.researcher.web_search",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.researcher.convex_query_safe",
        mock_convex_query_safe,
    ), patch(
        "eisenbalm_pipeline.agents.researcher.acomplete",
        mock_acomplete,
    ), caplog.at_level(logging.INFO):
        await researcher(sample_dispatch_state)

    mock_convex_query_safe.assert_awaited_once_with(
        "charityCorrections:listByCharityKey",
        {"workspace_id": "eisenbalm", "charityKey": expected_key},
    )

    messages = mock_acomplete.call_args.kwargs["messages"]
    serialized = str(messages)
    for row in correction_rows:
        assert row["text"] in serialized

    assert any("read 2 correction" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_researcher_corrections_fail_open_when_convex_down(
    sample_dispatch_state, caplog,
) -> None:
    """MEM-03/D-10 fail-open: Convex unreachable (convex_query_safe returns
    None) — the Researcher still completes normally and logs a 0-corrections
    / none-found line rather than crashing."""
    sample_dispatch_state["winning_charity"] = {
        "name": "Acme Trust", "website": "https://acme.org",
    }
    out = _make_research()

    with patch(
        "eisenbalm_pipeline.agents.researcher.web_search",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.researcher.convex_query_safe",
        AsyncMock(return_value=None),
    ), patch(
        "eisenbalm_pipeline.agents.researcher.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ), caplog.at_level(logging.INFO):
        result = await researcher(sample_dispatch_state)

    assert result["research"]["summary"] == "summary text"
    assert any(
        "none found" in r.message or "read 0 correction" in r.message
        for r in caplog.records
    )
