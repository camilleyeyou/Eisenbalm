"""Stub Researcher — Phase 4 (CONTEXT D-18 step 6: no datastore write).

Research data lives only in LangGraph state — it is consumed by every Phase 2
section writer but never persisted on its own. Phase 5 will add httpx source
verification (AGT-08); Phase 4 stub returns a hardcoded research payload.

max_tool_calls=12 per CONTEXT D-25 (Researcher iteration limit). Phase 4 never
trips the limit because stubs make no tool calls; the value is stored on the
wrapped function so Phase 5's real Researcher inherits the cap.
"""
from __future__ import annotations

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.stubs import fixtures


@agent_node(name="researcher", emit_event=None, max_tool_calls=12)
async def researcher(state: DispatchState) -> DispatchState:
    return {**state, **fixtures.research_output()}
