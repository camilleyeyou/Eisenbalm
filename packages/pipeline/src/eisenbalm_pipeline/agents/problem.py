"""Phase 5 ProblemWriter — Sonnet via OpenRouter.

Replaces Phase 4 stub. Emits ``state['problem_statement']`` (SectionContent)
plus ``pdfContent`` nested in the same section dict. ``pdfContent`` is the
Phase 6 WeasyPrint template contract — field names locked:
``problemStatement``, ``keyDataPoints`` (exactly 3 items, each
``{stat, source}``), ``interventionMechanism``. DO NOT rename without
coordinating Phase 6. Same shape lives in
``weeklyIssue.problem.pdfContent`` per docs/API_CONTRACTS §2.2.

Voice-isolation enforced via lib/voice.build_section_writer_prompt() (AGT-09).
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.voice import build_section_writer_prompt


SECTION_GUIDANCE: str = (
    "400-600 words. Cover: the precise problem (with statistics), why "
    "existing institutions fail to solve it, and how the charity's "
    "approach differs. Include pdfContent: problemStatement (<=150 words), "
    "keyDataPoints (exactly 3 items, each with `stat` and `source`), "
    "interventionMechanism (<=100 words). pdfContent is the Phase 6 "
    "WeasyPrint template input — do not rename fields."
)


class KeyDataPoint(BaseModel):
    stat: str = ""
    source: str = ""


class PdfContent(BaseModel):
    problemStatement: str = Field(default="", description="<=150 words")
    keyDataPoints: list[KeyDataPoint] = Field(
        default_factory=lambda: [KeyDataPoint(), KeyDataPoint(), KeyDataPoint()],
        min_length=3,
        max_length=3,
    )
    interventionMechanism: str = Field(default="", description="<=100 words")


class ProblemOutput(BaseModel):
    headline: str = ""
    body: str = ""
    pdfContent: PdfContent = Field(default_factory=PdfContent)


def _problem_payload(state: DispatchState) -> dict:
    section = state.get("problem_statement") or {}
    body = section.get("body", "") if isinstance(section, dict) else ""
    headline = section.get("headline", "") if isinstance(section, dict) else ""
    return {
        "sectionName": "problemStatement",
        "headline": headline,
        "wordCount": len(body.split()) if body else 0,
    }


@agent_node(
    name="problem",
    emit_event="section-draft",
    payload_builder=_problem_payload,
)
async def problem(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    messages = build_section_writer_prompt(
        section_id="problem",
        section_title="Problem Statement",
        section_guidance=SECTION_GUIDANCE,
        charity=state.get("winning_charity") or {},
        research=state.get("research") or {},
        style_brief=state.get("style_brief") or {},
    )
    out_obj, usage = await acomplete(
        agent_id="problem",
        run_id=run_id,
        messages=messages,
        response_format=ProblemOutput,
    )

    # Defensive dict extraction.
    out_dict: dict[str, Any]
    if hasattr(out_obj, "model_dump"):
        out_dict = out_obj.model_dump()
    elif isinstance(out_obj, dict):
        out_dict = dict(out_obj)
    else:
        out_dict = {
            "headline": "",
            "body": "",
            "pdfContent": {
                "problemStatement": "",
                "keyDataPoints": [{"stat": "", "source": ""}] * 3,
                "interventionMechanism": "",
            },
        }

    # AGT-17: record resolved model.
    model_versions = dict(state.get("model_versions") or {})
    model_versions["problem"] = usage["resolved_model"]

    return {
        **state,
        "problem_statement": out_dict,
        "model_versions": model_versions,
    }
