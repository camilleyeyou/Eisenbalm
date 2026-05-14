"""Stub Calibrator — Phase 4 (CONTEXT D-16: hardcoded bonusType='bigBudget').

emit_event=None: the Convex deliberationEvents.eventType union (convex/schema.ts
lines 30-37) does NOT include a 'calibrator-brief' literal, and CONTEXT D-18
step 2 doesn't map Calibrator to any of the existing event types. Skipping the
emit is the conservative choice; Phase 5 may revisit if a Calibrator-visible
event becomes useful for the deliberation layer.
"""
from __future__ import annotations

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.stubs import fixtures


@agent_node(name="calibrator", emit_event=None)
async def calibrator(state: DispatchState) -> DispatchState:
    return {**state, **fixtures.calibrator_output()}
