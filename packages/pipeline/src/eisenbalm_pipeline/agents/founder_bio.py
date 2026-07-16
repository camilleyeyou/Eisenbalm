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

from pydantic import BaseModel, field_validator

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.blocks import BodyBlock, ClaimSpanRef
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
    "400-600 word biography of the named founder. Fortune-500 treatment. "
    "Present professional trajectory with precision. Do not editorialize. "
    "The name is verified; use it freely."
)
GUIDANCE_VERIFIED = GUIDANCE_VERIFIED + STRUCTURE_CONTRACT

GUIDANCE_ANONYMOUS: str = (
    "400-600 word biography of the {role} of the charity. "
    "CRITICAL: Do NOT use or guess a name. Refer by role only: "
    "\"The {role}\", \"they\", \"their\". The anonymity is intentional "
    "and professional — frame it as standard Fortune-500 anonymity."
)
GUIDANCE_ANONYMOUS = GUIDANCE_ANONYMOUS + STRUCTURE_CONTRACT


class FounderBioOutput(BaseModel):
    headline: str = ""
    body: list[BodyBlock] = []  # Phase 18 D-01 (was: body: str = "")
    claimSpans: list[ClaimSpanRef] = []  # Phase 35 PRV-02 (D-05) — additive; NOT part of the structural floor

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

    Phase 24 (PRM-01): ``section_guidance`` is the operator-editable map from
    ``RunConfig.section_guidance`` (keys ``founder_bio_verified`` /
    ``founder_bio_anonymous``). When present, the matching key's content is the
    template source; otherwise the in-code GUIDANCE_* constants are used (which
    are byte-identical to the on-disk seed). The anonymous template — from EITHER
    source — keeps its runtime ``.format(role=role)`` (the literal ``{role}``
    placeholder is stored UNFORMATTED in both the constant and the .md seed).
    """
    sg = section_guidance or {}
    verified = bool(research.get("founderNameVerified"))
    if verified:
        verified_guidance = sg.get("founder_bio_verified") or GUIDANCE_VERIFIED
        return verified_guidance, dict(research)

    role = research.get("founderRole") or "founder"
    scrubbed = {k: v for k, v in research.items() if k != "founderName"}
    scrubbed["founderName"] = None  # explicit null prevents schema-based fallback
    anonymous_guidance = sg.get("founder_bio_anonymous") or GUIDANCE_ANONYMOUS
    return anonymous_guidance.format(role=role), scrubbed


def _founder_bio_payload(state: DispatchState) -> dict:
    section = state.get("founder_bio") or {}
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
        "sectionName": "founderBio",
        "headline": headline,
        "wordCount": word_count,
    }


@agent_node(
    name="founder_bio",
    emit_event="section-draft",
    payload_builder=_founder_bio_payload,
)
async def founder_bio(state: DispatchState) -> DispatchState:
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
    # Phase 35 PRV-02: terse claims whitelist (claimId + text only) so the
    # writer can bind a body phrase to a real research claim ID via claimSpans.
    # Computed from the UNSCRUBBED research dict — claims are unrelated to
    # the founderName scrub (RESEARCH Pitfall 5).
    claims = [
        {"claimId": c["claimId"], "text": c["text"]}
        for c in research.get("claims", [])
    ]

    messages = build_section_writer_prompt(
        section_id="founder_bio",
        section_title="Founder Bio",
        section_guidance=guidance,
        charity=state.get("winning_charity") or {},
        research=scrubbed_research,
        style_brief=style_brief,
        # Phase 47 (BRF-05): thread the Story Brief so this writer drafts
        # FROM it. state.get("brief") is None on legacy/no-brief runs —
        # build_section_writer_prompt degrades gracefully in that case.
        brief=state.get("brief"),
        # Phase 16 NRR-04 / Plan 16-05: forward narrator-aware voice.
        voice_constraints=style_brief.get("voice") or VOICE_CONSTRAINTS,
        claims=claims,
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
        out_dict = {"headline": "", "body": []}

    # Phase 35 D-07: lenient whitelist-drop — a claimId the writer references
    # that isn't in this run's claims whitelist is dropped (logged, never fatal).
    valid_ids = {c["claimId"] for c in research.get("claims", [])}
    spans = out_dict.get("claimSpans") or []
    kept = [s for s in spans if s.get("claimId") in valid_ids]
    if len(spans) != len(kept):
        import logging
        logging.getLogger(__name__).info(
            "%s: dropped %d claimSpan(s) with unknown claimId (D-07 lenient)",
            "founder_bio", len(spans) - len(kept),
        )
    out_dict["claimSpans"] = kept

    # AGT-17: parallel writers each contribute their OWN key to
    # model_versions; the DispatchState Annotated reducer merges across
    # the 7 fan-out branches. Returning only owned keys (no **state)
    # avoids the InvalidUpdate race on shared keys (Phase 4-12 fix).
    return {
        "founder_bio": out_dict,
        "model_versions": {"founder_bio": usage["resolved_model"]},
    }
