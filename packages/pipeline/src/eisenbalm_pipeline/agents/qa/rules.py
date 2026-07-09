"""Phase 5 D-01 Layer 1: deterministic QA predicates.

Every hit is ``severity='error'``. The orchestrator (``agents/qa.py``) writes
each finding to Convex ``qaCorrections:insert`` with axis preserved verbatim.

Predicates are pure functions over a single section body (str). They emit
``QAFinding`` NamedTuples. The orchestrator fans these out across all six
section bodies in a single in-process pass — no async, no I/O.

Source: ``.planning/phases/05-agent-quality/05-RESEARCH.md §"Layer 1: Hard
Rules"``. The keyword lists below are the canonical Jesse-voice forbidden
sets — also enforced at prompt assembly in ``lib/voice.py`` and at the
LLM-judge layer in ``agents/qa/judge.py`` + ``agents/qa/rubric.md``.

If Andrew updates the brand voice constants, this list MUST be updated in
lockstep with ``lib/voice.py`` and ``agents/qa/rubric.md`` so the three
defense layers do not drift.

Field naming note (Plan 05-13 / D-01 schema patch):
``QAFinding.reason`` is named to map 1:1 onto Convex
``qaCorrections.reason``. Phase 4's prototype used ``reasoning`` — that name
is gone; agents/qa.py writes ``reason`` directly into the mutation payload.
"""
from __future__ import annotations

import re
from typing import NamedTuple


class QAFinding(NamedTuple):
    """A single QA correction emitted by a Layer-1 predicate or Layer-2 judge.

    Fields match the Convex ``qaCorrections:insert`` validator surface
    (post-Plan 05-01 schema patch) with a 1:1 name mapping:
        section      -> sectionName
        severity     -> severity
        axis         -> axis
        quotedSpan   -> quotedSpan
        reason       -> reason
        suggestedFix -> suggestedFix
    """

    section: str
    severity: str
    axis: str
    quotedSpan: str
    reason: str
    suggestedFix: str


# Forbidden sentiment keywords (CLAUDE_CODE_BRIEF voice notes + RESEARCH).
SENTIMENT_KEYWORDS: list[str] = [
    r"\bheartwarming\b",
    r"\binspiring\b",
    r"\bincredible\b",
    r"\bamazing\b",
    r"\btruly\b",
    r"\bsimply\b",
    r"\bjourney of\b",
    r"\bpassion\b",
    r"\btransformative\b",
    r"\bempowering\b",
    r"\blife[-\s]changing\b",
    r"\bremarkable\b",
    r"\bbeautiful work\b",
    r"\bhumbling\b",
]

# Forbidden winking / irony-signaling constructions.
WINKING_PATTERNS: list[str] = [
    r"if you can call it that",
    r"believe it or not",
    r"\bof sorts\b",
    r"for lack of a better word",
    r"so to speak",
    r"as they say",
]

# Forbidden AI self-reference — Jesse was born AI; the brand does not pivot.
AI_SELF_REFERENCE: list[str] = [
    r"\bas an AI\b",
    r"\blanguage model\b",
    r"\bI was trained\b",
    r"\bmy training\b",
    r"\bI am an AI\b",
    r"\bAI assistant\b",
]

