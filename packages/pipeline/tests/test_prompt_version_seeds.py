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

import json

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

# Agent _build_messages functions — the canonical byte-source for user templates.
from eisenbalm_pipeline.agents import scout as scout_agent
from eisenbalm_pipeline.agents import advocate as advocate_agent
from eisenbalm_pipeline.agents import calibrator as calibrator_agent
from eisenbalm_pipeline.agents import editor as editor_agent
from eisenbalm_pipeline.agents import researcher as researcher_agent
from eisenbalm_pipeline.agents import game as game_agent
from eisenbalm_pipeline.agents.design import _build_messages as design_build_messages
from eisenbalm_pipeline.agents import bonus as bonus_agent
from eisenbalm_pipeline.lib.search_client import SearchResult


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


# ── User templates (Plan 04a) ─────────────────────────────────────────────────

# The externalized user-prompt template agentKeys. Each entry pairs the loader
# key with a callable that returns (expected_user_string, substituted_template).
# expected_user_string is lifted verbatim from the agent's _build_messages()
# user message; substituted_template is load_prompt(key) with the SAME runtime
# tokens substituted via str.replace(). Byte-equivalence holds iff the two match.
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


# Synthetic fixtures shared across the builders. Values are arbitrary but fixed
# so the byte-comparison is deterministic. No config => disk-fallback path.
_STATE: dict = {}
_CHARITY = {
    "name": "The Quiet Foundation",
    "location": "Vermont",
    "focusArea": "library acoustics",
    "missionStatement": "Preserve the acoustic environment of public libraries.",
    "scoutSummary": "A small Vermont charity preserving library acoustic environments.",
    "advocateScore": 8,
    "advocateArgument": "It treats silence as infrastructure.",
}
_STYLE_BRIEF = {"visualDirection": "Quiet serif gravity, paper-white restraint."}
_TAVILY = [
    SearchResult(
        url="https://example.org/quiet-foundation",
        title="The Quiet Foundation",
        content="A small Vermont charity preserving library acoustic environments.",
        score=0.9,
    ),
    SearchResult(
        url="https://example.org/quiet-foundation/about",
        title="About",
        content="Founded to keep reading rooms quiet.",
        score=0.7,
    ),
]


def _user_of(messages: list[dict]) -> str:
    """Pull the user-role message content out of a _build_messages() result."""
    return next(m["content"] for m in messages if m["role"] == "user")


