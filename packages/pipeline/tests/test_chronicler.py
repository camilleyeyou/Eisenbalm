"""Phase 13 Wave 0 — Chronicler unit tests.

Covers DEL-CONV-01 substrate:
  - Well-formed structured turns (speaker + text keys, correct speakers)
  - Faithful dramatization (charity name + advocate score reach the prompt)
  - Fallback preserves deliberation_transcript when LLM fails
  - model_versions['chronicler'] recorded (AGT-17)

These tests are SKIP-GUARDED until the chronicler module exists (Plan 13-02).
The guard fires at collection time so `pytest --collect-only` exits 0.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

try:
    from eisenbalm_pipeline.agents.chronicler import chronicler  # noqa: F401
    CHRONICLER_AVAILABLE = True
except ImportError:
    CHRONICLER_AVAILABLE = False


# ── helpers ──────────────────────────────────────────────────────────────


def _minimal_state(charity_name: str = "The Quiet Foundation", extra: dict | None = None) -> dict:
    """Build a DispatchState-shaped dict with the fields chronicler needs."""
    state: dict = {
        "run_id": "run-chron-test-001",
        "issue_number": 99,
        "candidates": [
            {
                "name": charity_name,
                "location": "NYC",
                "scoutSummary": f"Scout summary for {charity_name}.",
                "whyOverlooked": "Overlooked because small.",
                "advocateArgument": "Strong operational track record.",
                "advocateScore": 7,
            },
            {
                "name": "Second Hope Society",
                "location": "Chicago",
                "scoutSummary": "Scout summary for Second Hope.",
                "whyOverlooked": "Overlooked due to geography.",
                "advocateArgument": "Decent but outcompeted.",
                "advocateScore": 5,
            },
        ],
        "winning_charity": {
            "name": charity_name,
            "location": "NYC",
            "scoutSummary": f"Scout summary for {charity_name}.",
            "advocateScore": 7,
        },
        "editor_decision": f"{charity_name} was selected for its operational clarity.",
        "runner_up_notes": "Second Hope is geographically constrained.",
        "deliberation_transcript": "EDITOR_TEMPLATE_TRANSCRIPT",
        "model_versions": {},
    }
    if extra:
        state.update(extra)
    return state


class _FakeChroniclerOutput:
    """Minimal stand-in for ChroniclerOutput Pydantic model (Plan 13-02 defines the real one)."""

    def __init__(self, turns: list[dict]) -> None:
        self.turns = turns


def _make_mock_turns(n: int = 10) -> list[dict]:
    """Generate n alternating scout/advocate/editor turns."""
    speakers = ["scout", "advocate", "editor"]
    return [
        {"speaker": speakers[i % 3], "text": f"Turn {i} by {speakers[i % 3]}."}
        for i in range(n)
    ]


# ── Wave 0 tests (skip until Plan 13-02 implements chronicler) ────────────


@pytest.mark.skipif(not CHRONICLER_AVAILABLE, reason="Wave 2: chronicler not yet implemented")
@pytest.mark.asyncio
async def test_chronicler_produces_wellformed_turns() -> None:
    """DEL-CONV-01: chronicler returns deliberation_conversation with ≥8 well-formed turns.

    Each turn must have exactly the keys {"speaker", "text"}.
    speaker must be one of {scout, advocate, editor}.
    """
    fake_turns = _make_mock_turns(10)
    mock_output = _FakeChroniclerOutput(turns=fake_turns)

    with patch(
        "eisenbalm_pipeline.agents.chronicler.acomplete",
        new=AsyncMock(return_value=(mock_output, {"resolved_model": "anthropic/claude-opus-4", "tokens_in": 100, "tokens_out": 200, "usd": 0.01})),
    ):
        state = _minimal_state()
        result = await chronicler(state)

    assert "deliberation_conversation" in result
    turns = result["deliberation_conversation"]
    assert isinstance(turns, list)
    assert len(turns) >= 8

    valid_speakers = {"scout", "advocate", "editor"}
    for turn in turns:
        assert set(turn.keys()) == {"speaker", "text"}, f"Unexpected keys in turn: {turn.keys()}"
        assert turn["speaker"] in valid_speakers, f"Unknown speaker: {turn['speaker']}"
        assert isinstance(turn["text"], str)
        assert turn["text"].strip()  # non-empty


@pytest.mark.skipif(not CHRONICLER_AVAILABLE, reason="Wave 2: chronicler not yet implemented")
@pytest.mark.asyncio
async def test_turn_faithfulness() -> None:
    """DEL-CONV-01 (D-14): charity name + advocate score reach the Chronicler user prompt.

    Faithful dramatization means the Chronicler must incorporate REAL data —
    it must not hallucinate a different charity name or score.
    """
    charity_name = "Fermented Futures Alliance"
    captured_messages: list[list[dict]] = []

    async def capture_acomplete(**kwargs: object) -> tuple:
        captured_messages.append(kwargs.get("messages", []))  # type: ignore[arg-type]
        fake_turns = [
            {"speaker": "scout", "text": f"I found {charity_name}."},
            {"speaker": "advocate", "text": "Score 7 out of 10."},
            {"speaker": "editor", "text": "Selected."},
        ]
        return (_FakeChroniclerOutput(turns=fake_turns), {"resolved_model": "anthropic/claude-opus-4", "tokens_in": 50, "tokens_out": 100, "usd": 0.005})

    with patch("eisenbalm_pipeline.agents.chronicler.acomplete", new=capture_acomplete):
        state = _minimal_state(charity_name=charity_name)
        await chronicler(state)

    assert captured_messages, "acomplete was never called — chronicler must call acomplete"
    # Flatten all message content into one string for assertion
    all_content = " ".join(
        msg.get("content", "")
        for msgs in captured_messages
        for msg in msgs
    )
    assert charity_name in all_content, (
        f"Charity name '{charity_name}' not found in acomplete messages — "
        "Chronicler must pass the real charity name into the prompt for faithful dramatization."
    )
    assert "7" in all_content, (
        "Advocate score '7' not found in acomplete messages — "
        "Chronicler must pass the real advocate score into the prompt for faithful dramatization."
    )


@pytest.mark.skipif(not CHRONICLER_AVAILABLE, reason="Wave 2: chronicler not yet implemented")
@pytest.mark.asyncio
async def test_fallback_preserves_transcript() -> None:
    """DEL-CONV-01 (D-18): when acomplete raises, deliberation_transcript is NOT overwritten.

    The returned dict must NOT set deliberation_transcript to None.
    deliberation_conversation must be None or absent (indicating fallback triggered).
    """
    sentinel = "EDITOR_TEMPLATE_TRANSCRIPT"
    state = _minimal_state()
    state["deliberation_transcript"] = sentinel

    with patch(
        "eisenbalm_pipeline.agents.chronicler.acomplete",
        new=AsyncMock(side_effect=Exception("LLM failure")),
    ):
        result = await chronicler(state)

    # deliberation_conversation must be None or absent — not a list of turns
    conv = result.get("deliberation_conversation")
    assert conv is None or (isinstance(conv, list) and len(conv) == 0), (
        "On LLM failure, deliberation_conversation must be None (fallback mode). "
        f"Got: {conv!r}"
    )

    # deliberation_transcript must NOT be set to None by the chronicler fallback
    if "deliberation_transcript" in result:
        assert result["deliberation_transcript"] is not None, (
            "Chronicler fallback must not overwrite deliberation_transcript with None."
        )
        assert result["deliberation_transcript"] == sentinel, (
            "Chronicler fallback must not replace the existing deliberation_transcript sentinel."
        )


@pytest.mark.skipif(not CHRONICLER_AVAILABLE, reason="Wave 2: chronicler not yet implemented")
@pytest.mark.asyncio
async def test_model_versions_recorded() -> None:
    """DEL-CONV-01 (AGT-17): model_versions['chronicler'] is written after successful call."""
    resolved = "anthropic/claude-opus-4"
    mock_output = _FakeChroniclerOutput(turns=_make_mock_turns(8))

    with patch(
        "eisenbalm_pipeline.agents.chronicler.acomplete",
        new=AsyncMock(return_value=(mock_output, {"resolved_model": resolved, "tokens_in": 100, "tokens_out": 200, "usd": 0.01})),
    ):
        state = _minimal_state()
        result = await chronicler(state)

    model_versions = result.get("model_versions") or {}
    assert "chronicler" in model_versions, (
        "model_versions['chronicler'] must be set after a successful Chronicler call (AGT-17)."
    )
    assert model_versions["chronicler"] == resolved
