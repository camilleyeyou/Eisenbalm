"""Stub GameWriter — Phase 4 (CONTEXT D-18 step 7).

Game payload uses headline + description (no wordCount — the game content lives
in `embedCode` HTML, not a body string). Phase 7 will add the embedCode
validator (GAM-02); Phase 4 stub returns a self-contained placeholder game.
"""
from __future__ import annotations

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.stubs import fixtures


def _game_payload(state: DispatchState) -> dict:
    section = state.get("game") or {}
    return {
        "sectionName": "game",
        "headline": section.get("headline", ""),
        "description": section.get("description", ""),
    }


@agent_node(
    name="game",
    emit_event="section-draft",
    payload_builder=_game_payload,
)
async def game(state: DispatchState) -> DispatchState:
    return {**state, **fixtures.game_output()}
