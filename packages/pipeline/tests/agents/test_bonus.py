"""Phase 5 BonusWriter unit tests — Plan 05-11. Validation: AGT-11."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.bonus import (
    BigBudgetBonus,
    JingleBonus,
    SpecAdBonus,
    Storyboard,
    bonus,
)


def _state_with_bonus_type(bonus_type: str, base_state: dict) -> dict:
    return {
        **base_state,
        "style_brief": {"bonusType": bonus_type, "visualDirection": "warm"},
        "winning_charity": {"name": "Foo Org", "missionStatement": "m"},
    }


@pytest.mark.asyncio
async def test_big_budget_branch(sample_dispatch_state) -> None:
    """AGT-11: bigBudget emits storyboards (3-5 items)."""
    state = _state_with_bonus_type("bigBudget", sample_dispatch_state)
    sb = [Storyboard(shotNumber=i + 1, description="d" * 80) for i in range(4)]
    out = BigBudgetBonus(headline="H", body="B" * 300, storyboards=sb)
    with patch(
        "eisenbalm_pipeline.agents.bonus.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0,
            "tokens_out": 0,
            "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await bonus(state)
    assert len(result["bonus"]["storyboards"]) == 4
    assert result["bonus"]["bonusType"] == "bigBudget"


@pytest.mark.asyncio
async def test_jingle_branch_sunourl_empty(sample_dispatch_state) -> None:
    """AGT-11: jingle leaves sunoAudioUrl empty (V2-01 deferred)."""
    state = _state_with_bonus_type("jingle", sample_dispatch_state)
    out = JingleBonus(
        headline="H",
        body="B" * 150,
        lyrics="L" * 100,
        sunoPrompt="S" * 60,
        sunoAudioUrl="https://attempted.example/x.mp3",  # model tried — code clears it
    )
    with patch(
        "eisenbalm_pipeline.agents.bonus.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0,
            "tokens_out": 0,
            "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await bonus(state)
    assert result["bonus"]["sunoAudioUrl"] == ""
    assert result["bonus"]["sunoPrompt"]
    assert result["bonus"]["bonusType"] == "jingle"


@pytest.mark.asyncio
async def test_spec_ad_branch(sample_dispatch_state) -> None:
    state = _state_with_bonus_type("specAd", sample_dispatch_state)
    # Phase 18 D-04: SpecAdBonus.body is now list[BodyBlock] (not str).
    # Provide a conforming body with >=2 h2/h3 + >=1 blockquote.
    _spec_ad_body = [
        {"type": "paragraph", "text": "The charity addresses an invisible crisis."},
        {"type": "h2", "text": "The ask"},
        {"type": "paragraph", "text": "One year. No excuses."},
        {"type": "blockquote", "text": "No excuses."},
        {"type": "h2", "text": "Why now"},
        {"type": "paragraph", "text": "Because next year is already too late."},
    ]
    out = SpecAdBonus(headline="H", body=_spec_ad_body)
    with patch(
        "eisenbalm_pipeline.agents.bonus.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0,
            "tokens_out": 0,
            "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await bonus(state)
    assert "storyboards" not in result["bonus"]
    assert "sunoPrompt" not in result["bonus"]
    assert result["bonus"]["bonusType"] == "specAd"