# Machine-tell (AI-slop) lexicon — Phase 36 D-05. A CONSERVATIVE, high-precision
# v1 set: severity is "error" and gates the "Sounds human" sign-off (Phase 36
# D-12), so this list favors precision over recall. False positives are
# dismissed by Andrew via "Keep (not a tell)" on the Voice Pass screen
# (Phase 36 D-09); Andrew extends this list over time. Exact contents are
# Claude's-discretion v1 per 36-CONTEXT D-05 — cross-verified against common
# LLM-generated-prose tells (36-RESEARCH.md).
#
# LOCKSTEP NOTE: unlike SENTIMENT_KEYWORDS / WINKING_PATTERNS / AI_SELF_REFERENCE
# above, this lexicon is NOT mirrored into ``lib/voice.py`` prompt-assembly
# forbidden sets in v1 (Claude's discretion, 36-CONTEXT D-05) — it is a
# Voice-Pass-specific detection-time addition, not a generation-time
# constraint. It IS documented (by pointer, not restatement) in
# ``agents/qa/rubric.md``; keep that pointer in sync if this list changes.
MACHINE_TELL_LEXICON: list[str] = [
    r"\bdelv(e|es|ing)\b",
    r"\btapestr(y|ies)\b",
    r"\ba testament to\b",
    r"\bin the realm of\b",
    r"\bit'?s important to note\b",
    r"\bit'?s worth noting\b",
    r"\bnavigat\w* the (landscape|complexities|complex)\b",
    r"\bunderscore(s|d)? the (importance|need|significance)\b",
    r"\bnot only\b[^.!?]{0,60}\bbut also\b",
    r"\bat the end of the day\b",
    r"\bever[-\s]evolving\b",
    r"\bplays? a (pivotal|crucial|vital) role\b",
]


def check_exclamation_marks(section_id: str, body: str) -> list[QAFinding]:
    """Forbidden: any exclamation mark.

    Gravity axis: Fortune-500 voice does not exclaim. Quoted span gives
    Andrew enough context (40 chars before, 10 after) to find the offender.
    """
    findings: list[QAFinding] = []
    for m in re.finditer(r"!", body):
        span = body[max(0, m.start() - 40):m.end() + 10].strip()
        findings.append(
            QAFinding(
                section=section_id,
                severity="error",
                axis="gravity",
                quotedSpan=span,
                reason="Exclamation marks are forbidden in Jesse voice.",
                suggestedFix="Replace with a period or rewrite for declarative force.",
            )
        )
    return findings


def check_sentiment_keywords(section_id: str, body: str) -> list[QAFinding]:
    """Forbidden: sentiment keywords from the canonical list."""
    findings: list[QAFinding] = []
    for pattern in SENTIMENT_KEYWORDS:
        for m in re.finditer(pattern, body, re.IGNORECASE):
            span = body[max(0, m.start() - 30):m.end() + 30].strip()
            findings.append(
                QAFinding(
                    section=section_id,
                    severity="error",
                    axis="sentiment",
                    quotedSpan=span,
                    reason=(
                        f"Sentiment keyword '{m.group()}' forbidden in Jesse voice."
                    ),
                    suggestedFix="Replace with a precise, neutral observation.",
                )
            )
    return findings


def check_winking(section_id: str, body: str) -> list[QAFinding]:
    """Forbidden: winking constructions (irony-signaling)."""
    findings: list[QAFinding] = []
    for pattern in WINKING_PATTERNS:
        for m in re.finditer(pattern, body, re.IGNORECASE):
            span = body[max(0, m.start() - 30):m.end() + 30].strip()
            findings.append(
                QAFinding(
                    section=section_id,
                    severity="error",
                    axis="irony-signaling",
                    quotedSpan=span,
                    reason=(
                        f"Winking construction '{m.group()}' breaks Jesse voice."
                    ),
                    suggestedFix="State the observation plainly without hedging.",
                )
            )
    return findings


def check_ai_reference(section_id: str, body: str) -> list[QAFinding]:
    """Forbidden: any reference to AI / language models / training.

    Axis is ``gravity`` (not its own axis): self-reference is a Fortune-500
    gravity failure — the brand does not break the fourth wall.
    """
    findings: list[QAFinding] = []
    for pattern in AI_SELF_REFERENCE:
        for m in re.finditer(pattern, body, re.IGNORECASE):
            span = body[max(0, m.start() - 30):m.end() + 30].strip()
            findings.append(
                QAFinding(
                    section=section_id,
                    severity="error",
                    axis="gravity",
                    quotedSpan=span,
                    reason=(
                        "AI self-reference breaks the brand. Jesse was born AI; "
                        "this is not a gimmick."
                    ),
                    suggestedFix=(
                        "Rewrite without any reference to AI, models, or Jesse's nature."
                    ),
                )
            )
    return findings


