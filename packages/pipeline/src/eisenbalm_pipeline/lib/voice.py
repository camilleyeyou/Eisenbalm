"""Phase 5 D-13 + Phase 16 D-01..D-13 — single source of truth for Jesse voice
+ narrator-aware voice assembly + prompt assembly.

Every section writer agent (origin_story, problem, founder_bio, case_study,
bonus, game) MUST call ``build_section_writer_prompt(...)`` to assemble its
message list. No writer reads any other section's output. This enforces
AGT-09 ("structurally isolated voiceConstraints block, not concatenated
with prior agent state") in code, not by convention.

Phase 16 (Choose Your Narrator) decomposes ``VOICE_CONSTRAINTS`` into two
named constants — ``UNIVERSAL_CORE`` (the narrator-agnostic hard-rule block:
DEL-04 no-AI, Fortune-500 gravity, forbidden words / winking constructions /
passive hedging / compliment-adjectives, no-exclamation-marks) and
``JESSE_PERSONA_BLOCK`` (the Jesse-specific register / cadence line). The
``assemble_voice(narrator)`` helper composes the final voice string the
Calibrator writes to ``style_brief['voice']``.

The composition order is ``JESSE_PERSONA_BLOCK + "\\n" + UNIVERSAL_CORE``
(persona-first, single newline separator). This matches the live Phase 5
``VOICE_CONSTRAINTS`` byte-for-byte (see import-time sentinel at the bottom
of this module) and is the formula chosen for byte-equivalence with the
Phase 14 baseline — NRR-01, NRR-03, NRR-04, NRR-10.

The VOICE_CONSTRAINTS string is derived verbatim from
``docs/CLAUDE_CODE_BRIEF.md`` lines 359-367 ("Voice and tone notes for
agent prompts"). Treat it as a configuration artifact: if Andrew refines
the voice, edit this string + the rubric.md (Plan 05-15), then commit.

NOTE on the Plan 16-04 ``<verified_baseline>`` section: the plan's hypothesis
of a different ``VOICE_CONSTRAINTS`` shape (a "You are Jesse A. Eisenbalm."
persona block + Fortune-500 case-study UNIVERSAL_CORE separated by ``\\n\\n``)
does NOT match the live Phase 5 D-13 string committed at Phase 14 close. The
implementation below uses the LIVE Phase 5 string as truth (per CLAUDE.md
"check that all the required parameters / match the live file" precedence)
and derives a byte-faithful split that satisfies (a) the Plan 16-02 Wave 0
``test_voice.py`` invariants (assemble_voice(None) == VOICE_CONSTRAINTS,
jesse-explicit narrator == VOICE_CONSTRAINTS, UNIVERSAL_CORE contains the
no-AI rule + the no-exclamation rule), and (b) the CONTEXT D-01..D-13
two-tier decomposition (UNIVERSAL_CORE = 4 universal hard-rule groups;
JESSE_PERSONA_BLOCK = Jesse's register lines). The live Phase 5 string
intermingles "The brand does not pivot to AI." with the persona register
line; per D-03 it stays on the persona line (line 0) of VOICE_CONSTRAINTS,
and the no-AI rule is also enforced through line 5's explicit
"Never reference AI, language models, or Jesse's AI nature." — the
``test_universal_core_contains_dem_04_rule`` check is satisfied by line 5.
"""
from __future__ import annotations

from typing import Any, Optional

# ─── Phase 16 D-01..D-13: Two-tier voice decomposition ────────────────────
#
# UNIVERSAL_CORE — non-overridable hard rules. Applies to every narrator
# including Jesse. The Calibrator prepends the active persona block and
# writes the assembled string to style_brief["voice"]. Narrator profiles
# may override the PERSONA block (D-01/D-03) but NEVER override these
# universal rules. The four rule groups per CONTEXT D-02:
#   1. Fortune-500 gravity (charity + founder)
#   2. Forbidden words + winking constructions + no exclamation marks
#   3. DEL-04 no-AI-reference rule
#   4. Compliment-adjectives + passive-hedging bans
#
# NOTE: The winner-authority guardrail is intentionally NOT included in
# UNIVERSAL_CORE. It lives in chronicler._build_system_prompt (per
# 16-RESEARCH §G and 16-06 Task 1). CONTEXT D-04 allows this via
# "or in the chronicler persona-agnostic preamble". CONTEXT canonical_refs
# line 122 is superseded by Research §G analysis — confirmed during plan
# revision: the rule is vacuous for narrative writers (no plausible
# substitution chain can introduce a non-Jesse author voice through their
# inputs). Adding it here would muddy the universal register and would
# force narrative writers to render a Jesse-specific guardrail in their
# system prompt — a byte-equivalence breakage. See chronicler.py for the
# actual preamble constant.
UNIVERSAL_CORE = (
    "Treat every charity with the gravity of a Fortune 500 company.\n"
    "Treat every founder as a visionary regardless of obscurity.\n"
    "Never use exclamation marks. Never use: heartwarming, inspiring, "
    "incredible, amazing, truly, simply, journey of, passion, transformative, "
    "empowering, life-changing, remarkable, humbling, beautiful work.\n"
    "Never use winking constructions: \"if you can call it that\", "
    "\"believe it or not\", \"of sorts\", \"for lack of a better word\", "
    "\"so to speak\", \"as they say\".\n"
    "Never reference AI, language models, or Jesse's AI nature. "
    "Jesse was born AI. This is not a gimmick.\n"
    "Answer the implied question \"Why do you deserve to exist?\" without sentiment.\n"
    "Adjectives that are also compliments (impressive, wonderful, great) are forbidden.\n"
    "Passive hedging (might be, could perhaps, seems to) is forbidden."
)


