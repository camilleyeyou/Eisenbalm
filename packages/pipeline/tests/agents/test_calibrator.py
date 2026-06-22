"""Phase 5 Calibrator unit tests — implemented by Plan 05-05.

Validation: AGT-01 (bonusType rotation), AGT-02 (VOICE_CONSTRAINTS embedded),
AGT-17 (modelVersions recording).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.calibrator import (
    BONUS_TYPES,
    StyleBriefOutput,
    _build_messages,
    _pick_bonus_type,
    calibrator,
)
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


def test_bonus_rotation() -> None:
    """AGT-01: rotation never picks the most-recent bonusType; deterministic."""
    # Most-recent = jingle; must pick bigBudget or specAd
    for issue_no in range(10):
        choice = _pick_bonus_type(["jingle", "bigBudget", "specAd"], issue_no)
        assert choice != "jingle", f"issue {issue_no}: picked most-recent"
        assert choice in BONUS_TYPES

    # Deterministic: re-running same inputs gives same output
    assert _pick_bonus_type(["jingle"], 42) == _pick_bonus_type(["jingle"], 42)
    assert _pick_bonus_type(["bigBudget"], 42) == _pick_bonus_type(["bigBudget"], 42)


def test_bonus_rotation_first_issue() -> None:
    """AGT-01: empty previousBonusTypes (first-ever issue) still produces valid pick."""
    choice = _pick_bonus_type([], 1)
    assert choice in BONUS_TYPES


def test_voice_constants() -> None:
    """AGT-02: assembled system prompt embeds VOICE_CONSTRAINTS verbatim."""
    messages = _build_messages(
        state={},
        issue_number=42,
        previous_bonus_types=["jingle"],
        chosen_bonus_type="bigBudget",
    )
    system_prompt = messages[0]["content"]
    assert VOICE_CONSTRAINTS in system_prompt, \
        "VOICE_CONSTRAINTS must appear verbatim in Calibrator system prompt"


async def test_calibrator_records_model_version(sample_dispatch_state) -> None:
    """AGT-17: state['model_versions']['calibrator'] set after run.

    Patches acomplete to return a deterministic StyleBriefOutput + usage dict;
    patches _fetch_previous_bonus_types so no Sanity round-trip is made.
    """
    brief = StyleBriefOutput(
        voice=VOICE_CONSTRAINTS,
        constraints=["a", "b", "c"],
        bonusType="bigBudget",
        visualDirection="warm cream",
    )
    fake_acomplete = AsyncMock(return_value=(brief, {
        "tokens_in": 100,
        "tokens_out": 50,
        "usd": 0.01,
        "resolved_model": "anthropic/claude-opus-4-7-20251101",
    }))

    with patch("eisenbalm_pipeline.agents.calibrator.acomplete", fake_acomplete), \
         patch("eisenbalm_pipeline.agents.calibrator._fetch_previous_bonus_types",
               AsyncMock(return_value=["jingle"])):
        result = await calibrator(sample_dispatch_state)

    assert "calibrator" in result["model_versions"]
    assert result["model_versions"]["calibrator"] == "anthropic/claude-opus-4-7-20251101"
    # Rotation excluded 'jingle' (the most-recent).
    assert result["style_brief"]["bonusType"] != "jingle"
    # previousBonusTypes is the list we fed in.
    assert result["style_brief"]["previousBonusTypes"] == ["jingle"]
