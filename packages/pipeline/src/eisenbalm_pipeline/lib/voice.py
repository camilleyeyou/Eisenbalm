"""Phase 5 D-13 — single source of truth for Jesse voice + prompt assembly.

Every section writer agent (origin_story, problem, founder_bio, case_study,
bonus, game) MUST call ``build_section_writer_prompt(...)`` to assemble its
message list. No writer reads any other section's output. This enforces
AGT-09 ("structurally isolated voiceConstraints block, not concatenated
with prior agent state") in code, not by convention.

The VOICE_CONSTRAINTS string is derived verbatim from
``docs/CLAUDE_CODE_BRIEF.md`` lines 359-367 ("Voice and tone notes for
agent prompts"). Treat it as a configuration artifact: if Andrew refines
the voice, edit this string + the rubric.md (Plan 05-15), then commit.
"""
from __future__ import annotations

from typing import Any

VOICE_CONSTRAINTS = (
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
        voice_constraints: defaults to VOICE_CONSTRAINTS.

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