# JESSE_PERSONA_BLOCK — the register/cadence line for Jesse Eisenbalm. This
# is the second source of truth seeded into apps/studio/seeds/narrators.json
# as narrators[jesse].voiceConstraints (D-10). The seed sentinel test
# (test_narrator_seed_sentinel.test_jesse_seed_matches_persona_block) gates
# any drift between this Python constant and the JSON seed at deploy time.
JESSE_PERSONA_BLOCK = (
    "Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking. "
    "No irony signaling. The brand does not pivot to AI."
)


# _SEPARATOR — the byte-faithful join between persona and universal blocks
# in the live Phase 5 VOICE_CONSTRAINTS string. Per Research Pitfall A-1,
# this MUST match the original separator exactly. The live string uses a
# single \n between the persona line and the first universal rule.
_SEPARATOR = "\n"


# VOICE_CONSTRAINTS — preserved as the literal concatenation of the two
# tiers (persona-first ordering matches the Phase 5 D-13 byte layout).
# Existing direct importers in chronicler.py, calibrator.py, and game.py
# continue to read this symbol unchanged (NRR-04 zero-regression).
VOICE_CONSTRAINTS = JESSE_PERSONA_BLOCK + _SEPARATOR + UNIVERSAL_CORE


# ─── Byte-equivalence sentinel (NRR-01, NRR-03, NRR-04, NRR-10) ───────────
# This is the import-time guard against accidental future drift. The string
# below is the verified Phase 14-close VOICE_CONSTRAINTS content (Phase 5
# D-13 voice, untouched through Phases 6..15). If this assertion trips,
# VOICE_CONSTRAINTS has been edited OR the two-tier decomposition has been
# mis-edited. Either way: do NOT silence the assertion — surface the
# discrepancy and revise the split.
_PHASE_14_VOICE_CONSTRAINTS_BASELINE = (
    "Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking. "
    "No irony signaling. The brand does not pivot to AI.\n"
    "Treat every charity with the gravity of a Fortune 500 company.\n"
    "Treat every founder as a visionary regardless of obscurity.\n"
    "Never use exclamation marks. Never use: heartwarming, inspiring, "
    "incredible, amazing, truly, simply, journey of, passion, transformative, "
    "empowering, life-changing, remarkable, humbling, beautiful work.\n"
    "Never use winking constructions: \"if you can call it that\", "
    "\"believe it or not\", \"of sorts\", \"for lack of a better word\", "
    "\"so to speak\", \"as they say\".\n"
    "Never reference AI, language models, or Jesse's AI nature. "
    "Jesse was born AI. This is not a gimmick.\n"
    "Answer the implied question \"Why do you deserve to exist?\" without sentiment.\n"
    "Adjectives that are also compliments (impressive, wonderful, great) are forbidden.\n"
    "Passive hedging (might be, could perhaps, seems to) is forbidden."
)

assert VOICE_CONSTRAINTS == _PHASE_14_VOICE_CONSTRAINTS_BASELINE, (
    "Phase 16 byte-equivalence sentinel tripped: "
    "VOICE_CONSTRAINTS != _PHASE_14_VOICE_CONSTRAINTS_BASELINE. "
    "The UNIVERSAL_CORE + JESSE_PERSONA_BLOCK split has drifted from the "
    "Phase 14 baseline. See 16-04 plan + 16-RESEARCH §A Pitfall A-1/A-2."
)

assert JESSE_PERSONA_BLOCK + _SEPARATOR + UNIVERSAL_CORE == VOICE_CONSTRAINTS, (
    "Phase 16 byte-equivalence sentinel tripped: "
    "JESSE_PERSONA_BLOCK + _SEPARATOR + UNIVERSAL_CORE != VOICE_CONSTRAINTS. "
    "See 16-04 plan, Verified baseline section."
)


