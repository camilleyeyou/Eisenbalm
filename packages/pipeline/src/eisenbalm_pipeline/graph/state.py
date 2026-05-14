"""LangGraph state contract — DispatchState + 9 nested TypedDicts.

VERBATIM from docs/API_CONTRACTS.md §7 (lines 1185-1291). Do not add fields
without first updating API_CONTRACTS.md. CLAUDE.md rule: "do not modify
field names without checking API_CONTRACTS.md first."

The only additions to DispatchState beyond §7 are two underscore-prefixed
test-only toggles at the end (see research §"Open Questions" Q3).
"""
from __future__ import annotations

from typing import Literal, Optional, TypedDict


class StyleBrief(TypedDict):
    voice: str                          # Jesse voice constraints for this issue
    constraints: list[str]              # specific rules this week
    bonusType: Literal['bigBudget', 'jingle', 'specAd']
    visualDirection: str                # aesthetic direction for Design agent
    previousBonusTypes: list[str]       # to avoid repeating


class CharityCandidate(TypedDict):
    name: str
    location: str
    website: str
    charityNavigatorUrl: Optional[str]
    guidestarUrl: Optional[str]
    foundingYear: Optional[int]
    assetRange: str                     # e.g. "$100K–$500K"
    focusArea: str
    missionStatement: str
    scoutSummary: str                   # why Scout surfaced this one
    whyOverlooked: str                  # the specific reason it's overlooked
    advocateArgument: Optional[str]     # populated by Advocate
    advocateScore: Optional[int]        # 1–10, populated by Advocate


class ResearchOutput(TypedDict):
    foundingMoment: str                 # the weird, specific origin moment
    founderName: str
    founderBackground: str
    caseStudySubject: str               # name/description of one real person
    caseStudyOutcome: str               # what happened to them
    verifiedFacts: list[str]            # fact-checked claims with sources
    sources: list[str]                  # URLs used


class SectionContent(TypedDict):
    headline: str
    body: str                           # plain text, paragraphs separated by \n\n


class CaseStudyContent(TypedDict):
    subjectName: str
    headline: str
    body: str


class GameContent(TypedDict):
    headline: str
    description: str
    embedCode: str                      # self-contained HTML/JS for iframe srcdoc


class BonusContent(TypedDict):
    headline: str
    body: str
    lyrics: Optional[str]               # jingle only
    sunoPrompt: Optional[str]           # jingle only


class Theme(TypedDict):
    primaryColor: str                   # hex, e.g. "#1D4E89"
    accentColor: str
    backgroundColor: str
    textColor: str
    fontDisplay: str                    # Google Fonts name
    fontBody: str
    visualDirection: str                # text description for Andrew


class QACorrection(TypedDict):
    sectionName: str
    fieldName: str
    original: str
    corrected: str
    reason: str
    severity: Literal['minor', 'moderate', 'major']
    accepted: bool                      # set by Editor final


class DispatchState(TypedDict):
    # ── Identity ──────────────────────────────────────────────────────────────
    run_id: str                         # UUID, set at pipeline start
    issue_number: int
    publish_date: str                   # ISO 8601 date, e.g. "2026-05-14"
    pipeline_started_at: str            # ISO 8601 datetime

    # ── Phase 1: Selection ────────────────────────────────────────────────────
    style_brief: Optional[StyleBrief]
    candidates: Optional[list[CharityCandidate]]
    winning_charity: Optional[CharityCandidate]
    winning_charity_sanity_id: Optional[str]    # set after Sanity write
    deliberation_transcript: Optional[str]      # full Scout+Advocate+Editor text
    editor_decision: Optional[str]              # why this charity won
    runner_up_notes: Optional[str]

    # ── Phase 2: Content (populated in parallel) ───────────────────────────────
    research: Optional[ResearchOutput]
    origin_story: Optional[SectionContent]
    problem_statement: Optional[SectionContent]
    problem_pdf_content: Optional[str]          # structured text for PDF generator
    founder_bio: Optional[SectionContent]
    case_study: Optional[CaseStudyContent]
    game: Optional[GameContent]
    bonus: Optional[BonusContent]
    theme: Optional[Theme]

    # ── Post-parallel ──────────────────────────────────────────────────────────
    qa_corrections: Optional[list[QACorrection]]
    editor_final_notes: Optional[str]

    # ── Pipeline output ────────────────────────────────────────────────────────
    sanity_issue_id: Optional[str]              # set after writing draft to Sanity
    model_versions: Optional[dict[str, str]]    # agent_id -> model name

    # ── Error handling ─────────────────────────────────────────────────────────
    error: Optional[str]

    # ── Phase 4 test toggles (NOT part of API_CONTRACTS §7) ───────────────────
    # Underscore prefix signals non-canonical, test-only.
    # See 04-RESEARCH.md §"Open Questions" Q3.
    _force_no_winner: Optional[bool]
    _force_fail_agent: Optional[str]
