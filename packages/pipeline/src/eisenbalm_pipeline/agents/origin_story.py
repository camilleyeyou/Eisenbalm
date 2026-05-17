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

from pydantic import BaseModel

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.voice import build_section_writer_prompt


SECTION_GUIDANCE: str = (
    "400-600 words. Cover: the founding moment, early obstacles, the "
    "\"why this and not something else\" question answered without "
    "sentiment. Fortune-500 treatment: precision over poetry. No "
    "adjectives that are also compliments."
)


class OriginStoryOutput(BaseModel):
    headline: str = ""
    body: str = ""


def _origin_story_payload(state: DispatchState) -> dict:
    section = state.get("origin_story") or {}
    body = section.get("body", "") if isinstance(section, dict) else ""
    headline = section.get("headline", "") if isinstance(section, dict) else ""
    return {
        "sectionName": "originStory",
        "headline": headline,
        "wordCount": len(body.split()) if body else 0,
    }


@agent_node(
    name="origin_story",
    emit_event="section-draft",
    payload_builder=_origin_story_payload,
)
async def origin_story(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    messages = build_section_writer_prompt(
        section_id="origin_story",
        section_title="Origin Story",
        section_guidance=SECTION_GUIDANCE,
        charity=state.get("winning_charity") or {},
        research=state.get("research") or {},
        style_brief=state.get("style_brief") or {},
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
        out_dict = {"headline": "", "body": ""}

    # AGT-17: parallel writers each contribute their OWN key to
    # model_versions; the DispatchState Annotated reducer merges across
    # the 7 fan-out branches. Returning only owned keys (no **state)
    # avoids the InvalidUpdate race on shared keys (Phase 4-12 fix).
    return {
        "origin_story": out_dict,
        "model_versions": {"origin_story": usage["resolved_model"]},
    }