def assemble_voice(narrator: Optional[dict[str, Any]]) -> str:
    """Assemble the final voice string the Calibrator writes to style_brief['voice'].

    Per CONTEXT D-05 (single injection point) and D-13 (byte-equivalence by
    construction), this helper composes the final voice string as:

        persona_block + "\\n" + UNIVERSAL_CORE

    where ``persona_block`` is:
      - ``narrator['voiceConstraints']`` when ``narrator`` is non-None and
        ``narrator.get('active', True)`` is truthy
      - ``JESSE_PERSONA_BLOCK`` otherwise (None, missing voiceConstraints,
        or inactive narrator — though D-14 has the Calibrator catch the
        inactive case earlier and emit a warning event)

    Invariants (asserted by tests/test_voice.py):
      - ``assemble_voice(None) == VOICE_CONSTRAINTS``
      - ``assemble_voice({'voiceConstraints': JESSE_PERSONA_BLOCK, 'active': True})
         == VOICE_CONSTRAINTS``

    Args:
        narrator: loaded NarratorProfile dict (state['narrator']) or None.
            Expected shape: {name, slug, voiceConstraints, voiceRubric,
            exampleSamples, active}.

    Returns:
        The composed voice string ready for ``style_brief['voice']``.
    """
    if narrator and narrator.get("active", True):
        persona_block = narrator.get("voiceConstraints") or JESSE_PERSONA_BLOCK
    else:
        persona_block = JESSE_PERSONA_BLOCK
    return persona_block + _SEPARATOR + UNIVERSAL_CORE


def build_section_writer_prompt(
    *,
    section_id: str,
    section_title: str,
    section_guidance: str,
    charity: dict[str, Any],
    research: dict[str, Any],
    style_brief: dict[str, Any],
    voice_constraints: str = VOICE_CONSTRAINTS,
) -> list[dict[str, str]]:
    """Assemble a section-writer message list with structural voice isolation.

    Critical invariant (AGT-09): this function accepts ONLY the four content
    blocks below. It does NOT accept ``state`` or any other section's
    output. Section writers that try to inject other section content into
    the prompt must do so OUTSIDE this helper — which would be flagged in
    code review.

    Args:
        section_id: agent_id (e.g. "origin_story", "founder_bio"). Used in
            the system prompt header.
        section_title: human-readable section name shown in the user prompt.
        section_guidance: section-specific instructions (word count, focus,
            conditional framing for unverified names). Pre-rendered string —
            writer-specific Jinja-style branching happens upstream.
        charity: dict-shaped from CharityCandidate TypedDict (winning_charity).
            Used fields: name, location, missionStatement, focusArea.
        research: dict-shaped from ResearchOutput TypedDict. Used fields:
            foundingMoment, founderBackground, caseStudySubject,
            caseStudyOutcome, verifiedFacts. NEVER pass founderName when
            founderNameVerified is False (RESEARCH Pitfall 5).
        style_brief: dict-shaped from StyleBrief TypedDict. Used fields:
            bonusType, visualDirection.
        voice_constraints: defaults to VOICE_CONSTRAINTS. Phase 16: writers
            override this with ``style_brief.get("voice", VOICE_CONSTRAINTS)``
            so the narrator voice propagates through Calibrator → writers
            (per Plan 16-05 + Research §C Pitfall C-1).

    Returns:
        A 2-element list of {"role": "system" | "user", "content": str}.
    """
    system = (
        f"You are the {section_id} writer for The Eisenbalm Dispatch.\n\n"
        f"VOICE CONSTRAINTS (non-negotiable):\n{voice_constraints}\n\n"
        f"STYLE BRIEF:\n"
        f"Bonus type for this issue: {style_brief.get('bonusType', '')}\n"
        f"Visual direction: {style_brief.get('visualDirection', '')}\n"
    )

    # Compose research block defensively — omit fields absent from research.
    research_lines: list[str] = []
    if research.get("foundingMoment"):
        research_lines.append(f"Founding moment: {research['foundingMoment']}")
    if research.get("founderBackground"):
        research_lines.append(f"Founder background: {research['founderBackground']}")
    if research.get("caseStudySubject"):
        research_lines.append(f"Case study subject: {research['caseStudySubject']}")
    if research.get("caseStudyOutcome"):
        research_lines.append(f"Case study outcome: {research['caseStudyOutcome']}")
    if research.get("verifiedFacts"):
        research_lines.append("Verified facts:\n  - " + "\n  - ".join(research["verifiedFacts"]))

    user = (
        f"Write the {section_title} section.\n\n"
        f"CHARITY: {charity.get('name', '')} ({charity.get('location', '')})\n"
        f"FOCUS AREA: {charity.get('focusArea', '')}\n"
        f"MISSION: {charity.get('missionStatement', '')}\n\n"
        f"RESEARCH:\n" + "\n".join(research_lines) + "\n\n"
        f"GUIDANCE:\n{section_guidance}\n\n"
        f"Return valid JSON matching the schema for the {section_id} section."
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
