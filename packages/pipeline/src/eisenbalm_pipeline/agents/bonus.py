"""Stub BonusWriter — Phase 4 (CONTEXT D-18 step 7).

Stub returns the bigBudget bonus shape per CONTEXT D-16 (Phase 5 owns the
bonusType rotation between bigBudget / jingle / specAd).
"""
from __future__ import annotations

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.stubs import fixtures


def _bonus_payload(state: DispatchState) -> dict:
    section = state.get("bonus") or {}
    body = section.get("body", "")
    bonus_type = (state.get("style_brief") or {}).get("bonusType")
    return {
        "sectionName": "bonus",
        "bonusType": bonus_type,
        "headline": section.get("headline", ""),
        "wordCount": len(body.split()) if body else 0,
    }


@agent_node(
    name="bonus",
    emit_event="section-draft",
    payload_builder=_bonus_payload,
)
async def bonus(state: DispatchState) -> DispatchState:
    return {**state, **fixtures.bonus_output()}
