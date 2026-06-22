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
"""Phase 5 CaseStudyWriter — Sonnet via OpenRouter.

Replaces Phase 4 stub. Branches on ``state['research']['subjectNameVerified']``:

  - True  → case study by subject name
  - False → role-only framing; scrub ``subjectName`` from research dict
            (RESEARCH Pitfall 5 mirror of FounderBio).

Voice-isolation enforced via lib/voice.build_section_writer_prompt() (AGT-09).
AGT-17: resolved model recorded into state['model_versions']['case_study'].
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, field_validator

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.blocks import BodyBlock
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, build_section_writer_prompt


# Phase 18 D-01/D-02 — appended to GUIDANCE_VERIFIED and GUIDANCE_ANONYMOUS.
# Encodes the structural floor at the prompt layer; the Pydantic
# _enforce_structural_floor validator below is the hard gate (retries once
# via the existing acomplete path on failure).
STRUCTURE_CONTRACT: str = (
    "\n\nSTRUCTURE CONTRACT (non-negotiable):\n"
    "Emit at minimum 2 sub-headers (h2 or h3) and 1 blockquote per section. "
    "Sub-headers: <=6 words, Jesse-voice, break the body into 3+ logical "
    "movements. Blockquote: a single sentence lifted verbatim from the most "
    "quotable line in the body prose - not a generic restatement. "
    "Sub-headers and blockquote serve Jesse's register. "
    "Do not break voice; structural variety is typographic, not tonal."
)

GUIDANCE_VERIFIED: str = (
    "400-600 word case study about the named subject. Present situation "
    "before and after the charity's intervention with measurable outcomes. "
    "The name is verified; use it freely."
)
GUIDANCE_VERIFIED = GUIDANCE_VERIFIED + STRUCTURE_CONTRACT

GUIDANCE_ANONYMOUS: str = (
    "400-600 word case study about {role}. "
    "CRITICAL: Do NOT name the subject. Refer by role: "
    "\"a {role}\", \"they\", \"their\". This is standard privacy practice "
    "for this category of charity."
)
GUIDANCE_ANONYMOUS = GUIDANCE_ANONYMOUS + STRUCTURE_CONTRACT


class CaseStudyOutput(BaseModel):
    subjectName: str = ""
    headline: str = ""
    body: list[BodyBlock] = []  # Phase 18 D-01 (was: body: str = "")

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


def _select_guidance_and_scrub(
    research: dict, section_guidance: dict[str, str] | None = None
) -> tuple[str, dict]:
    """Return ``(guidance, scrubbed_research)``. Mirror of founder_bio.

    Verified path: returns ``GUIDANCE_VERIFIED`` + shallow research copy.
    Unverified path: returns ``GUIDANCE_ANONYMOUS`` formatted with role
    (defaults to "a program participant") + research dict with
    ``subjectName`` explicitly set to None (RESEARCH Pitfall 5 mirror).

    Phase 24 (PRM-01): ``section_guidance`` is the operator-editable map from
    ``RunConfig.section_guidance`` (keys ``case_study_verified`` /
    ``case_study_anonymous``). When present, the matching key's content is the
    template source; otherwise the in-code GUIDANCE_* constants are used (which
    are byte-identical to the on-disk seed). The anonymous template — from EITHER
    source — keeps its runtime ``.format(role=role)`` (the literal ``{role}``
    placeholder is stored UNFORMATTED in both the constant and the .md seed).
    """
    sg = section_guidance or {}
    verified = bool(research.get("subjectNameVerified"))
    if verified:
        verified_guidance = sg.get("case_study_verified") or GUIDANCE_VERIFIED
        return verified_guidance, dict(research)

    role = research.get("subjectRole") or "a program participant"
    scrubbed = {k: v for k, v in research.items() if k != "subjectName"}
    scrubbed["subjectName"] = None
    anonymous_guidance = sg.get("case_study_anonymous") or GUIDANCE_ANONYMOUS
    return anonymous_guidance.format(role=role), scrubbed


def _case_study_payload(state: DispatchState) -> dict:
    section = state.get("case_study") or {}
    body = section.get("body", []) if isinstance(section, dict) else []
    headline = section.get("headline", "") if isinstance(section, dict) else ""
    subject = section.get("subjectName", "") if isinstance(section, dict) else ""
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
        "sectionName": "caseStudy",
        "headline": headline,
        "subjectName": subject,
        "wordCount": word_count,
    }


@agent_node(
    name="case_study",
    emit_event="section-draft",
    payload_builder=_case_study_payload,
)
async def case_study(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    research = state.get("research") or {}
    # Phase 24 (PRM-01): thread the operator-editable guidance map from RunConfig
    # into the selector; it falls back to the in-code GUIDANCE_* when absent.
    cfg = state.get("config")
    section_guidance = cfg.section_guidance if cfg else None
    guidance, scrubbed_research = _select_guidance_and_scrub(
        research, section_guidance
    )
    style_brief = state.get("style_brief") or {}

    messages = build_section_writer_prompt(
        section_id="case_study",
        section_title="Case Study",
        section_guidance=guidance,
        charity=state.get("winning_charity") or {},
        research=scrubbed_research,
        style_brief=style_brief,
        # Phase 16 NRR-04 / Plan 16-05: forward narrator-aware voice.
        voice_constraints=style_brief.get("voice") or VOICE_CONSTRAINTS,
    )
    out_obj, usage = await acomplete(
        agent_id="case_study",
        run_id=run_id,
        messages=messages,
        response_format=CaseStudyOutput,
    )

    # Defensive dict extraction.
    out_dict: dict[str, Any]
    if hasattr(out_obj, "model_dump"):
        out_dict = out_obj.model_dump()
    elif isinstance(out_obj, dict):
        out_dict = dict(out_obj)
    else:
        out_dict = {"headline": "", "body": [], "subjectName": ""}

    # AGT-17: parallel writers each contribute their OWN key to
    # model_versions; the DispatchState Annotated reducer merges across
    # the 7 fan-out branches. Returning only owned keys (no **state)
    # avoids the InvalidUpdate race on shared keys (Phase 4-12 fix).
    return {
        "case_study": out_dict,
        "model_versions": {"case_study": usage["resolved_model"]},
    }
