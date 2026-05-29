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
"""Phase 5 FounderBioWriter — Sonnet via OpenRouter.

Replaces Phase 4 stub. Branches on ``state['research']['founderNameVerified']``:

  - True  → write biography by name (Fortune-500 treatment)
  - False → role-only framing; scrub ``founderName`` from research dict before
            passing into build_section_writer_prompt (RESEARCH Pitfall 5,
            CONTEXT D-12).

Voice-isolation enforced via lib/voice.build_section_writer_prompt() (AGT-09).
AGT-17: resolved model recorded into state['model_versions']['founder_bio'].
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, build_section_writer_prompt


GUIDANCE_VERIFIED: str = (
    "400-600 word biography of the named founder. Fortune-500 treatment. "
    "Present professional trajectory with precision. Do not editorialize. "
    "The name is verified; use it freely."
)

GUIDANCE_ANONYMOUS: str = (
    "400-600 word biography of the {role} of the charity. "
    "CRITICAL: Do NOT use or guess a name. Refer by role only: "
    "\"The {role}\", \"they\", \"their\". The anonymity is intentional "
    "and professional — frame it as standard Fortune-500 anonymity."
)


class FounderBioOutput(BaseModel):
    headline: str = ""
    body: str = ""


def _select_guidance_and_scrub(research: dict) -> tuple[str, dict]:
    """Return ``(guidance, scrubbed_research)``.

    Per RESEARCH Pitfall 5: when ``founderNameVerified=False``, REMOVE
    ``founderName`` from the research dict before passing it into the
    section-writer prompt — otherwise the LLM treats the unverified name
    as authoritative and hallucinates around it.

    Verified path: returns ``GUIDANCE_VERIFIED`` plus a shallow copy of the
    research dict with founderName preserved.

    Unverified path: returns ``GUIDANCE_ANONYMOUS`` formatted with the role
    (defaults to "founder" when ``founderRole`` is absent) plus a research
    dict with ``founderName`` explicitly set to None.
    """
    verified = bool(research.get("founderNameVerified"))
    if verified:
        return GUIDANCE_VERIFIED, dict(research)

    role = research.get("founderRole") or "founder"
    scrubbed = {k: v for k, v in research.items() if k != "founderName"}
    scrubbed["founderName"] = None  # explicit null prevents schema-based fallback
    return GUIDANCE_ANONYMOUS.format(role=role), scrubbed


def _founder_bio_payload(state: DispatchState) -> dict:
    section = state.get("founder_bio") or {}
    body = section.get("body", "") if isinstance(section, dict) else ""
    headline = section.get("headline", "") if isinstance(section, dict) else ""
    return {
        "sectionName": "founderBio",
        "headline": headline,
        "wordCount": len(body.split()) if body else 0,
    }


@agent_node(
    name="founder_bio",
    emit_event="section-draft",
    payload_builder=_founder_bio_payload,
)
async def founder_bio(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    research = state.get("research") or {}
    guidance, scrubbed_research = _select_guidance_and_scrub(research)
    style_brief = state.get("style_brief") or {}

    messages = build_section_writer_prompt(
        section_id="founder_bio",
        section_title="Founder Bio",
        section_guidance=guidance,
        charity=state.get("winning_charity") or {},
        research=scrubbed_research,
        style_brief=style_brief,
        # Phase 16 NRR-04 / Plan 16-05: forward narrator-aware voice.
        voice_constraints=style_brief.get("voice") or VOICE_CONSTRAINTS,
    )
    out_obj, usage = await acomplete(
        agent_id="founder_bio",
        run_id=run_id,
        messages=messages,
        response_format=FounderBioOutput,
    )

    # Defensive dict extraction.
    out_dict: dict[str, Any]
    if hasattr(out_obj, "model_dump"):
        out_dict = out_obj.model_dump()
    elif isinstance(out_obj, dict):
        out_dict = dict(out_obj)
    else:
        out_dict = {"headline": "", "body": ""}

    # AGT-17: parallel writers each contribute their OWN key to
    # model_versions; the DispatchState Annotated reducer merges across
    # the 7 fan-out branches. Returning only owned keys (no **state)
    # avoids the InvalidUpdate race on shared keys (Phase 4-12 fix).
    return {
        "founder_bio": out_dict,
        "model_versions": {"founder_bio": usage["resolved_model"]},
    }
