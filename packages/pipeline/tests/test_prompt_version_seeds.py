"""Phase 24 Wave 0 — Byte-equivalence oracle tests for newly-migrated assets.

These tests are the RED scaffold for the Phase 24 asset-externalization waves
(Plans 04a/04b user templates, 05a/05b section guidance + rubric, 06 voice).
They assert that every asset newly migrated into a ``prompt_versions`` v1 seed
is BYTE-IDENTICAL to its in-code constant / on-disk source, loaded back through
the same ``load_prompt()`` oracle the pipeline uses at run start.

RED state: the new ``prompts/*.md`` files do not exist yet, so every
``load_prompt("section_guidance_origin")`` etc. raises FileNotFoundError until
the implementing wave lands. The files import-execute cleanly (no module-level
crash) so ``pytest --collect-only`` discovers all functions — the failures are
assertion/runtime failures inside the test bodies, which is the intended RED.

Byte-source discipline (24-RESEARCH Pitfall 3): the SECTION_GUIDANCE constants
include ``STRUCTURE_CONTRACT`` appended at module load. The seed MUST match the
fully-assembled Python constant (post-append), NOT a raw file read. The
anonymous founder/case-study variants are seeded UNFORMATTED — the constant
still containing the literal ``{role}`` token, before ``.format(role=...)``.
"""
from __future__ import annotations

from importlib.resources import files

import pytest

# In-code byte-source constants (post-STRUCTURE_CONTRACT-append, per Pitfall 3).
from eisenbalm_pipeline.agents.origin_story import SECTION_GUIDANCE as ORIGIN_GUIDANCE
from eisenbalm_pipeline.agents.problem import SECTION_GUIDANCE as PROBLEM_GUIDANCE
from eisenbalm_pipeline.agents.founder_bio import (
    GUIDANCE_VERIFIED as FOUNDER_GUIDANCE_VERIFIED,
    GUIDANCE_ANONYMOUS as FOUNDER_GUIDANCE_ANONYMOUS,
)
from eisenbalm_pipeline.agents.case_study import (
    GUIDANCE_VERIFIED as CS_GUIDANCE_VERIFIED,
    GUIDANCE_ANONYMOUS as CS_GUIDANCE_ANONYMOUS,
)
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS
from eisenbalm_pipeline.lib.prompts import load_prompt


# ── Section guidance (Plan 05a/05b) ───────────────────────────────────────────


def test_section_guidance_seed_byte_equivalence():
    """Each SECTION_GUIDANCE constant must round-trip byte-identically through
    its seeded prompts/*.md file via load_prompt() (PRM-01, Migration).

    The anonymous founder/case-study variants are compared against the
    UNformatted constant (still containing the literal ``{role}`` token).
    """
    assert load_prompt("section_guidance_origin") == ORIGIN_GUIDANCE
    assert load_prompt("section_guidance_problem") == PROBLEM_GUIDANCE
    assert (
        load_prompt("section_guidance_founder_bio_verified")
        == FOUNDER_GUIDANCE_VERIFIED
    )
    assert (
        load_prompt("section_guidance_founder_bio_anonymous")
        == FOUNDER_GUIDANCE_ANONYMOUS
    )
    assert load_prompt("section_guidance_case_study_verified") == CS_GUIDANCE_VERIFIED
    assert (
        load_prompt("section_guidance_case_study_anonymous") == CS_GUIDANCE_ANONYMOUS
    )


def test_anonymous_guidance_seed_retains_role_token():
    """The anonymous variants are seeded UNformatted — the byte-source still
    contains the literal ``{role}`` placeholder (formatted at call time, not
    at seed time). This locks the Pitfall-3 byte-source rule for the seed wave.
    """
    assert "{role}" in FOUNDER_GUIDANCE_ANONYMOUS
    assert "{role}" in CS_GUIDANCE_ANONYMOUS
    assert load_prompt("section_guidance_founder_bio_anonymous") == FOUNDER_GUIDANCE_ANONYMOUS
    assert load_prompt("section_guidance_case_study_anonymous") == CS_GUIDANCE_ANONYMOUS


# ── voice_constraints (Plan 06) ───────────────────────────────────────────────


def test_voice_constraints_seed_byte_equivalence():
    """The voice_constraints seed stores the FULL assembled VOICE_CONSTRAINTS
    string (not just JESSE_PERSONA_BLOCK) — byte-identical (PRM-06)."""
    assert load_prompt("voice_constraints") == VOICE_CONSTRAINTS


# ── QA rubric (Plan 05a/05b) ──────────────────────────────────────────────────


def test_rubric_seed_byte_equivalence():
    """The seeded prompts/rubric.md content must equal the canonical
    agents/qa/rubric.md source byte-for-byte through the load_prompt() oracle.
    """
    qa_rubric_source = (
        files("eisenbalm_pipeline")
        .joinpath("agents", "qa", "rubric.md")
        .read_text("utf-8")
    )
    seeded = load_prompt("rubric")
    assert seeded == qa_rubric_source, (
        "prompts/rubric.md (loader output) diverged from agents/qa/rubric.md. "
        "The seed wave must copy the rubric byte-identically."
    )


# ── User templates (Plan 04a/04b) ─────────────────────────────────────────────

# The externalized user-prompt template agentKeys. The expected per-template
# byte-source string is captured in Plan 04b (lifted verbatim from each agent's
# _build_messages user-message string). Until that lands the expected values are
# unknown, so each is marked xfail — but the file still import-executes and the
# loader keys are enumerated here so Plan 04b has a named check to turn green.
USER_TEMPLATE_KEYS = [
    "scout_user",
    "advocate_user",
    "calibrator_user",
    "editor_gate1_user",
    "editor_final_user",
    "researcher_user",
    "game_user",
    "design_user",
    "bonus_big_budget_user",
    "bonus_jingle_user",
    "bonus_spec_ad_user",
]


@pytest.mark.parametrize("agent_key", USER_TEMPLATE_KEYS)
@pytest.mark.xfail(
    reason="Plan 04b captures the verbatim in-code user-template byte-source "
    "and replaces this xfail with an equality assertion against it.",
    strict=False,
)
def test_user_template_seed_byte_equivalence(agent_key: str):
    """Each externalized user-template agentKey must load to its in-code source.

    RED/xfail until Plan 04b writes the prompts/<key>.md files AND records the
    expected verbatim string. Plan 04b replaces the loader-only assertion below
    with ``load_prompt(agent_key) == EXPECTED_USER_TEMPLATES[agent_key]``.
    """
    # TODO(Plan 04b): assert load_prompt(agent_key) == EXPECTED_USER_TEMPLATES[agent_key]
    loaded = load_prompt(agent_key)
    assert isinstance(loaded, str) and loaded != ""
