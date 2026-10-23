"""Phase 5 GameWriter unit tests — Plan 05-11. Validation: AGT-12."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.game import (
    FORBIDDEN_CONSTRUCTS,
    GameOutput,
    _build_messages,
    _normalise_game,
    game,
)


def test_no_external_deps_enumerated_in_prompt() -> None:
    """AGT-12: forbidden constructs enumerated in prompt verbatim (D-20)."""
    for token in (
        "<script src",
        "<link href",
        "fetch(",
        "XMLHttpRequest",
        "window.parent",
        "window.top",
        "document.cookie",
        "localStorage",
        "eval(",
        "import(",
    ):
        assert token in FORBIDDEN_CONSTRUCTS, f"missing: {token}"

    msgs = _build_messages({}, {"name": "Foo", "missionStatement": "m"})
    assert FORBIDDEN_CONSTRUCTS in msgs[0]["content"]


@pytest.mark.asyncio
async def test_game_output_shape(sample_dispatch_state) -> None:
    """AGT-12: GameOutput shape (headline + description + embedCode)."""
    sample_dispatch_state["winning_charity"] = {
        "name": "Foo",
        "missionStatement": "m",
    }
    out = GameOutput(
        headline="H",
        goal="Catch 20 donations.",
        howToPlay=["Tap to catch.", "Score counts.", "Miss three and lose.", "extra"],
        controls="Tap · Space",
        description="d" * 80,
        embedCode="<!doctype html><html><body>game</body></html>",
    )
    with patch(
        "eisenbalm_pipeline.agents.game.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0,
            "tokens_out": 0,
            "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await game(sample_dispatch_state)
    assert "headline" in result["game"]
    assert "description" in result["game"]
    assert "embedCode" in result["game"]
    for key in ("goal", "howToPlay", "controls"):
        assert key in result["game"]
    assert result["game"]["howToPlay"] == ["Tap to catch.", "Score counts.", "Miss three and lose."]


def test_normalise_caps_howtoplay_at_three() -> None:
    assert _normalise_game({"howToPlay": ["a", "b", "c", "d"]})["howToPlay"] == ["a", "b", "c"]


def test_normalise_drops_blanks_and_strips() -> None:
    assert _normalise_game({"howToPlay": ["  a ", "", "   ", "b"]})["howToPlay"] == ["a", "b"]


def test_normalise_wraps_bare_string_and_handles_missing() -> None:
    assert _normalise_game({"howToPlay": "Tap the wheel."})["howToPlay"] == ["Tap the wheel."]
    assert _normalise_game({})["howToPlay"] == []
    assert _normalise_game({"headline": "  H ", "goal": " g ", "controls": " c ", "description": " d "}) == {
        "headline": "H", "goal": "g", "controls": "c", "description": "d", "howToPlay": [],
    }


def test_normalise_never_raises_on_junk() -> None:
    assert _normalise_game(None)["howToPlay"] == []
    assert _normalise_game({"howToPlay": 5, "headline": None})["howToPlay"] == []


def test_system_prompt_has_new_contract() -> None:
    msgs = _build_messages({}, {"name": "Foo", "missionStatement": "m"})
    system = msgs[0]["content"]
    assert "ONE VERB, ONE INPUT" in system
    assert "THREE SCREENS" in system
    assert FORBIDDEN_CONSTRUCTS in system
    assert "{VOICE_CONSTRAINTS}" not in system
