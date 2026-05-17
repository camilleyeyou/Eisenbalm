"""Phase 5 Researcher unit tests — implemented by Plan 05-09.

Validation: AGT-07 (founder fields), AGT-18 (tool limit), AGT-17 (modelVersions).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.researcher import (
    MAX_TOOL_CALLS,
    ResearchOutputModel,
    researcher,
)
from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded


def _make_research(founder: str | None = "Jane Doe") -> ResearchOutputModel:
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
        keyStatistics=["a", "b"],
        fundingSources=["donors"],
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
