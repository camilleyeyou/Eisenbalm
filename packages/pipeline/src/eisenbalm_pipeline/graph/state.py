"""LangGraph state contract — DispatchState + 9 nested TypedDicts.

VERBATIM from docs/API_CONTRACTS.md §7 (lines 1185-1291). Do not add fields
without first updating API_CONTRACTS.md. CLAUDE.md rule: "do not modify
field names without checking API_CONTRACTS.md first."

The only additions to DispatchState beyond §7 are two underscore-prefixed
test-only toggles at the end (see research §"Open Questions" Q3).

Plan 05-14 (AGT-17 wiring): ``model_versions`` is wrapped with an
``Annotated`` dict-merge reducer so the 7 parallel section writers can each
contribute their own ``{agent_id: resolved_model}`` entry without racing on
the shared key. The field shape (``dict[str, str]``) is unchanged — only the
LangGraph reducer is added.
"""
from __future__ import annotations

from typing import (
    TYPE_CHECKING,
    Annotated,
    Literal,
    NotRequired,
    Optional,
    TypedDict,
)

if TYPE_CHECKING:
    # Forward-ref only (string annotation below) — importing config_loader at
    # module load would create a runtime circular import (config_loader has no
    # need for state.py, but state.py must stay import-light for the graph).
    from eisenbalm_pipeline.lib.config_loader import RunConfig


def _merge_model_versions(
    left: Optional[dict[str, str]],
    right: Optional[dict[str, str]],
) -> dict[str, str]:
    """LangGraph reducer for the ``model_versions`` field.

    Merges two dicts; ``right`` wins on key collisions (newer agent run
    overwrites). ``None`` operands are treated as empty dicts. The graph
    invokes this on every parallel-branch write to ``model_versions`` so the
    7-way fan-out (origin_story, problem, founder_bio, case_study, game,
    bonus, design) merges cleanly into a single observability surface.
    """
    return {**(left or {}), **(right or {})}


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
    # ── Phase 5 additions (AGT-07, AGT-08, AGT-09, AGT-10) ─────────────────
    # All NotRequired: Researcher may emit None when no source found.
    # verify_research sets *Verified booleans after Researcher returns.
    founderNameSourceUrl: NotRequired[Optional[str]]   # AGT-07: URL where founderName was found
    founderNameVerified: NotRequired[bool]             # AGT-08: set by verify_research node
    founderRole: NotRequired[str]                      # D-12 fallback role e.g. "founder", "executive director"
    subjectName: NotRequired[Optional[str]]            # AGT-09 case study subject name
    subjectNameSourceUrl: NotRequired[Optional[str]]   # AGT-09 verification source
    subjectNameVerified: NotRequired[bool]             # AGT-09: set by verify_research node
    subjectRole: NotRequired[str]                      # D-12 fallback role e.g. "a parent", "a program participant"
    # §35.2 (Phase 35 PRV-01): code-mapped index-bound claims — each dict is
    # {claimId, text, sourceUrl|None, retrievedAt|None}. TypedDict cannot
    # express ClaimOutput's shape precisely; the Pydantic model at the
    # researcher/writer boundary is authoritative (matches the existing
    # body: list[dict] BodyBlock precedent).
    claims: NotRequired[list[dict]]


class SectionContent(TypedDict):
    headline: str
    body: list[dict]                    # Phase 18 D-01: list[BodyBlock] (graph/blocks.py); Pydantic at each writer enforces shape


class CaseStudyContent(TypedDict):
    subjectName: str
    headline: str
    body: list[dict]                    # Phase 18 D-01: list[BodyBlock] (graph/blocks.py); Pydantic at each writer enforces shape


class GameContent(TypedDict):
    headline: str
    description: str
    embedCode: str                      # self-contained HTML/JS for iframe srcdoc


class BonusContent(TypedDict):
    headline: str
    body: list[dict]                    # Phase 18 D-01: SpecAdBonus uses list[BodyBlock]; BigBudget/Jingle still str at writer-Pydantic layer (D-04); TypedDict permissive
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
    severity: Literal['info', 'warning', 'error']  # Phase 5 D-01: aligned with Convex qaCorrections.severity patch
    accepted: bool                      # set by Editor final


