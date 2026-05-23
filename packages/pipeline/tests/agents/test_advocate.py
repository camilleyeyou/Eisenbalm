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


# ── Regression tests for EG3-01: robust vote-to-candidate matching ────────


@pytest.mark.asyncio
async def test_score_attaches_despite_name_normalization(sample_dispatch_state) -> None:
    """Regression: LLM-normalized charityName must still attach to the right
    Scout candidate (positional match), not collapse to 0.

    The bug: when the LLM drops "The" from a charity name (e.g. Scout has
    "The Foo Foundation", LLM emits "Foo Foundation"), EXACT name matching
    collapses every score to 0 and editor.py falls back to alphabetical
    tiebreak, picking the wrong winner.

    Fix: positional alignment (primary path) resolves this because the
    prompt guarantees votes in the same order as the input candidates list.
    """
    sample_dispatch_state["candidates"] = [
        {"name": "The Foo Foundation"},
        {"name": "Bar Org"},
    ]
    out = AdvocateOutput(votes=[
        AdvocateVote(
            charityName="Foo Foundation",  # LLM dropped "The"
            score=9,
            argument="x" * 200,
            keyStrengths=["a", "b"],
            primaryConcern="concern-foo",
        ),
        AdvocateVote(
            charityName="Bar Org",
            score=4,
            argument="y" * 200,
            keyStrengths=["c"],
            primaryConcern="concern-bar",
        ),
    ])
    with patch(
        "eisenbalm_pipeline.agents.advocate.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-haiku-4-5",
        })),
    ), patch(
        "eisenbalm_pipeline.agents.advocate.convex_mutation_safe", AsyncMock(),
    ):
        result = await advocate(sample_dispatch_state)

    cands = result["candidates"]
    # Scores land on the RIGHT candidate by position, NON-ZERO.
    assert cands[0]["name"] == "The Foo Foundation"
    assert cands[0]["advocateScore"] == 9, (
        "Score must be 9 (not 0) even though LLM emitted 'Foo Foundation' "
        "instead of 'The Foo Foundation'"
    )
    assert cands[1]["name"] == "Bar Org"
    assert cands[1]["advocateScore"] == 4
    # keyStrengths and primaryConcern must propagate onto each candidate dict.
    assert cands[0]["keyStrengths"] == ["a", "b"]
    assert cands[0]["primaryConcern"] == "concern-foo"
    assert cands[1]["keyStrengths"] == ["c"]
    assert cands[1]["primaryConcern"] == "concern-bar"
    # advocateArgument also propagated.
    assert cands[0]["advocateArgument"] == "x" * 200
    assert cands[1]["advocateArgument"] == "y" * 200


@pytest.mark.asyncio
async def test_slugify_fallback_when_count_differs(sample_dispatch_state) -> None:
    """Regression: slugify-keyed fallback when len(votes) != len(candidates).

    Force len mismatch by emitting 3 votes for 2 candidates. The fallback
    branch uses slugify on charityName and candidate name to match; it
    collapses punctuation/casing/whitespace that positional can't help with.

    Uses normalization slugify actually collapses: punctuation + casing.
    Scout candidate "A & B!" vs LLM charityName "a b" both slugify to "a-b".
    """
    sample_dispatch_state["candidates"] = [
        {"name": "A & B!"},   # slugify -> "a-b"
        {"name": "Zeta Org"}, # slugify -> "zeta-org"
    ]
    # 3 votes for 2 candidates → fallback branch activates.
    out = AdvocateOutput(votes=[
        AdvocateVote(
            charityName="a b",     # slugify -> "a-b" (matches "A & B!")
            score=7,
            argument="p" * 200,
            keyStrengths=["strength-x"],
            primaryConcern="concern-ab",
        ),
        AdvocateVote(
            charityName="Zeta Org",  # slugify -> "zeta-org" (exact)
            score=3,
            argument="q" * 200,
            keyStrengths=["strength-y"],
            primaryConcern="concern-zeta",
        ),
        AdvocateVote(
            charityName="Extra Duplicate",  # extra vote — forces count mismatch
            score=5,
            argument="r" * 200,
            keyStrengths=["strength-z"],
            primaryConcern="concern-extra",
        ),
    ])
    with patch(
        "eisenbalm_pipeline.agents.advocate.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-haiku-4-5",
        })),
    ), patch(
        "eisenbalm_pipeline.agents.advocate.convex_mutation_safe", AsyncMock(),
    ):
        result = await advocate(sample_dispatch_state)

    cands = result["candidates"]
    # "A & B!" matches "a b" via slugify (both -> "a-b").
    assert cands[0]["name"] == "A & B!"
    assert cands[0]["advocateScore"] == 7, (
        "Slug fallback must match 'A & B!' to 'a b' (both -> 'a-b') "
        "and attach score=7, not collapse to 0"
    )
    assert cands[0]["keyStrengths"] == ["strength-x"]
    assert cands[0]["primaryConcern"] == "concern-ab"
    # "Zeta Org" matches exactly via slug.
    assert cands[1]["name"] == "Zeta Org"
    assert cands[1]["advocateScore"] == 3
    assert cands[1]["keyStrengths"] == ["strength-y"]
    assert cands[1]["primaryConcern"] == "concern-zeta"
