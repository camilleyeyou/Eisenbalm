"""Phase 5 Editor gate-1 unit tests — implemented by Plan 05-08.

Validation: AGT-06 (winner selection + interrupt threshold), AGT-17.
Editor Final tests land in Plan 05-13.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from langgraph.errors import GraphInterrupt

from eisenbalm_pipeline.agents.editor import (
    EDITOR_CONFIDENCE_THRESHOLD,
    EDITOR_INTERRUPT_THRESHOLD,
    EditorDecision,
    _editor_decision_payload,
    _format_deliberation_transcript,
    _score_gap,
    _sort_candidates_by_score,
    editor_gate_1,
)


def _make_state_with_scored_candidates(scores: list[tuple[str, int]]) -> dict:
    """Build a DispatchState-shaped dict with Advocate-scored candidates.

    Each candidate carries advocateScore + advocateArgument inline (matches
    Phase 4 contract — see CharityCandidate TypedDict in graph/state.py).
    """
    candidates = [
        {
            "name": name,
            "location": "NYC",
            "website": f"https://{name.lower().replace(' ', '-')}.example",
            "charityNavigatorUrl": None,
            "guidestarUrl": None,
            "foundingYear": 2003,
            "assetRange": "$100K-$500K",
            "focusArea": "Education",
            "missionStatement": f"Mission of {name}.",
            "scoutSummary": f"Scout summary of {name}.",
            "whyOverlooked": f"Why {name} is overlooked.",
            "advocateArgument": (
                f"The work of {name} is operationally tight, historically "
                f"continuous, and structurally underserved."
            ),
            "advocateScore": score,
        }
        for name, score in scores
    ]
    return {
        "run_id": "run-test-0008",
        "issue_number": 42,
        "candidates": candidates,
        "model_versions": {},
    }


# ── Pure helpers ──────────────────────────────────────────────────────────


def test_sort_and_gap() -> None:
    sv = _sort_candidates_by_score([
        {"name": "B", "advocateScore": 5},
        {"name": "A", "advocateScore": 9},
    ])
    assert sv[0]["name"] == "A"
    assert _score_gap(sv) == 4.0


def test_sort_tie_break_by_name() -> None:
    """Deterministic tie-break: equal scores sorted by name asc."""
    sv = _sort_candidates_by_score([
        {"name": "B", "advocateScore": 7},
        {"name": "A", "advocateScore": 7},
    ])
    assert sv[0]["name"] == "A"
    assert _score_gap(sv) == 0.0


def test_score_gap_single_candidate() -> None:
    """Single candidate => no second score => infinite gap (no interrupt)."""
    sv = _sort_candidates_by_score([{"name": "A", "advocateScore": 9}])
    assert _score_gap(sv) == float("inf")


def test_thresholds() -> None:
    assert EDITOR_INTERRUPT_THRESHOLD == 1.0
    assert EDITOR_CONFIDENCE_THRESHOLD == 0.7


def test_editor_decision_payload_carries_confidence_and_runner_up_notes() -> None:
    """Phase 37 §37.2: payload gains confidence + runnerUpNotes, keeps winner/rationale."""
    state = {
        "winning_charity": {"name": "HighOrg"},
        "editor_decision": "HighOrg wins on operational rigor.",
        "editor_confidence": 0.87,
        "runner_up_notes": "LowOrg was a fine candidate.",
    }
    payload = _editor_decision_payload(state)
    assert payload["winner"] == "HighOrg"
    assert payload["rationale"] == "HighOrg wins on operational rigor."
    assert payload["confidence"] == 0.87
    assert payload["runnerUpNotes"] == "LowOrg was a fine candidate."


def test_transcript_format() -> None:
    """AGT-06: deliberationTranscript Markdown format (NotebookLM-friendly)."""
    transcript = _format_deliberation_transcript(
        issue_number=42,
        candidates=[
            {
                "name": "Foo",
                "scoutSummary": "obscure",
                "advocateScore": 9,
                "advocateArgument": "Foo is good.",
            }
        ],
        editor_reasoning="Foo is best.",
        confidence=0.9,
        winner_name="Foo",
        runner_up_notes="None.",
    )
    assert "# Eisenbalm Dispatch — Issue #42 Deliberation" in transcript
    assert "## Scout Findings" in transcript
    assert "## Advocate Arguments" in transcript
    assert "## Editor Reasoning" in transcript
    assert "## Decision" in transcript
    assert "**Winner:** Foo" in transcript


# ── Live gate-1 async tests ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_winner_selection_deterministic() -> None:
    """AGT-06: highest-score winner; no interrupt when gap is wide."""
    state = _make_state_with_scored_candidates([("LowOrg", 5), ("HighOrg", 9)])
    decision = EditorDecision(
        winnerName="HighOrg",
        confidence=0.9,
        requiresHumanInput=False,
        editorReasoning="HighOrg wins.",
        runnerUpNotes="LowOrg was a fine candidate.",
        deliberationTranscript="ignored — Python overrides",
    )
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.editor.acomplete",
        AsyncMock(
            return_value=(
                decision,
                {
                    "tokens_in": 100,
                    "tokens_out": 50,
                    "usd": 0.01,
                    "resolved_model": "anthropic/claude-opus-4-7-20251101",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
    ):
        result = await editor_gate_1(state)

    assert result["winning_charity"]["name"] == "HighOrg"
    # interrupt path NOT taken — no awaiting-review write
    awaiting_calls = [
        c
        for c in mock_convex.call_args_list
        if c.args
        and c.args[0] == "pipelineRuns:updateStatus"
        and c.args[1].get("status") == "awaiting-review"
    ]
    assert len(awaiting_calls) == 0
    # Model version recorded (AGT-17)
    assert (
        result["model_versions"]["editor_gate1"]
        == "anthropic/claude-opus-4-7-20251101"
    )
    # Transcript present + format
    assert "## Scout Findings" in result["deliberation_transcript"]
    assert "**Winner:** HighOrg" in result["deliberation_transcript"]
    # Phase 37 §37.2: editor_confidence persisted (was computed then discarded)
    assert result["editor_confidence"] == 0.9


def _interrupt_raises_graph_interrupt(*args, **kwargs) -> None:
    """Stub for langgraph.types.interrupt outside of a runnable context.

    Real LangGraph interrupt() reads configurable state via a contextvar that
    is only set inside a CompiledStateGraph invocation. Outside that
    context, calling interrupt() raises RuntimeError. For unit-test purposes
    we mock interrupt to raise GraphInterrupt directly — the wrapper's
    GraphInterrupt handler is what we are exercising, not LangGraph itself.
    """
    raise GraphInterrupt(())


@pytest.mark.asyncio
async def test_interrupt_threshold_triggers() -> None:
    """AGT-06: narrow gap + low confidence + requiresHumanInput=True triggers interrupt.

    Critically: pipelineRuns:updateStatus 'awaiting-review' MUST be written
    BEFORE interrupt() is raised (Phase 4 D-13 idempotency-before-interrupt).
    """
    state = _make_state_with_scored_candidates([("OrgA", 7), ("OrgB", 7)])
    decision = EditorDecision(
        winnerName="OrgA",
        confidence=0.5,
        requiresHumanInput=True,
        editorReasoning="Too close to call.",
        runnerUpNotes="Either candidate viable.",
        deliberationTranscript="ignored",
    )
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.editor.acomplete",
        AsyncMock(
            return_value=(
                decision,
                {
                    "tokens_in": 100,
                    "tokens_out": 50,
                    "usd": 0.01,
                    "resolved_model": "anthropic/claude-opus-4-7-20251101",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
    ), patch(
        "eisenbalm_pipeline.agents.editor.interrupt",
        _interrupt_raises_graph_interrupt,
    ):
        with pytest.raises(GraphInterrupt):
            await editor_gate_1(state)

    # status='awaiting-review' MUST be written BEFORE interrupt()
    awaiting_calls = [
        c
        for c in mock_convex.call_args_list
        if c.args
        and c.args[0] == "pipelineRuns:updateStatus"
        and c.args[1].get("status") == "awaiting-review"
    ]
    assert len(awaiting_calls) >= 1, (
        "pipelineRuns:updateStatus('awaiting-review') must be written "
        "BEFORE interrupt() (Phase 4 D-13)"
    )


@pytest.mark.asyncio
async def test_interrupt_skipped_when_confident() -> None:
    """AGT-06: narrow gap + HIGH confidence => no interrupt."""
    state = _make_state_with_scored_candidates([("OrgA", 7), ("OrgB", 7)])
    decision = EditorDecision(
        winnerName="OrgA",
        confidence=0.95,
        requiresHumanInput=False,
        editorReasoning="OrgA wins despite tie.",
        runnerUpNotes="OrgB respectable.",
        deliberationTranscript="ignored",
    )
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.editor.acomplete",
        AsyncMock(
            return_value=(
                decision,
                {
                    "tokens_in": 100,
                    "tokens_out": 50,
                    "usd": 0.01,
                    "resolved_model": "anthropic/claude-opus-4-7-20251101",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
    ):
        result = await editor_gate_1(state)

    # No interrupt; deterministic top-score winner picked (alphabetical tie-break)
    assert result["winning_charity"]["name"] == "OrgA"
    # No awaiting-review write
    awaiting_calls = [
        c
        for c in mock_convex.call_args_list
        if c.args
        and c.args[0] == "pipelineRuns:updateStatus"
        and c.args[1].get("status") == "awaiting-review"
    ]
    assert len(awaiting_calls) == 0


@pytest.mark.asyncio
async def test_top_score_overrides_llm_winner() -> None:
    """AGT-06 D-18: deterministic top-score wins even if LLM names another.

    Editor's LLM call returns winnerName=LowOrg with score 5, but the
    deterministic ranking gives HighOrg (score 9). Python overrides.
    """
    state = _make_state_with_scored_candidates([("HighOrg", 9), ("LowOrg", 5)])
    decision = EditorDecision(
        winnerName="LowOrg",  # LLM picks the lower-score one
        confidence=0.9,
        requiresHumanInput=False,
        editorReasoning="I prefer LowOrg.",
        runnerUpNotes="HighOrg also good.",
        deliberationTranscript="ignored",
    )
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.editor.acomplete",
        AsyncMock(
            return_value=(
                decision,
                {
                    "tokens_in": 100,
                    "tokens_out": 50,
                    "usd": 0.01,
                    "resolved_model": "anthropic/claude-opus-4-7-20251101",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
    ):
        result = await editor_gate_1(state)

    # Top-score wins, NOT the LLM's pick
    assert result["winning_charity"]["name"] == "HighOrg"
