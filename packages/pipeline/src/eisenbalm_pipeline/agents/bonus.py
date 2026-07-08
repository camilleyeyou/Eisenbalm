# ─── Phase 16 NRR-01 invariant ───────────────────────────────────────────────
# This agent consumes VOICE_CONSTRAINTS VERBATIM. It must not branch on
# state["narrator"] or state["narrator_slug"]. Narrator-aware behaviour lives
# exclusively in the chronicler agent (16-06) and the QA judge (16-07).
# Per CONTEXT D-19 (Phase 16 non-goals), the Bonus + Game agents are NOT
# narrator-aware in this phase — they continue to use VOICE_CONSTRAINTS
# directly without propagating style_brief["voice"]. If a later phase adds
# bonus/game narrator awareness, the rule above no longer holds; revisit.
# The byte-equivalence guard for the system message lives in
# packages/pipeline/tests/test_section_writer_voice_propagation.py
# (Plan 16-02 Task 2) — note Bonus is intentionally OUT of scope for that
# test (only 4 narrative writers: origin_story, problem, founder_bio,
# case_study).
# ─────────────────────────────────────────────────────────────────────────────
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

from pydantic import BaseModel, Field, field_validator

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.blocks import BodyBlock, ClaimSpanRef
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.prompts import load_prompt
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, build_claims_block


# ── Pydantic shapes (D-19) ──────────────────────────────────────────────


class Storyboard(BaseModel):
    """One shot in a bigBudget storyboard array."""

    shotNumber: int = Field(default=1, description="1-based shot index (must be >= 1)")
    description: str = Field(
        default="",
        description="50-100 words of precise visual/audio direction",
    )


