"""Phase 5 GameWriter unit tests — Plan 05-11. Validation: AGT-12."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.game import (
    FORBIDDEN_CONSTRUCTS,
    GameOutput,
    _build_messages,
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
