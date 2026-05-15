"""Stub OriginStoryWriter — Phase 4 (CONTEXT D-18 step 7).

Emits deliberationEvents:insert eventType='section-draft' with the sectionName
included inside the payload JSON. (The wrapper does not currently set the
top-level `sectionName` column on deliberationEvents — that may be a Phase 5
extension; Phase 4 includes it inside the payload for the live UI.)
"""
from __future__ import annotations

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.stubs import fixtures


def _origin_story_payload(state: DispatchState) -> dict:
    section = state.get("origin_story") or {}
    body = section.get("body", "")
    return {
        "sectionName": "originStory",
        "headline": section.get("headline", ""),
        "wordCount": len(body.split()) if body else 0,
    }


@agent_node(
    name="origin-story",
    emit_event="section-draft",
    payload_builder=_origin_story_payload,
)
async def origin_story(state: DispatchState) -> DispatchState:
    return fixtures.origin_story_output()
