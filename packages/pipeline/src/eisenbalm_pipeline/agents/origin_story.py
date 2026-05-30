# ─── Phase 16 NRR-01 invariant ───────────────────────────────────────────────
# This agent consumes VOICE_CONSTRAINTS VERBATIM. It must not branch on
# state["narrator"] or state["narrator_slug"]. Narrator-aware behaviour lives
# exclusively in the chronicler agent (16-06) and the QA judge (16-07).
# The byte-equivalence guard for the system message lives in
# packages/pipeline/tests/test_section_writer_voice_propagation.py
# (Plan 16-02 Task 2).
# Propagation path: Calibrator (16-05) writes the narrator-aware voice into
# style_brief["voice"]; this writer FORWARDS that string into
# build_section_writer_prompt via the voice_constraints kwarg. When no
# narrator is set the value is byte-identical to VOICE_CONSTRAINTS, so the
# Phase 14 baseline is preserved (NRR-10).
# ─────────────────────────────────────────────────────────────────────────────
"""Phase 5 OriginStoryWriter — Sonnet via OpenRouter.

Replaces Phase 4 stub. Voice-isolation enforced by
lib/voice.build_section_writer_prompt() (AGT-09, D-13): the agent body never
reads any other section's state, and only passes the four whitelisted state
slices into the helper.

Writes ``state['origin_story']`` (SectionContent shape: headline + body) and
records the resolved model into ``state['model_versions']['origin_story']``
(AGT-17).
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, field_validator

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.blocks import BodyBlock
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, build_section_writer_prompt


# Phase 18 D-01/D-02 — appended to SECTION_GUIDANCE. Encodes the structural
# floor at the prompt layer; the Pydantic _enforce_structural_floor validator
# below is the hard gate (retries once via the existing acomplete path on failure).
STRUCTURE_CONTRACT: str = (
    "\n\nSTRUCTURE CONTRACT (non-negotiable):\n"
    "Emit at minimum 2 sub-headers (h2 or h3) and 1 blockquote per section. "
    "Sub-headers: <=6 words, Jesse-voice, break the body into 3+ logical "
    "movements. Blockquote: a single sentence lifted verbatim from the most "
    "quotable line in the body prose - not a generic restatement. "
    "Sub-headers and blockquote serve Jesse's register. "
    "Do not break voice; structural variety is typographic, not tonal."
)

SECTION_GUIDANCE: str = (
    "400-600 words. Cover: the founding moment, early obstacles, the "
    "\"why this and not something else\" question answered without "
    "sentiment. Fortune-500 treatment: precision over poetry. No "
    "adjectives that are also compliments."
)
SECTION_GUIDANCE = SECTION_GUIDANCE + STRUCTURE_CONTRACT


class OriginStoryOutput(BaseModel):
    headline: str = ""
    body: list[BodyBlock] = []  # Phase 18 D-01 (was: body: str = "")

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


def _origin_story_payload(state: DispatchState) -> dict:
    section = state.get("origin_story") or {}
    body = section.get("body", []) if isinstance(section, dict) else []
    headline = section.get("headline", "") if isinstance(section, dict) else ""
    # body is list[BodyBlock] after Phase 18; compute word count from block texts.
    if isinstance(body, list):
        word_count = sum(
            len(b.get("text", "").split()) if isinstance(b, dict)
            else len(getattr(b, "text", "").split())
            for b in body
        )
    else:
        word_count = len(str(body).split()) if body else 0
    return {
        "sectionName": "originStory",
        "headline": headline,
        "wordCount": word_count,
    }


@agent_node(
    name="origin_story",
    emit_event="section-draft",
    payload_builder=_origin_story_payload,
)
async def origin_story(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    style_brief = state.get("style_brief") or {}
    messages = build_section_writer_prompt(
        section_id="origin_story",
        section_title="Origin Story",
        section_guidance=SECTION_GUIDANCE,
        charity=state.get("winning_charity") or {},
        research=state.get("research") or {},
        style_brief=style_brief,
        # Phase 16 NRR-04 / Plan 16-05: forward the calibrator-set voice
        # (narrator-aware composition). When no narrator is set this is
        # byte-identical to VOICE_CONSTRAINTS — NRR-10 byte-equivalence.
        voice_constraints=style_brief.get("voice") or VOICE_CONSTRAINTS,
    )
    out_obj, usage = await acomplete(
        agent_id="origin_story",
        run_id=run_id,
        messages=messages,
        response_format=OriginStoryOutput,
    )

    # Defensive dict extraction (mirrors Researcher pattern).
    out_dict: dict[str, Any]
    if hasattr(out_obj, "model_dump"):
        out_dict = out_obj.model_dump()
    elif isinstance(out_obj, dict):
        out_dict = dict(out_obj)
    else:
        out_dict = {"headline": "", "body": []}

    # AGT-17: parallel writers each contribute their OWN key to
    # model_versions; the DispatchState Annotated reducer merges across
    # the 7 fan-out branches. Returning only owned keys (no **state)
    # avoids the InvalidUpdate race on shared keys (Phase 4-12 fix).
    return {
        "origin_story": out_dict,
        "model_versions": {"origin_story": usage["resolved_model"]},
    }
