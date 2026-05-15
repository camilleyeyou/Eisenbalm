"""Stub QA — Phase 4 (CONTEXT D-18 step 9: 0 corrections in stub mode).

The wrapper emits exactly one deliberationEvents:insert with
eventType='qa-correction' that summarizes the corrections array. In stub mode
the array is empty (CONTEXT D-37); Phase 5 will populate it with real
voice/values corrections.
"""
from __future__ import annotations

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.stubs import fixtures


def _qa_payload(state: DispatchState) -> dict:
    corrections = state.get("qa_corrections") or []
    return {
        "totalCorrections": len(corrections),
        "majorCount": sum(
            1 for c in corrections if c.get("severity") == "major"
        ),
    }


@agent_node(name="qa", emit_event="qa-correction", payload_builder=_qa_payload)
async def qa(state: DispatchState) -> DispatchState:
    return fixtures.qa_output()
