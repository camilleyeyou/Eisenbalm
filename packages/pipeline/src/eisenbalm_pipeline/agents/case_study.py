"""Stub CaseStudyWriter — Phase 4 (CONTEXT D-18 step 7)."""
from __future__ import annotations

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.stubs import fixtures


def _case_study_payload(state: DispatchState) -> dict:
    section = state.get("case_study") or {}
    body = section.get("body", "")
    return {
        "sectionName": "caseStudy",
        "headline": section.get("headline", ""),
        "subjectName": section.get("subjectName", ""),
        "wordCount": len(body.split()) if body else 0,
    }


@agent_node(
    name="case-study",
    emit_event="section-draft",
    payload_builder=_case_study_payload,
)
async def case_study(state: DispatchState) -> DispatchState:
    return fixtures.case_study_output()
