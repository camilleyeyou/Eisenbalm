"""Phase 5 BonusWriter — three-branch routing (Sonnet via OpenRouter).

Replaces Phase 4 stub. Single ``@agent_node`` entry; routes on
``state['style_brief']['bonusType']`` to one of three internal prompt
builders per D-19:

  bigBudget → BigBudgetBonus: {headline, body, storyboards[]}
  jingle    → JingleBonus:    {headline, body, lyrics, sunoPrompt, sunoAudioUrl=""}
  specAd    → SpecAdBonus:    {headline, body}

``sunoAudioUrl`` left empty for Andrew to fill manually (V2-01 deferred).
The branch's ``bonusType`` is tagged onto the emitted dict so downstream
consumers (QA, Publisher, Studio) can route without re-checking style_brief.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


# ── Pydantic shapes (D-19) ──────────────────────────────────────────────


class Storyboard(BaseModel):
    """One shot in a bigBudget storyboard array."""

    shotNumber: int = Field(default=1, ge=1)
    description: str = Field(
        default="",
        description="50-100 words of precise visual/audio direction",
    )


class BigBudgetBonus(BaseModel):
    """bigBudget branch output. 3-5 storyboards per D-19."""

    headline: str = ""
    body: str = Field(default="", description="200-400 words on concept")
    storyboards: list[Storyboard] = Field(
        default_factory=list, min_length=3, max_length=5,
    )


class JingleBonus(BaseModel):
    """jingle branch output. sunoAudioUrl always emitted as '' (V2-01)."""

    headline: str = ""
    body: str = Field(default="", description="100-200 words on concept")
    lyrics: str = Field(
        default="", description="8-16 lines, internal rhyme allowed",
    )
    sunoPrompt: str = Field(
        default="",
        description=(
            "40-80 words describing musical style, instrumentation, mood, "
            "lyrical theme. Do not reference AI."
        ),
    )
    sunoAudioUrl: str = ""  # V2-01: Andrew fills manually


class SpecAdBonus(BaseModel):
    """specAd branch output — simplest shape (headline + body only)."""

    headline: str = ""
    body: str = Field(
        default="", description="200-400 words of ad copy and rationale",
    )


# ── Three internal prompt builders (D-19) ───────────────────────────────


def _build_big_budget_prompt(charity: dict, style_brief: dict) -> list[dict[str, str]]:
    system = (
        "You are the BonusWriter for The Eisenbalm Dispatch. You are writing "
        "the BIG BUDGET branch: a spec for a cinematic ad campaign.\n\n"
        "VOICE CONSTRAINTS (non-negotiable):\n"
        f"{VOICE_CONSTRAINTS}\n\n"
        "Output: headline + body (200-400 words on concept) + storyboards "
        "(3-5 items: each with shotNumber (int) and description (50-100 "
        "words of precise visual/audio direction, Fortune-500 production "
        "values, no winking))."
    )
    user = (
        f"CHARITY: {charity.get('name', '')}\n"
        f"MISSION: {charity.get('missionStatement', '')}\n"
        f"VISUAL DIRECTION: {style_brief.get('visualDirection', '')}\n\n"
        "Return JSON BigBudgetBonus."
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _build_jingle_prompt(charity: dict, style_brief: dict) -> list[dict[str, str]]:
    system = (
        "You are the BonusWriter for The Eisenbalm Dispatch. You are writing "
        "the JINGLE branch.\n\n"
        "VOICE CONSTRAINTS (non-negotiable):\n"
        f"{VOICE_CONSTRAINTS}\n\n"
        "Output: headline + body (100-200 words on concept) + lyrics "
        "(8-16 lines, internal rhyme allowed) + sunoPrompt (40-80 words "
        "describing musical style, instrumentation, mood, and lyrical theme "
        "for the Suno API — do not reference AI in sunoPrompt). "
        "sunoAudioUrl is left empty for Andrew to fill."
    )
    user = (
        f"CHARITY: {charity.get('name', '')}\n"
        f"MISSION: {charity.get('missionStatement', '')}\n"
        f"VISUAL DIRECTION: {style_brief.get('visualDirection', '')}\n\n"
        "Return JSON JingleBonus with sunoAudioUrl set to empty string."
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _build_spec_ad_prompt(charity: dict, style_brief: dict) -> list[dict[str, str]]:
    system = (
        "You are the BonusWriter for The Eisenbalm Dispatch. You are writing "
        "the SPEC AD branch: a print/digital ad spec.\n\n"
        "VOICE CONSTRAINTS (non-negotiable):\n"
        f"{VOICE_CONSTRAINTS}\n\n"
        "Output: headline (the ad headline) + body (200-400 words of ad copy "
        "and rationale for the creative direction — precise, dry, serious)."
    )
    user = (
        f"CHARITY: {charity.get('name', '')}\n"
        f"MISSION: {charity.get('missionStatement', '')}\n"
        f"VISUAL DIRECTION: {style_brief.get('visualDirection', '')}\n\n"
        "Return JSON SpecAdBonus."
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


# ── Decorator payload builder ──────────────────────────────────────────


def _bonus_payload(state: DispatchState) -> dict:
    section = state.get("bonus") or {}
    body = section.get("body", "")
    return {
        "sectionName": "bonus",
        "bonusType": section.get("bonusType")
            or (state.get("style_brief") or {}).get("bonusType"),
        "headline": section.get("headline", ""),
        "wordCount": len(body.split()) if body else 0,
    }


# ── Agent entry point ──────────────────────────────────────────────────


@agent_node(name="bonus", emit_event="section-draft", payload_builder=_bonus_payload)
async def bonus(state: DispatchState) -> DispatchState:
    style_brief = state.get("style_brief") or {}
    bonus_type = style_brief.get("bonusType", "specAd")
    charity = state.get("winning_charity") or {}
    run_id = state["run_id"]

    if bonus_type == "bigBudget":
        messages = _build_big_budget_prompt(charity, style_brief)
        response_format: type[BaseModel] = BigBudgetBonus
    elif bonus_type == "jingle":
        messages = _build_jingle_prompt(charity, style_brief)
        response_format = JingleBonus
    else:
        messages = _build_spec_ad_prompt(charity, style_brief)
        response_format = SpecAdBonus

    out_obj, usage = await acomplete(
        agent_id="bonus",
        run_id=run_id,
        messages=messages,
        response_format=response_format,
    )

    # Defensive dict extraction: stub-mode returns model_construct()
    # (empty defaults); real mode returns a populated Pydantic instance.
    out_dict: dict[str, Any]
    if hasattr(out_obj, "model_dump"):
        out_dict = out_obj.model_dump()
    elif isinstance(out_obj, dict):
        out_dict = dict(out_obj)
    else:
        out_dict = {}

    # D-19 + V2-01: Jingle MUST emit sunoAudioUrl='' regardless of what the
    # model returned. Andrew populates this manually until Suno API is wired.
    if bonus_type == "jingle":
        out_dict["sunoAudioUrl"] = ""

    # Tag with bonusType so downstream (QA, Publisher, Studio) routes
    # without re-checking style_brief.
    out_dict["bonusType"] = bonus_type

    # AGT-17: parallel writers each contribute their OWN key to
    # model_versions; the DispatchState Annotated reducer merges across
    # the 7 fan-out branches. Returning only owned keys (no **state)
    # avoids the InvalidUpdate race on shared keys (Phase 4-12 fix).
    return {
        "bonus": out_dict,
        "model_versions": {"bonus": usage["resolved_model"]},
    }
