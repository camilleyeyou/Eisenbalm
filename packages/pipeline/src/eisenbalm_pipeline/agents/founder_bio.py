"""Stub FounderBioWriter — Phase 4 (CONTEXT D-18 step 7)."""
from __future__ import annotations

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.stubs import fixtures


def _founder_bio_payload(state: DispatchState) -> dict:
    section = state.get("founder_bio") or {}
    body = section.get("body", "")
    return {
        "sectionName": "founderBio",
        "headline": section.get("headline", ""),
        "wordCount": len(body.split()) if body else 0,
    }


@agent_node(
    name="founder-bio",
    emit_event="section-draft",
    payload_builder=_founder_bio_payload,
)
async def founder_bio(state: DispatchState) -> DispatchState:
    return {**state, **fixtures.founder_bio_output()}