def _expected_and_substituted(agent_key: str) -> tuple[str, str]:
    """Return (in-code user string, load_prompt(key)-with-tokens-substituted).

    Byte-equivalence of these two strings IS the migration contract: the .md
    template with {token} placeholders, after the SAME runtime substitutions
    the agent performs, reproduces the original inline user string byte-for-byte.
    """
    if agent_key == "scout_user":
        results_block = "\n\n".join(
            f"URL: {r.url}\nTitle: {r.title}\nContent: {r.content[:600]}"
            for r in _TAVILY
        )
        expected = _user_of(
            scout_agent._build_messages(
                config=None, tavily_results=_TAVILY, featured_keys=[]
            )
        )
        sub = load_prompt(agent_key).replace("{results_block}", results_block)
        return expected, sub

    if agent_key == "advocate_user":
        candidates = [_CHARITY]
        candidates_json = json.dumps(candidates, indent=2, default=str)
        expected = _user_of(
            advocate_agent._build_messages(state=_STATE, candidates=candidates)
        )
        sub = load_prompt(agent_key).replace("{candidates_json}", candidates_json)
        return expected, sub

    if agent_key == "calibrator_user":
        expected = _user_of(
            calibrator_agent._build_messages(
                state=_STATE,
                issue_number=42,
                previous_bonus_types=[],
                chosen_bonus_type="specAd",
            )
        )
        # Static template — no tokens.
        sub = load_prompt(agent_key)
        return expected, sub

    if agent_key == "editor_gate1_user":
        sorted_candidates = [_CHARITY]
        cleaned = [
            {
                "name": c.get("name"),
                "location": c.get("location"),
                "focusArea": c.get("focusArea"),
                "missionStatement": c.get("missionStatement"),
                "scoutSummary": c.get("scoutSummary"),
                "advocateScore": c.get("advocateScore"),
                "advocateArgument": c.get("advocateArgument"),
            }
            for c in sorted_candidates
        ]
        candidates_block = json.dumps(cleaned, indent=2)
        expected = _user_of(
            editor_agent._build_messages(
                state=_STATE,
                candidates_with_scores=sorted_candidates,
                issue_number=42,
            )
        )
        sub = (
            load_prompt(agent_key)
            .replace("{issue_number}", "42")
            .replace("{candidates_block}", candidates_block)
        )
        return expected, sub

    if agent_key == "editor_final_user":
        state = {
            "qa_corrections": [{"field": "headline", "severity": "minor"}],
            "origin_story": {"headline": "Origin"},
            "problem_statement": {"headline": "Problem"},
            "founder_bio": {"headline": "Founder"},
            "case_study": {"headline": "Case"},
            "game": {"headline": "Game"},
            "bonus": {"headline": "Bonus"},
        }
        qa_corrections = state["qa_corrections"]
        section_headlines = {
            "origin_story": state["origin_story"]["headline"],
            "problem": state["problem_statement"]["headline"],
            "founder_bio": state["founder_bio"]["headline"],
            "case_study": state["case_study"]["headline"],
            "game": state["game"]["headline"],
            "bonus": state["bonus"]["headline"],
        }
        expected = _user_of(editor_agent._build_editor_final_messages(state))
        sub = (
            load_prompt(agent_key)
            .replace("{qa_corrections_json}", json.dumps(qa_corrections, indent=2))
            .replace(
                "{section_headlines_json}", json.dumps(section_headlines, indent=2)
            )
        )
        return expected, sub

    if agent_key == "researcher_user":
        # §35.1/§35.2 (Phase 35 PRV-01): _build_messages now prefixes each
        # result with a stable [Si] index label — mirror that here so this
        # duplicated reconstruction stays byte-equivalent to production.
        results_block = "\n\n---\n\n".join(
            f"[S{i}] URL: {r.url}\nTitle: {r.title}\nContent: {r.content[:1200]}"
            for i, r in enumerate(_TAVILY)
        )
        expected = _user_of(
            researcher_agent._build_messages(
                state=_STATE, charity=_CHARITY, tavily_results=_TAVILY
            )
        )
        sub = (
            load_prompt(agent_key)
            .replace("{charity}", f"{_CHARITY}")
            .replace("{results_block}", results_block)
        )
        return expected, sub

    if agent_key == "game_user":
        expected = _user_of(game_agent._build_messages(_STATE, _CHARITY))
        sub = (
            load_prompt(agent_key)
            .replace("{charity_name}", _CHARITY["name"])
            .replace("{mission_statement}", _CHARITY["missionStatement"])
        )
        return expected, sub

    if agent_key == "design_user":
        expected = _user_of(
            design_build_messages(
                state=_STATE,
                charity=_CHARITY,
                style_brief=_STYLE_BRIEF,
                retry_errors=None,
            )
        )
        sub = (
            load_prompt(agent_key)
            .replace("{charity_name}", _CHARITY["name"])
            .replace("{visual_direction}", _STYLE_BRIEF["visualDirection"])
        )
        return expected, sub

    if agent_key in ("bonus_big_budget_user", "bonus_jingle_user", "bonus_spec_ad_user"):
        builder = {
            "bonus_big_budget_user": bonus_agent._build_big_budget_prompt,
            "bonus_jingle_user": bonus_agent._build_jingle_prompt,
            "bonus_spec_ad_user": bonus_agent._build_spec_ad_prompt,
        }[agent_key]
        expected = _user_of(builder(_STATE, _CHARITY, _STYLE_BRIEF))
        sub = (
            load_prompt(agent_key)
            .replace("{charity_name}", _CHARITY["name"])
            .replace("{mission_statement}", _CHARITY["missionStatement"])
            .replace("{visual_direction}", _STYLE_BRIEF["visualDirection"])
        )
        return expected, sub

    raise AssertionError(f"unknown agent_key {agent_key!r}")


@pytest.mark.parametrize("agent_key", USER_TEMPLATE_KEYS)
def test_user_template_seed_byte_equivalence(agent_key: str):
    """Each externalized user-template agentKey must load to its in-code source.

    The expected user string is built by calling the agent's own
    ``_build_messages(...)`` with fixed synthetic inputs (disk-fallback path,
    no config). The seeded ``prompts/<key>_user.md`` template, after the SAME
    token substitutions, must equal that string byte-for-byte.
    """
    expected, substituted = _expected_and_substituted(agent_key)
    assert substituted == expected, (
        f"{agent_key}: load_prompt() + token substitution diverged from the "
        f"inline _build_messages user string."
    )
