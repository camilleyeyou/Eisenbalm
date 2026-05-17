"""Phase 5 Advocate unit tests — implemented by Plan 05-07.

Validation: AGT-05 (scores written + events emitted), AGT-17 (modelVersions).

Note: Convex schema requires vote='for'|'against'|'abstain' and a
denormalized charityName field (convex/schema.ts agentVotes table).
API_CONTRACTS §3.5 confirms vote='for'. Plan 05-07 prose referenced
'yes' — superseded by canonical schema per CLAUDE.md.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.advocate import (
    AdvocateOutput,
    AdvocateVote,
    _charity_id_for,
    advocate,
)


def _make_votes(scores: list[int]) -> AdvocateOutput:
    return AdvocateOutput(
        votes=[
            AdvocateVote(
                charityName=f"Org {i}",
                score=s,
                argument="x" * 200,
                keyStrengths=["strength-a", "strength-b"],
                primaryConcern="concern",
            )
            for i, s in enumerate(scores)
        ]
    )


def test_charity_id_for() -> None:
    """_charity_id_for matches Scout's deterministic Sanity _id (python-slugify)."""
    assert _charity_id_for("Foo Org") == "charity-foo-org"
    # python-slugify collapses repeated whitespace (matches Scout's
    # lib/sanity_client.write_charity slug pattern)
    assert _charity_id_for("Bar  Org") == "charity-bar-org"
    # Punctuation is dropped
    assert _charity_id_for("A & B!") == "charity-a-b"


@pytest.mark.asyncio
async def test_scoring(sample_dispatch_state) -> None:
    """AGT-05: each candidate scored 1-10; votes returned in state."""
    sample_dispatch_state["candidates"] = [
        {"name": "Org 0"},
        {"name": "Org 1"},
        {"name": "Org 2"},
    ]
    out = _make_votes([7, 5, 9])
    mock_convex = AsyncMock()

    with patch(
        "eisenbalm_pipeline.agents.advocate.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 100, "tokens_out": 50, "usd": 0.01,
            "resolved_model": "anthropic/claude-haiku-4-5",
        })),
    ), patch(
        "eisenbalm_pipeline.agents.advocate.convex_mutation_safe", mock_convex,
    ):
        result = await advocate(sample_dispatch_state)

    assert len(result["advocate_votes"]) == 3
    scores = [v["score"] for v in result["advocate_votes"]]
    assert scores == [7, 5, 9]


@pytest.mark.asyncio
async def test_agent_votes_written(sample_dispatch_state) -> None:
    """AGT-05: agentVotes:insert called once per candidate (vote='for')."""
    sample_dispatch_state["candidates"] = [{"name": "Org 0"}, {"name": "Org 1"}]
    out = _make_votes([8, 6])
    mock_convex = AsyncMock()

    with patch(
        "eisenbalm_pipeline.agents.advocate.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-haiku-4-5",
        })),
    ), patch(
        "eisenbalm_pipeline.agents.advocate.convex_mutation_safe", mock_convex,
    ):
        await advocate(sample_dispatch_state)

    agent_votes_calls = [
        c for c in mock_convex.call_args_list
        if c.args and c.args[0] == "agentVotes:insert"
    ]
    assert len(agent_votes_calls) == 2
    # Canonical Convex schema: vote='for' (API_CONTRACTS §3.5)
    assert all(c.args[1]["vote"] == "for" for c in agent_votes_calls)
    # Denormalized charityName required by Convex schema
    assert {c.args[1]["charityName"] for c in agent_votes_calls} == {"Org 0", "Org 1"}
    # agentId always 'advocate'
    assert all(c.args[1]["agentId"] == "advocate" for c in agent_votes_calls)
    # reasoning = the AdvocateVote argument (full text)
    assert all(len(c.args[1]["reasoning"]) > 100 for c in agent_votes_calls)
    # Convex agentVotes schema does NOT have a score field — score lives on
    # the deliberationEvents payload (see test_argument_event_emitted)
    assert all("score" not in c.args[1] for c in agent_votes_calls)


@pytest.mark.asyncio
async def test_argument_event_emitted(sample_dispatch_state) -> None:
    """AGT-05: deliberationEvents:insert eventType='advocate-argument' per candidate."""
    sample_dispatch_state["candidates"] = [{"name": "Org 0"}, {"name": "Org 1"}]
    out = _make_votes([8, 6])
    mock_convex = AsyncMock()

    with patch(
        "eisenbalm_pipeline.agents.advocate.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-haiku-4-5",
        })),
    ), patch(
        "eisenbalm_pipeline.agents.advocate.convex_mutation_safe", mock_convex,
    ):
        await advocate(sample_dispatch_state)

    event_calls = [
        c for c in mock_convex.call_args_list
        if c.args
        and c.args[0] == "deliberationEvents:insert"
        and c.args[1].get("eventType") == "advocate-argument"
    ]
    assert len(event_calls) == 2
    # charityId on each event row (optional but recommended for filtering)
    assert all("charityId" in c.args[1] for c in event_calls)
    # Score lives on the deliberation-event payload (NOT on agentVotes row)
    import json as _json
    payloads = [_json.loads(c.args[1]["payload"]) for c in event_calls]
    assert {p["score"] for p in payloads} == {8, 6}
    assert {p["charityName"] for p in payloads} == {"Org 0", "Org 1"}


@pytest.mark.asyncio
async def test_model_version_recorded(sample_dispatch_state) -> None:
    """AGT-17: model_versions['advocate'] set after run."""
    sample_dispatch_state["candidates"] = [{"name": "Org 0"}]
    out = _make_votes([7])

    with patch(
        "eisenbalm_pipeline.agents.advocate.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-haiku-4-5-20251001",
        })),
    ), patch(
        "eisenbalm_pipeline.agents.advocate.convex_mutation_safe", AsyncMock(),
    ):
        result = await advocate(sample_dispatch_state)

    assert result["model_versions"]["advocate"] == "anthropic/claude-haiku-4-5-20251001"
