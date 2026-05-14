"""Stub DesignAgent — Phase 4 (CONTEXT D-18 step 7).

Payload includes the resolved hex colors and fonts so the deliberation
accordion can render a small theme preview without re-querying state.
Phase 5 will enforce hex + Google-font validation (AGT-13, AGT-14).
"""
from __future__ import annotations

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.stubs import fixtures


def _design_payload(state: DispatchState) -> dict:
    theme = state.get("theme") or {}
    return {
        "sectionName": "theme",
        "primaryColor": theme.get("primaryColor", ""),
        "accentColor": theme.get("accentColor", ""),
        "backgroundColor": theme.get("backgroundColor", ""),
        "textColor": theme.get("textColor", ""),
        "fontDisplay": theme.get("fontDisplay", ""),
        "fontBody": theme.get("fontBody", ""),
    }


@agent_node(
    name="design",
    emit_event="section-draft",
    payload_builder=_design_payload,
)
async def design(state: DispatchState) -> DispatchState:
    return {**state, **fixtures.design_output()}
