# ─── Phase 16 NRR-01 invariant ───────────────────────────────────────────────
# This agent consumes VOICE_CONSTRAINTS VERBATIM. It must not branch on
# state["narrator"] or state["narrator_slug"]. Narrator-aware behaviour lives
# exclusively in the chronicler agent (16-06) and the QA judge (16-07).
# The byte-equivalence guard for the system message lives in
# packages/pipeline/tests/test_section_writer_voice_propagation.py
# (Plan 16-02 Task 2).
# Propagation path: Calibrator (16-05) writes the narrator-aware voice into
# style_brief["voice"]; this writer FORWARDS that string into
# build_section_writer_prompt via the voice_constraints kwarg. When no
# narrator is set the value is byte-identical to VOICE_CONSTRAINTS, so the
# Phase 14 baseline is preserved (NRR-10).
# ─────────────────────────────────────────────────────────────────────────────
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

from pydantic import BaseModel, Field, field_validator

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.blocks import BodyBlock
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, build_section_writer_prompt


# Phase 18 D-01/D-02 — appended to SECTION_GUIDANCE. Encodes the structural
# floor at the prompt layer; the Pydantic _enforce_structural_floor validator
# below is the hard gate (retries once via the existing acomplete path on failure).
# NOTE: D-03 — pdfContent shape is UNCHANGED (Phase 6 WeasyPrint contract).
STRUCTURE_CONTRACT: str = (
    "\n\nSTRUCTURE CONTRACT (non-negotiable):\n"
    "Emit at minimum 2 sub-headers (h2 or h3) and 1 blockquote per section. "
    "Sub-headers: <=6 words, Jesse-voice, break the body into 3+ logical "
    "movements. Blockquote: a single sentence lifted verbatim from the most "
    "quotable line in the body prose - not a generic restatement. "
    "Sub-headers and blockquote serve Jesse's register. "
    "Do not break voice; structural variety is typographic, not tonal."
)

SECTION_GUIDANCE: str = (
    "400-600 words. Cover: the precise problem (with statistics), why "
    "existing institutions fail to solve it, and how the charity's "
    "approach differs. Include pdfContent: problemStatement (<=150 words), "
    "keyDataPoints (exactly 3 items, each with `stat` and `source`), "
    "interventionMechanism (<=100 words). pdfContent is the Phase 6 "
    "WeasyPrint template input — do not rename fields."
)
SECTION_GUIDANCE = SECTION_GUIDANCE + STRUCTURE_CONTRACT


class KeyDataPoint(BaseModel):
    stat: str = ""
    source: str = ""


class PdfContent(BaseModel):
    problemStatement: str = Field(default="", description="<=150 words")
    keyDataPoints: list[KeyDataPoint] = Field(
        default_factory=lambda: [KeyDataPoint(), KeyDataPoint(), KeyDataPoint()],
        description="exactly 3 keyDataPoints (Phase 6 PDF layout depends on count=3)",
    )
    interventionMechanism: str = Field(default="", description="<=100 words")

    @field_validator("keyDataPoints")
    @classmethod
    def _exactly_three(cls, v: list[KeyDataPoint]) -> list[KeyDataPoint]:
        # Phase 6 contract enforced in Python (NOT JSON schema): Anthropic's
        # structured-output schema validator rejects minItems/maxItems != 0/1
        # (Plan 05-15 first-real-run regression). Equivalent validation runs
        # here after parse-time so contract still holds without breaking the
        # provider call.
        if len(v) != 3:
            raise ValueError(
                f"keyDataPoints must have exactly 3 items (got {len(v)})"
            )
        return v


class ProblemOutput(BaseModel):
    headline: str = ""
    body: list[BodyBlock] = []  # Phase 18 D-01 (was: body: str = ""); D-03: pdfContent UNCHANGED
    pdfContent: PdfContent = Field(default_factory=PdfContent)

    @field_validator('body')
    @classmethod
    def _enforce_structural_floor(cls, body: list[BodyBlock]) -> list[BodyBlock]:
        heading_count = sum(1 for b in body if b.type in ('h2', 'h3'))
        blockquote_count = sum(1 for b in body if b.type == 'blockquote')
        if heading_count < 2:
            raise ValueError(
                f"structural-floor: need >=2 sub-headers, got {heading_count}"
            )
        if blockquote_count < 1:
            raise ValueError(
                f"structural-floor: need >=1 blockquote, got {blockquote_count}"
            )
        return body


def _problem_payload(state: DispatchState) -> dict:
    section = state.get("problem_statement") or {}
    body = section.get("body", []) if isinstance(section, dict) else []
    headline = section.get("headline", "") if isinstance(section, dict) else ""
    # body is list[BodyBlock] after Phase 18; compute word count from block texts.
    if isinstance(body, list):
        word_count = sum(
            len(b.get("text", "").split()) if isinstance(b, dict)
            else len(getattr(b, "text", "").split())
            for b in body
        )
    else:
        word_count = len(str(body).split()) if body else 0
    return {
        "sectionName": "problemStatement",
        "headline": headline,
        "wordCount": word_count,
    }


@agent_node(
    name="problem",
    emit_event="section-draft",
    payload_builder=_problem_payload,
)
async def problem(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    style_brief = state.get("style_brief") or {}
    # Phase 24 (PRM-01): read operator-editable guidance from RunConfig (loaded
    # once at run start), falling back to the in-code SECTION_GUIDANCE (which is
    # byte-identical to the on-disk seed) when config/key is absent.
    cfg = state.get("config")
    guidance = (
        cfg.section_guidance.get("section_guidance_problem") or SECTION_GUIDANCE
        if cfg
        else SECTION_GUIDANCE
    )
    messages = build_section_writer_prompt(
        section_id="problem",
        section_title="Problem Statement",
        section_guidance=guidance,
        charity=state.get("winning_charity") or {},
        research=state.get("research") or {},
        style_brief=style_brief,
        # Phase 16 NRR-04 / Plan 16-05: forward narrator-aware voice.
        voice_constraints=style_brief.get("voice") or VOICE_CONSTRAINTS,
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
            "body": [],
            "pdfContent": {
                "problemStatement": "",
                "keyDataPoints": [{"stat": "", "source": ""}] * 3,
                "interventionMechanism": "",
            },
        }

    # AGT-17: parallel writers each contribute their OWN key to
    # model_versions. The DispatchState Annotated reducer (state.py)
    # merges all 7 fan-out branches into the same dict. Returning only
    # owned keys avoids the InvalidUpdate race on shared keys (Phase 4-12 fix).
    return {
        "problem_statement": out_dict,
        "model_versions": {"problem": usage["resolved_model"]},
    }
