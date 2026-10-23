"""Phase 5 GameWriter — Sonnet via OpenRouter.

Replaces Phase 4 stub. The prompt enumerates the full forbidden-construct
deny-list verbatim per D-20. Phase 7 owns the renderer-level validator;
Phase 5 ships prompt-level defense only.

Output Pydantic ``GameOutput``:
  - headline: short title for the game (2-4 words)
  - goal: one imperative sentence (max 14 words) - what the player does to win
  - howToPlay: 2-3 imperative steps (max 12 words each), one action per step
  - controls: max 6 words naming the touch + keyboard input
  - description: 1-2 sentences (max 40 words) in Jesse's voice
  - embedCode: complete self-contained HTML/JS string for iframe srcdoc

``goal`` / ``howToPlay`` / ``controls`` are additive: legacy issues lack them.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.prompts import load_prompt
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, build_brief_block


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
    goal: str = Field(default="", description="One imperative sentence (max 14 words): what the player does to win")
    howToPlay: list[str] = Field(default_factory=list, description="2-3 imperative steps, each max 12 words, one action or observation per step")
    controls: str = Field(default="", description="Max 6 words naming the touch + keyboard input, e.g. 'Tap · Space'")
    description: str = Field(
        default="",
        description="1-2 sentences (max 40 words) in Jesse's voice: what the game is about",
    )
    embedCode: str = Field(
        default="",
        description="Complete self-contained HTML/JS string for iframe srcdoc",
    )


def _normalise_game(out: Any) -> dict:
    """Strip text fields and coerce howToPlay to <=3 non-empty strings. Never raises."""
    try:
        result = dict(out) if isinstance(out, dict) else {}
    except Exception:  # noqa: BLE001
        return {}
    for key in ("headline", "goal", "controls", "description"):
        val = result.get(key)
        if isinstance(val, str):
            result[key] = val.strip()
        elif key in result and val is None:
            result[key] = ""
    steps = result.get("howToPlay")
    if isinstance(steps, str):
        steps = [steps]
    elif not isinstance(steps, (list, tuple)):
        steps = []
    cleaned = [s.strip() for s in steps if isinstance(s, str) and s.strip()]
    result["howToPlay"] = cleaned[:3]
    return result


def _build_messages(state: DispatchState, charity: dict) -> list[dict[str, str]]:
    """Embed FORBIDDEN_CONSTRUCTS verbatim per D-20.

    Phase 22 (CFG-01): base prompt read from
    state["config"].agents["game"].system_prompt, disk fallback otherwise.
    """
    cfg = state.get("config")
    base = cfg.agents["game"].system_prompt if cfg else load_prompt("game")
    system = (
        base
        .replace("{charity_name}", charity.get("name", ""))
        .replace("{VOICE_CONSTRAINTS}", VOICE_CONSTRAINTS)
        .replace("{FORBIDDEN_CONSTRUCTS}", FORBIDDEN_CONSTRUCTS)
    )
    # Phase 24 (PRM-01): user template read from config, on-disk .md fallback.
    user_tmpl = (
        cfg.user_templates.get("game_user")
        if cfg and cfg.user_templates.get("game_user")
        else load_prompt("game_user")
    )
    user = (
        user_tmpl
        .replace("{charity_name}", charity.get("name", ""))
        .replace("{mission_statement}", charity.get("missionStatement", ""))
    )
    # Phase 47 (BRF-05): thread the Story Brief so this bespoke writer also
    # drafts FROM it (game.py does not route through
    # build_section_writer_prompt — see 47-RESEARCH Pattern 5). None-safe:
    # build_brief_block("") when state.get("brief") is None on legacy runs.
    brief_block = build_brief_block(state.get("brief"))
    if brief_block:
        user = f"{user}\n\n{brief_block.rstrip()}"
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _game_payload(state: DispatchState) -> dict:
    section = state.get("game") or {}
    return {
        "sectionName": "game",
        "headline": section.get("headline", ""),
        "goal": section.get("goal", ""),
        "controls": section.get("controls", ""),
        "howToPlay": section.get("howToPlay", []),
        "description": section.get("description", ""),
    }


@agent_node(name="game", emit_event="section-draft", payload_builder=_game_payload)
async def game(state: DispatchState) -> DispatchState:
    charity = state.get("winning_charity") or {}
    run_id = state["run_id"]

    messages = _build_messages(state, charity)
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
    out_dict = _normalise_game(out_dict)

    # AGT-17: parallel writers each contribute their OWN key to
    # model_versions; the DispatchState Annotated reducer merges across
    # the 7 fan-out branches. Returning only owned keys (no **state)
    # avoids the InvalidUpdate race on shared keys (Phase 4-12 fix).
    return {
        "game": out_dict,
        "model_versions": {"game": usage["resolved_model"]},
    }
