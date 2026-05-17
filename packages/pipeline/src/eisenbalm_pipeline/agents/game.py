"""Phase 5 GameWriter — Sonnet via OpenRouter.

Replaces Phase 4 stub. The prompt enumerates the full forbidden-construct
deny-list verbatim per D-20. Phase 7 owns the renderer-level validator;
Phase 5 ships prompt-level defense only.

Output Pydantic ``GameOutput``:
  - headline: short title for the game
  - description: 50-100 word plain-text summary for accessibility
  - embedCode: complete self-contained HTML/JS string for iframe srcdoc
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


# D-20: enumerate every forbidden construct verbatim. Phase 7's renderer
# validator mirrors this list; Phase 5 stops here.
FORBIDDEN_CONSTRUCTS: str = """FORBIDDEN (a validator will reject these):
- <script src="...">    no external scripts
- <link href="...">     no external stylesheets
- fetch(                no network calls
- XMLHttpRequest        no AJAX
- window.parent         no parent frame access
- window.top            no top frame access
- document.cookie       no cookie access
- localStorage          no storage access
- eval(                 no dynamic evaluation
- import(               no dynamic imports

All CSS: inline <style> tags only.
All JS: inline <script> tags only (no src= attribute).
No external fonts, no CDN references of any kind."""


class GameOutput(BaseModel):
    """AGT-12 output shape (headline + description + embedCode)."""

    headline: str = ""
    description: str = Field(
        default="",
        description="50-100 word plain-text description for accessibility",
    )
    embedCode: str = Field(
        default="",
        description="Complete self-contained HTML/JS string for iframe srcdoc",
    )


def _build_messages(charity: dict) -> list[dict[str, str]]:
    """Embed FORBIDDEN_CONSTRUCTS verbatim per D-20."""
    system = (
        "You are the GameWriter for The Eisenbalm Dispatch. "
        f"Write a self-contained HTML/JS game themed around "
        f"{charity.get('name', '')}'s mission. Completable in 60-90 seconds.\n\n"
        "VOICE CONSTRAINTS (apply to in-game text + headline):\n"
        f"{VOICE_CONSTRAINTS}\n\n"
        f"{FORBIDDEN_CONSTRUCTS}"
    )
    user = (
        f"CHARITY: {charity.get('name', '')}\n"
        f"MISSION: {charity.get('missionStatement', '')}\n\n"
        "Return JSON GameOutput with: headline (game title), description "
        "(50-100 word plain-text summary for accessibility), embedCode "
        "(complete self-contained HTML document including inline <style> "
        "and inline <script> — no external dependencies of any kind)."
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _game_payload(state: DispatchState) -> dict:
    section = state.get("game") or {}
    return {
        "sectionName": "game",
        "headline": section.get("headline", ""),
        "description": section.get("description", ""),
    }


@agent_node(name="game", emit_event="section-draft", payload_builder=_game_payload)
async def game(state: DispatchState) -> DispatchState:
    charity = state.get("winning_charity") or {}
    run_id = state["run_id"]

    messages = _build_messages(charity)
    out_obj, usage = await acomplete(
        agent_id="game",
        run_id=run_id,
        messages=messages,
        response_format=GameOutput,
    )

    # Defensive dict extraction: stub-mode returns model_construct(); real
    # mode returns a populated GameOutput.
    out_dict: dict[str, Any]
    if hasattr(out_obj, "model_dump"):
        out_dict = out_obj.model_dump()
    elif isinstance(out_obj, dict):
        out_dict = dict(out_obj)
    else:
        out_dict = {}

    # AGT-17: parallel writers each contribute their OWN key to
    # model_versions; the DispatchState Annotated reducer merges across
    # the 7 fan-out branches. Returning only owned keys (no **state)
    # avoids the InvalidUpdate race on shared keys (Phase 4-12 fix).
    return {
        "game": out_dict,
        "model_versions": {"game": usage["resolved_model"]},
    }