class Narrator(TypedDict):
    """Resolved narrator record. Loaded from Sanity by the calibrator agent (Plan 16-05 Task 2).

    Field names mirror the Sanity narratorProfile schema (Plan 16-01 + CONTEXT D-08) verbatim.
    Renaming any field here REQUIRES a matching rename in:
      - apps/studio/schemas/narratorProfile.ts
      - apps/studio/seeds/narrators.json
      - apps/studio/scripts/seed-narrators.ts
      - docs/API_CONTRACTS.md §7
    Per CLAUDE.md hard rule, contract changes happen first.
    """
    name: str                      # display name (Sanity narratorProfile.name)
    slug: str                      # url-slug (Sanity narratorProfile.slug.current — inner string)
    voiceConstraints: str          # PERSONA_BLOCK content (Sanity narratorProfile.voiceConstraints, type: 'text')
    voiceRubric: str               # QA-judge persona rubric, plain text (Sanity narratorProfile.voiceRubric, type: 'text')
    exampleSamples: list[str]      # plain prose samples (Sanity narratorProfile.exampleSamples, array of 'text')
    active: bool                   # narrator on/off switch (Sanity narratorProfile.active; default True; D-14: when False → fall back to Jesse)


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
    deliberation_conversation: Optional[list[dict]]  # Phase 13 (DEL-CONV): Chronicler turns [{"speaker","text"}] — VERBATIM from docs/API_CONTRACTS.md §7
    editor_decision: Optional[str]              # why this charity won
    runner_up_notes: Optional[str]
    editor_confidence: Optional[float]          # Phase 37 §37.2 — EditorDecision.confidence, persisted (was computed then discarded)

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
    # AGT-17: 7 parallel section writers each contribute one entry; the
    # Annotated dict-merge reducer (above) merges branches in the fan-in
    # super-step. Sequential agents (calibrator, scout, advocate, editor_gate1,
    # researcher, qa, editor_final, publisher) write to the same field; the
    # reducer's right-wins behavior is fine for the sequential path because
    # each agent writes its own unique key.
    model_versions: Annotated[
        Optional[dict[str, str]], _merge_model_versions
    ]                                           # agent_id -> model name

    # ── Phase 5 additions ─────────────────────────────────────────────────────
    featured_charity_keys: Optional[list[str]]   # AGT-04: Scout dedup keys (list NOT set — JSON-serializable for LangGraph checkpoint per RESEARCH Pitfall 7)

    # ── Phase 16 additions: Choose Your Narrator (NRR-01, NRR-03, NRR-05) ─────
    # See docs/API_CONTRACTS.md §7 + apps/studio/schemas/narratorProfile.ts.
    # Calibrator (Plan 16-05) resolves which narrator to use and writes the
    # full record to `narrator`. The Chronicler (Plan 16-06) and QA judge
    # (Plan 16-07) consume `narrator` only — narrative writers stay verbatim
    # on VOICE_CONSTRAINTS (NRR-01). `narrator_slug` is the D-13 override
    # path: when set BEFORE calibrator runs, it takes precedence over
    # `winning_charity.narratorSlug`.
    narrator: Optional[Narrator]                 # resolved by calibrator; None until calibrator runs
    narrator_slug: Optional[str]                 # D-13 override; takes precedence over charity.narratorSlug

    # ── Phase 22: Config Externalization (CFG-01) ─────────────────────────────
    # Loaded ONCE at run start by lib/config_loader.load_run_config(); snapshotted
    # to runs.configSnapshot BEFORE graph.ainvoke(); consumed by the 11 prompt
    # call sites. Never mutated mid-run. See docs/API_CONTRACTS.md §7.
    config: NotRequired[Optional["RunConfig"]]

    # ── Error handling ─────────────────────────────────────────────────────────
    error: Optional[str]

    # ── Phase 4 test toggles (NOT part of API_CONTRACTS §7) ───────────────────
    # Underscore prefix signals non-canonical, test-only.
    # See 04-RESEARCH.md §"Open Questions" Q3.
    _force_no_winner: Optional[bool]
    _force_fail_agent: Optional[str]


# ── Phase 22: resolve the `config` forward-ref at runtime ────────────────────
# LangGraph's StateGraph calls ``typing.get_type_hints(DispatchState,
# include_extras=True)`` at graph-build time, which evaluates the string
# annotation ``"RunConfig"`` in this module's namespace. The TYPE_CHECKING import
# above is invisible at runtime, so we bind ``RunConfig`` here via a deferred
# *module* import (NOT a top-level ``from ... import``). config_loader does not
# import this module, so there is no circular import. The import is wrapped
# defensively so state.py still imports even if config_loader is unavailable
# (the forward-ref only needs to resolve when a graph is actually built).
try:  # pragma: no cover - trivial binding
    import eisenbalm_pipeline.lib.config_loader as _config_loader

    RunConfig = _config_loader.RunConfig
except Exception:  # pragma: no cover - defensive
    pass
