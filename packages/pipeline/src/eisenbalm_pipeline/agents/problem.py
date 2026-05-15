"""Stub ProblemWriter — Phase 4 (CONTEXT D-18 step 7).

Writes both `problem_statement` (for the section) and `problem_pdf_content`
(for Phase 6's WeasyPrint PDF generator).
"""
from __future__ import annotations

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.stubs import fixtures


def _problem_payload(state: DispatchState) -> dict:
    section = state.get("problem_statement") or {}
    body = section.get("body", "")
    return {
        "sectionName": "problemStatement",
        "headline": section.get("headline", ""),
        "wordCount": len(body.split()) if body else 0,
    }


@agent_node(
    name="problem-statement",
    emit_event="section-draft",
    payload_builder=_problem_payload,
)
async def problem(state: DispatchState) -> DispatchState:
    return fixtures.problem_output()
