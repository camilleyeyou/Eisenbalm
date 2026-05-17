"""Phase 5 DesignAgent submodules. font_whitelist requires Andrew approval (D-16).

Plan 05-04 establishes this directory as a package so font_whitelist.py can
ship before Plan 05-12 fills in the real DesignAgent body. The stub `design`
node from Phase 4 (CONTEXT D-18 step 7) is preserved here verbatim so
`from eisenbalm_pipeline.agents.design import design` resolves through the
package layer; Plan 05-12 replaces the body with the real implementation that
imports + enforces font_whitelist.FONT_WHITELIST and lib.wcag.validate_theme.
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
    return fixtures.design_output()