def check_machine_tell(section_id: str, body: str) -> list[QAFinding]:
    """Forbidden: AI-slop machine-tells from the canonical lexicon.

    Axis is its own axis (``machine-tell``, not ``sentiment``/``gravity``) —
    Phase 36 D-05: the current Jesse-voice forbidden sets (sentiment /
    winking / AI-reference) don't cover generic LLM-prose tells like "delve"
    or "a testament to". Mirrors ``check_sentiment_keywords`` verbatim in
    structure.
    """
    findings: list[QAFinding] = []
    for pattern in MACHINE_TELL_LEXICON:
        for m in re.finditer(pattern, body, re.IGNORECASE):
            span = body[max(0, m.start() - 30):m.end() + 30].strip()
            findings.append(
                QAFinding(
                    section=section_id,
                    severity="error",
                    axis="machine-tell",
                    quotedSpan=span,
                    reason=(
                        f"Machine-tell '{m.group()}' — reads as AI slop, not "
                        "Jesse voice."
                    ),
                    suggestedFix=(
                        "Rewrite in Jesse's dry, precise register; delete the tell."
                    ),
                )
            )
    return findings


def check_unverified_name(
    section_id: str,
    body: str,
    research: dict,
) -> list[QAFinding]:
    """AGT-10 backstop: catch first-name use when *NameVerified is False.

    Scoped to ``founder_bio`` (``founderName`` / ``founderNameVerified``) and
    ``case_study`` (``subjectName`` / ``subjectNameVerified``). Other
    sections are out of scope — they should not be naming the founder or
    case-study subject at all.

    Pattern: case-insensitive whole-word match on the FIRST name only.
    Conservative: if the founder/subject name field is empty or the
    verification flag is missing, no finding fires.
    """
    findings: list[QAFinding] = []
    if section_id == "founder_bio" and not research.get("founderNameVerified"):
        founder_name = research.get("founderName") or ""
        if founder_name:
            first = founder_name.split()[0]
            if re.search(r"\b" + re.escape(first) + r"\b", body, re.IGNORECASE):
                findings.append(
                    QAFinding(
                        section=section_id,
                        severity="error",
                        axis="precision",
                        quotedSpan=first,
                        reason=(
                            f"founderNameVerified=False but '{first}' appears in body."
                        ),
                        suggestedFix=(
                            "Replace with role-based framing: 'The founder', "
                            "'they', 'their'."
                        ),
                    )
                )
    if section_id == "case_study" and not research.get("subjectNameVerified"):
        subject_name = research.get("subjectName") or ""
        if subject_name:
            first = subject_name.split()[0]
            if re.search(r"\b" + re.escape(first) + r"\b", body, re.IGNORECASE):
                findings.append(
                    QAFinding(
                        section=section_id,
                        severity="error",
                        axis="precision",
                        quotedSpan=first,
                        reason=(
                            f"subjectNameVerified=False but '{first}' appears in body."
                        ),
                        suggestedFix=(
                            "Replace with role-based framing: 'a {subjectRole}', "
                            "'they', 'their'."
                        ),
                    )
                )
    return findings


def run_all_predicates(
    sections: dict[str, str],
    research: dict,
) -> list[QAFinding]:
    """Fan all Layer-1 predicates across every section body.

    Args:
        sections: ``{section_id: body}`` flat dict produced by
            ``agents/qa._extract_sections``. Section IDs are the six writer
            agent IDs (origin_story, problem, founder_bio, case_study, game,
            bonus). Empty bodies are tolerated — predicates simply emit no
            findings.
        research: ``state['research']`` dict. Used only by
            ``check_unverified_name``.

    Returns:
        Flat list of QAFinding NamedTuples — order is stable per section per
        predicate. The orchestrator writes each finding to Convex.
    """
    all_findings: list[QAFinding] = []
    for section_id, body in sections.items():
        all_findings.extend(check_exclamation_marks(section_id, body))
        all_findings.extend(check_sentiment_keywords(section_id, body))
        all_findings.extend(check_winking(section_id, body))
        all_findings.extend(check_ai_reference(section_id, body))
        all_findings.extend(check_machine_tell(section_id, body))
        all_findings.extend(check_unverified_name(section_id, body, research))
    return all_findings