class BigBudgetBonus(BaseModel):
    """bigBudget branch output. 3-5 storyboards per D-19."""

    headline: str = ""
    body: str = Field(default="", description="200-400 words on concept")
    storyboards: list[Storyboard] = Field(
        default_factory=list,
        description="3-5 storyboards per D-19",
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
    """specAd branch output — Phase 18 D-04: body is list[BodyBlock] + structural floor."""

    headline: str = Field(default="", description="<=6 words")
    body: list[BodyBlock] = Field(  # Phase 18 D-01/D-04 (was: body: str = Field(...))
        default_factory=list,
        description="100-300 words rendered as list[BodyBlock]; >=2 h2/h3 + >=1 blockquote",
    )
    claimSpans: list[ClaimSpanRef] = []  # Phase 35 PRV-02 (D-05/D-06) — additive; NOT part of the structural floor

    @field_validator('body')
    @classmethod
    def _enforce_structural_floor(cls, body: list[BodyBlock]) -> list[BodyBlock]:
        heading_count = sum(1 for b in body if b.type in ('h2', 'h3'))
        blockquote_count = sum(1 for b in body if b.type == 'blockquote')
        if heading_count < 2:
            raise ValueError(
                f"structural-floor: need >=2 sub-headers, got {heading_count}"
            )
        if blockquote_count < 1:
            raise ValueError(
                f"structural-floor: need >=1 blockquote, got {blockquote_count}"
            )
        return body


# ── Phase 18 D-04 — appended to _build_spec_ad_prompt ONLY.
# _build_big_budget_prompt + _build_jingle_prompt are BYTE-UNCHANGED — their
# structured outputs (storyboards[] for BigBudget, lyrics+sunoPrompt for Jingle)
# already break the visual rhythm; the Phase 18 wall-of-text fix targets ONLY
# narrative prose bodies.
STRUCTURE_CONTRACT: str = (
    "\n\nSTRUCTURE CONTRACT (non-negotiable):\n"
    "Emit at minimum 2 sub-headers (h2 or h3) and 1 blockquote per section. "
    "Sub-headers: <=6 words, Jesse-voice, break the body into 3+ logical "
    "movements. Blockquote: a single sentence lifted verbatim from the most "
    "quotable line in the body prose - not a generic restatement. "
    "Sub-headers and blockquote serve Jesse's register. "
    "Do not break voice; structural variety is typographic, not tonal."
)


# ── Three internal prompt builders (D-19) ───────────────────────────────


def _build_big_budget_prompt(
    state: DispatchState, charity: dict, style_brief: dict
) -> list[dict[str, str]]:
    cfg = state.get("config")
    base = (
        cfg.agents["bonus_big_budget"].system_prompt
        if cfg
        else load_prompt("bonus-big-budget")
    )
    system = base.replace("{VOICE_CONSTRAINTS}", VOICE_CONSTRAINTS)
    # Phase 24 (PRM-01): user template read from config, on-disk .md fallback.
    user_tmpl = (
        cfg.user_templates.get("bonus_big_budget_user")
        if cfg and cfg.user_templates.get("bonus_big_budget_user")
        else load_prompt("bonus_big_budget_user")
    )
    user = (
        user_tmpl
        .replace("{charity_name}", charity.get("name", ""))
        .replace("{mission_statement}", charity.get("missionStatement", ""))
        .replace("{visual_direction}", style_brief.get("visualDirection", ""))
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _build_jingle_prompt(
    state: DispatchState, charity: dict, style_brief: dict
) -> list[dict[str, str]]:
    cfg = state.get("config")
    base = (
        cfg.agents["bonus_jingle"].system_prompt
        if cfg
        else load_prompt("bonus-jingle")
    )
    system = base.replace("{VOICE_CONSTRAINTS}", VOICE_CONSTRAINTS)
    # Phase 24 (PRM-01): user template read from config, on-disk .md fallback.
    user_tmpl = (
        cfg.user_templates.get("bonus_jingle_user")
        if cfg and cfg.user_templates.get("bonus_jingle_user")
        else load_prompt("bonus_jingle_user")
    )
    user = (
        user_tmpl
        .replace("{charity_name}", charity.get("name", ""))
        .replace("{mission_statement}", charity.get("missionStatement", ""))
        .replace("{visual_direction}", style_brief.get("visualDirection", ""))
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _build_spec_ad_prompt(
    state: DispatchState, charity: dict, style_brief: dict
) -> list[dict[str, str]]:
    cfg = state.get("config")
    base = (
        cfg.agents["bonus_spec_ad"].system_prompt
        if cfg
        else load_prompt("bonus-spec-ad")
    )
    system = (
        base
        .replace("{VOICE_CONSTRAINTS}", VOICE_CONSTRAINTS)
        .replace("{STRUCTURE_CONTRACT}", STRUCTURE_CONTRACT)
    )
    # Phase 24 (PRM-01): user template read from config, on-disk .md fallback.
    user_tmpl = (
        cfg.user_templates.get("bonus_spec_ad_user")
        if cfg and cfg.user_templates.get("bonus_spec_ad_user")
        else load_prompt("bonus_spec_ad_user")
    )
    user = (
        user_tmpl
        .replace("{charity_name}", charity.get("name", ""))
        .replace("{mission_statement}", charity.get("missionStatement", ""))
        .replace("{visual_direction}", style_brief.get("visualDirection", ""))
    )
    # Phase 35 PRV-02/D-06: SpecAd is the one bonus branch that emits
    # claimSpans, but it does NOT route through build_section_writer_prompt
    # (it assembles its own system/user messages from on-disk templates
    # above). Reuse build_claims_block so the writer-facing format matches
    # the 4 narrative writers exactly; appended to the USER message only.
    claims = [
        {"claimId": c["claimId"], "text": c["text"]}
        for c in (state.get("research") or {}).get("claims", [])
    ]
    claims_block = build_claims_block(claims)
    if claims_block:
        user = f"{user}\n\n{claims_block.rstrip()}"
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


# ── Decorator payload builder ──────────────────────────────────────────


def _bonus_payload(state: DispatchState) -> dict:
    section = state.get("bonus") or {}
    body = section.get("body", "")
    # body may be list[BodyBlock] (specAd after Phase 18) or str (bigBudget/jingle).
    if isinstance(body, list):
        word_count = sum(
            len(b.get("text", "").split()) if isinstance(b, dict)
            else len(getattr(b, "text", "").split())
            for b in body
        )
    else:
        word_count = len(body.split()) if body else 0
    return {
        "sectionName": "bonus",
        "bonusType": section.get("bonusType")
            or (state.get("style_brief") or {}).get("bonusType"),
        "headline": section.get("headline", ""),
        "wordCount": word_count,
    }


# ── Agent entry point ──────────────────────────────────────────────────


@agent_node(name="bonus", emit_event="section-draft", payload_builder=_bonus_payload)
async def bonus(state: DispatchState) -> DispatchState:
    style_brief = state.get("style_brief") or {}
    bonus_type = style_brief.get("bonusType", "specAd")
    charity = state.get("winning_charity") or {}
    run_id = state["run_id"]

    if bonus_type == "bigBudget":
        messages = _build_big_budget_prompt(state, charity, style_brief)
        response_format: type[BaseModel] = BigBudgetBonus
    elif bonus_type == "jingle":
        messages = _build_jingle_prompt(state, charity, style_brief)
        response_format = JingleBonus
    else:
        messages = _build_spec_ad_prompt(state, charity, style_brief)
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

    # Phase 35 D-06/D-07: only the SpecAd branch carries claimSpans
    # (BigBudget/Jingle are non-prose and exempt — they never gain a
    # claimSpans key at all). Lenient whitelist-drop mirrors the 4
    # narrative writers: an unrecognized claimId is dropped, logged, never
    # fatal.
    if bonus_type == "specAd":
        valid_ids = {
            c["claimId"] for c in (state.get("research") or {}).get("claims", [])
        }
        spans = out_dict.get("claimSpans") or []
        kept = [s for s in spans if s.get("claimId") in valid_ids]
        if len(spans) != len(kept):
            import logging
            logging.getLogger(__name__).info(
                "bonus[specAd]: dropped %d claimSpan(s) with unknown claimId (D-07 lenient)",
                len(spans) - len(kept),
            )
        out_dict["claimSpans"] = kept

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
