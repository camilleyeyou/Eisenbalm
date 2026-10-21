"""Phase 5 Editor gate-1 unit tests — implemented by Plan 05-08.

Validation: AGT-06 (winner selection + interrupt threshold), AGT-17.
Editor Final tests land in Plan 05-13.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from langgraph.errors import GraphInterrupt

from eisenbalm_pipeline.agents.editor import (
    EDITOR_CONFIDENCE_THRESHOLD,
    EDITOR_INTERRUPT_THRESHOLD,
    EditorDecision,
    _assemble_brief,
    _assemble_known_risks,
    _editor_decision_payload,
    _format_deliberation_transcript,
    _match_lead_for_winner,
    _match_verification_record,
    _score_gap,
    _sort_candidates_by_score,
    editor_gate_1,
)


def _make_state_with_scored_candidates(scores: list[tuple[str, int]]) -> dict:
    """Build a DispatchState-shaped dict with Advocate-scored candidates.

    Each candidate carries advocateScore + advocateArgument inline (matches
    Phase 4 contract — see CharityCandidate TypedDict in graph/state.py).
    """
    candidates = [
        {
            "name": name,
            "location": "NYC",
            "website": f"https://{name.lower().replace(' ', '-')}.example",
            "charityNavigatorUrl": None,
            "guidestarUrl": None,
            "foundingYear": 2003,
            "assetRange": "$100K-$500K",
            "focusArea": "Education",
            "missionStatement": f"Mission of {name}.",
            "scoutSummary": f"Scout summary of {name}.",
            "whyOverlooked": f"Why {name} is overlooked.",
            "advocateArgument": (
                f"The work of {name} is operationally tight, historically "
                f"continuous, and structurally underserved."
            ),
            "advocateScore": score,
        }
        for name, score in scores
    ]
    return {
        "run_id": "run-test-0008",
        "issue_number": 42,
        "candidates": candidates,
        "model_versions": {},
    }


BRIEF_FIELDS = (
    "premise",
    "currentPeg",
    "centralClaim",
    "readerEffect",
    "knownRisks",
    "voiceIntention",
)


def _make_story_lead(**overrides: object) -> dict:
    """Phase 46 StoryLead-shaped dict (docs/API_CONTRACTS.md §46.1)."""
    lead = {
        "premise": "A dated peg story about HighOrg's overlooked mission.",
        "datedPeg": "HighOrg's annual report just dropped this week.",
        "pegSourceUrl": "https://example.com/highorg-report",
        "readerEnergy": "Readers will feel surprised this org is still obscure.",
        "charitableAngle": "Direct relief tie-in.",
        "category": "housing",
        "confidence": "high",
        "brandRiskFlag": False,
        "brandRiskReason": None,
        "repetitionWarning": None,
        "recommended": True,
    }
    lead.update(overrides)
    return lead


def _make_verification_record(**overrides: object) -> dict:
    """Phase 46 VerificationRecord-shaped dict (docs/API_CONTRACTS.md §46.3)."""
    record = {
        "candidateId": "charity-highorg",
        "candidateName": "HighOrg",
        "domainLive": True,
        "registrationId": "https://example.com/registration",
        "registrationVerified": True,
        "obscurity": {"pressHits": 1, "verdict": "obscure"},
        "status": "pass",
        "killed": False,
        "killReason": None,
        "checkedAt": 1_700_000_000_000,
    }
    record.update(overrides)
    return record


# ── Pure helpers ──────────────────────────────────────────────────────────


def test_sort_and_gap() -> None:
    sv = _sort_candidates_by_score([
        {"name": "B", "advocateScore": 5},
        {"name": "A", "advocateScore": 9},
    ])
    assert sv[0]["name"] == "A"
    assert _score_gap(sv) == 4.0


def test_sort_tie_break_by_name() -> None:
    """Deterministic tie-break: equal scores sorted by name asc."""
    sv = _sort_candidates_by_score([
        {"name": "B", "advocateScore": 7},
        {"name": "A", "advocateScore": 7},
    ])
    assert sv[0]["name"] == "A"
    assert _score_gap(sv) == 0.0


def test_score_gap_single_candidate() -> None:
    """Single candidate => no second score => infinite gap (no interrupt)."""
    sv = _sort_candidates_by_score([{"name": "A", "advocateScore": 9}])
    assert _score_gap(sv) == float("inf")


def test_thresholds() -> None:
    assert EDITOR_INTERRUPT_THRESHOLD == 1.0
    assert EDITOR_CONFIDENCE_THRESHOLD == 0.7


def test_editor_decision_payload_carries_confidence_and_runner_up_notes() -> None:
    """Phase 37 §37.2: payload gains confidence + runnerUpNotes, keeps winner/rationale."""
    state = {
        "winning_charity": {"name": "HighOrg"},
        "editor_decision": "HighOrg wins on operational rigor.",
        "editor_confidence": 0.87,
        "runner_up_notes": "LowOrg was a fine candidate.",
    }
    payload = _editor_decision_payload(state)
    assert payload["winner"] == "HighOrg"
    assert payload["rationale"] == "HighOrg wins on operational rigor."
    assert payload["confidence"] == 0.87
    assert payload["runnerUpNotes"] == "LowOrg was a fine candidate."


def test_transcript_format() -> None:
    """AGT-06: deliberationTranscript Markdown format (NotebookLM-friendly)."""
    transcript = _format_deliberation_transcript(
        issue_number=42,
        candidates=[
            {
                "name": "Foo",
                "scoutSummary": "obscure",
                "advocateScore": 9,
                "advocateArgument": "Foo is good.",
            }
        ],
        editor_reasoning="Foo is best.",
        confidence=0.9,
        winner_name="Foo",
        runner_up_notes="None.",
    )
    assert "# Eisenbalm Dispatch — Issue #42 Deliberation" in transcript
    assert "## Scout Findings" in transcript
    assert "## Advocate Arguments" in transcript
    assert "## Editor Reasoning" in transcript
    assert "## Decision" in transcript
    assert "**Winner:** Foo" in transcript


# ── Phase 47 (BRF-05): Brief assembly pure helpers ─────────────────────────


def test_match_lead_for_winner_prefers_recommended() -> None:
    """RESEARCH Pitfall 1: one-active-lead-per-run — prefer recommended=True."""
    not_recommended = _make_story_lead(premise="Not this one.", recommended=False)
    recommended = _make_story_lead(premise="This one.", recommended=True)
    result = _match_lead_for_winner(
        [not_recommended, recommended], {"name": "HighOrg"}
    )
    assert result is not None
    assert result["premise"] == "This one."


def test_match_lead_for_winner_falls_back_to_first_when_none_recommended() -> None:
    leads = [
        _make_story_lead(premise="First lead.", recommended=False),
        _make_story_lead(premise="Second lead.", recommended=False),
    ]
    result = _match_lead_for_winner(leads, {"name": "HighOrg"})
    assert result is not None
    assert result["premise"] == "First lead."


def test_match_lead_for_winner_none_when_no_leads() -> None:
    assert _match_lead_for_winner([], {"name": "HighOrg"}) is None


def test_match_verification_record_matches_on_slugified_candidate_id() -> None:
    record = _make_verification_record(candidateId="charity-high-org-inc")
    result = _match_verification_record(
        [record], {"name": "High Org, Inc."}
    )
    assert result is not None
    assert result["candidateId"] == "charity-high-org-inc"


def test_match_verification_record_none_when_no_match() -> None:
    record = _make_verification_record(candidateId="charity-someone-else")
    assert (
        _match_verification_record([record], {"name": "HighOrg"}) is None
    )
    assert _match_verification_record([], {"name": "HighOrg"}) is None


def test_assemble_known_risks_joins_brand_risk_repetition_and_kill_reason() -> None:
    lead = _make_story_lead(
        brandRiskFlag=True,
        brandRiskReason="Sensitive ongoing litigation.",
        repetitionWarning="avoid US-SE · avoid weather",
        recommended=False,
    )
    record = _make_verification_record(
        killed=True, killReason="domain does not resolve"
    )
    risks = _assemble_known_risks(lead, record)
    assert "Sensitive ongoing litigation." in risks
    assert "avoid US-SE · avoid weather" in risks
    assert "domain does not resolve" in risks


def test_assemble_known_risks_empty_when_nothing_to_report() -> None:
    lead = _make_story_lead(brandRiskReason=None, repetitionWarning=None)
    record = _make_verification_record(killed=False, killReason=None)
    assert _assemble_known_risks(lead, record) == ""
    assert _assemble_known_risks(None, None) == ""


def test_assemble_brief_populates_all_six_fields_from_lead_and_verification() -> None:
    lead = _make_story_lead()
    record = _make_verification_record()
    state = {
        "story_leads": [lead],
        "verification_records": [record],
        "style_brief": {"visualDirection": "Muted, dry, deadpan."},
    }
    brief = _assemble_brief(
        state=state,
        winning_charity={"name": "HighOrg", "scoutSummary": "Scout summary fallback."},
        central_claim="HighOrg wins on operational rigor.",
    )
    assert set(brief.keys()) == set(BRIEF_FIELDS)
    assert brief["premise"] == lead["premise"]
    assert brief["currentPeg"] == lead["datedPeg"]
    assert brief["centralClaim"] == "HighOrg wins on operational rigor."
    assert brief["readerEffect"] == lead["readerEnergy"]
    assert brief["voiceIntention"] == "Muted, dry, deadpan."
    for value in brief.values():
        assert isinstance(value, str)


def test_assemble_brief_degrades_gracefully_with_no_leads_or_verification() -> None:
    """Never raises — missing lead/verification data degrades to documented fallbacks."""
    state: dict = {}
    brief = _assemble_brief(
        state=state,
        winning_charity={"name": "Human Picked Org", "scoutSummary": ""},
        central_claim="Degraded recovery path.",
    )
    assert set(brief.keys()) == set(BRIEF_FIELDS)
    assert brief["premise"] == ""
    assert brief["currentPeg"] == ""
    assert brief["centralClaim"] == "Degraded recovery path."
    assert brief["readerEffect"] == ""
    assert brief["knownRisks"] == ""
    assert brief["voiceIntention"] == ""


# ── Live gate-1 async tests ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_winner_selection_deterministic() -> None:
    """AGT-06: highest-score winner; no interrupt when gap is wide."""
    state = _make_state_with_scored_candidates([("LowOrg", 5), ("HighOrg", 9)])
    decision = EditorDecision(
        winnerName="HighOrg",
        confidence=0.9,
        requiresHumanInput=False,
        editorReasoning="HighOrg wins.",
        runnerUpNotes="LowOrg was a fine candidate.",
        deliberationTranscript="ignored — Python overrides",
    )
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.editor.acomplete",
        AsyncMock(
            return_value=(
                decision,
                {
                    "tokens_in": 100,
                    "tokens_out": 50,
                    "usd": 0.01,
                    "resolved_model": "anthropic/claude-opus-4-7-20251101",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
    ):
        result = await editor_gate_1(state)

    assert result["winning_charity"]["name"] == "HighOrg"
    # interrupt path NOT taken — no awaiting-review write
    awaiting_calls = [
        c
        for c in mock_convex.call_args_list
        if c.args
        and c.args[0] == "pipelineRuns:updateStatus"
        and c.args[1].get("status") == "awaiting-review"
    ]
    assert len(awaiting_calls) == 0
    # Model version recorded (AGT-17)
    assert (
        result["model_versions"]["editor_gate1"]
        == "anthropic/claude-opus-4-7-20251101"
    )
    # Transcript present + format
    assert "## Scout Findings" in result["deliberation_transcript"]
    assert "**Winner:** HighOrg" in result["deliberation_transcript"]
    # Phase 37 §37.2: editor_confidence persisted (was computed then discarded)
    assert result["editor_confidence"] == 0.9


def _interrupt_raises_graph_interrupt(*args, **kwargs) -> None:
    """Stub for langgraph.types.interrupt outside of a runnable context.

    Real LangGraph interrupt() reads configurable state via a contextvar that
    is only set inside a CompiledStateGraph invocation. Outside that
    context, calling interrupt() raises RuntimeError. For unit-test purposes
    we mock interrupt to raise GraphInterrupt directly — the wrapper's
    GraphInterrupt handler is what we are exercising, not LangGraph itself.
    """
    raise GraphInterrupt(())


@pytest.mark.asyncio
async def test_low_confidence_auto_proceeds() -> None:
    """Quick 261021-ind: narrow gap + low confidence + requiresHumanInput no
    longer pauses. The deterministic top score proceeds; no awaiting-review write.
    """
    state = _make_state_with_scored_candidates([("OrgA", 7), ("OrgB", 7)])
    decision = EditorDecision(
        winnerName="OrgA",
        confidence=0.5,
        requiresHumanInput=True,
        editorReasoning="Too close to call.",
        runnerUpNotes="Either candidate viable.",
        deliberationTranscript="ignored",
    )
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.editor.acomplete",
        AsyncMock(
            return_value=(
                decision,
                {
                    "tokens_in": 100,
                    "tokens_out": 50,
                    "usd": 0.01,
                    "resolved_model": "anthropic/claude-opus-4-7-20251101",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
    ):
        result = await editor_gate_1(state)

    assert result["winning_charity"]["name"] == "OrgA"
    awaiting_calls = [
        c
        for c in mock_convex.call_args_list
        if c.args
        and c.args[0] == "pipelineRuns:updateStatus"
        and c.args[1].get("status") == "awaiting-review"
    ]
    assert awaiting_calls == []


@pytest.mark.asyncio
async def test_interrupt_skipped_when_confident() -> None:
    """AGT-06: narrow gap + HIGH confidence => no interrupt."""
    state = _make_state_with_scored_candidates([("OrgA", 7), ("OrgB", 7)])
    decision = EditorDecision(
        winnerName="OrgA",
        confidence=0.95,
        requiresHumanInput=False,
        editorReasoning="OrgA wins despite tie.",
        runnerUpNotes="OrgB respectable.",
        deliberationTranscript="ignored",
    )
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.editor.acomplete",
        AsyncMock(
            return_value=(
                decision,
                {
                    "tokens_in": 100,
                    "tokens_out": 50,
                    "usd": 0.01,
                    "resolved_model": "anthropic/claude-opus-4-7-20251101",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
    ):
        result = await editor_gate_1(state)

    # No interrupt; deterministic top-score winner picked (alphabetical tie-break)
    assert result["winning_charity"]["name"] == "OrgA"
    # No awaiting-review write
    awaiting_calls = [
        c
        for c in mock_convex.call_args_list
        if c.args
        and c.args[0] == "pipelineRuns:updateStatus"
        and c.args[1].get("status") == "awaiting-review"
    ]
    assert len(awaiting_calls) == 0


@pytest.mark.asyncio
async def test_editor_gate_1_no_candidates_fails_run() -> None:
    """Quick 261021-ind: with no surviving candidates there is no pick and no
    human pause — editor_gate_1 raises RuntimeError (the wrapper fails the run)
    and never writes awaiting-review."""
    state = {
        "run_id": "run-test-no-candidates-0001",
        "issue_number": 42,
        "candidates": [],
        "model_versions": {},
    }
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
    ):
        with pytest.raises(RuntimeError, match="No candidates survived"):
            await editor_gate_1(state)

    awaiting_calls = [
        c
        for c in mock_convex.call_args_list
        if c.args
        and c.args[0] == "pipelineRuns:updateStatus"
        and c.args[1].get("status") == "awaiting-review"
    ]
    assert awaiting_calls == []


@pytest.mark.asyncio
async def test_top_score_overrides_llm_winner() -> None:
    """AGT-06 D-18: deterministic top-score wins even if LLM names another.

    Editor's LLM call returns winnerName=LowOrg with score 5, but the
    deterministic ranking gives HighOrg (score 9). Python overrides.
    """
    state = _make_state_with_scored_candidates([("HighOrg", 9), ("LowOrg", 5)])
    decision = EditorDecision(
        winnerName="LowOrg",  # LLM picks the lower-score one
        confidence=0.9,
        requiresHumanInput=False,
        editorReasoning="I prefer LowOrg.",
        runnerUpNotes="HighOrg also good.",
        deliberationTranscript="ignored",
    )
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.editor.acomplete",
        AsyncMock(
            return_value=(
                decision,
                {
                    "tokens_in": 100,
                    "tokens_out": 50,
                    "usd": 0.01,
                    "resolved_model": "anthropic/claude-opus-4-7-20251101",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
    ):
        result = await editor_gate_1(state)

    # Top-score wins, NOT the LLM's pick
    assert result["winning_charity"]["name"] == "HighOrg"


# ── Phase 47 (BRF-05): Brief generation on both winner-resolution paths ────


@pytest.mark.asyncio
async def test_brief_assembled_and_persisted_on_auto_select_path() -> None:
    """§47.3: state['brief'] is a six-field dict populated from the matched
    lead/verification/editorReasoning/style_brief on the normal (no-pause)
    winner-resolution path, and briefs:insert is called with {runId, ...brief}.
    """
    state = _make_state_with_scored_candidates([("LowOrg", 5), ("HighOrg", 9)])
    state["story_leads"] = [_make_story_lead()]
    state["verification_records"] = [
        _make_verification_record(candidateId="charity-highorg", candidateName="HighOrg")
    ]
    state["style_brief"] = {"visualDirection": "Muted, dry, deadpan."}
    decision = EditorDecision(
        winnerName="HighOrg",
        confidence=0.9,
        requiresHumanInput=False,
        editorReasoning="HighOrg wins on operational rigor.",
        runnerUpNotes="LowOrg was a fine candidate.",
        deliberationTranscript="ignored — Python overrides",
    )
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.editor.acomplete",
        AsyncMock(
            return_value=(
                decision,
                {
                    "tokens_in": 100,
                    "tokens_out": 50,
                    "usd": 0.01,
                    "resolved_model": "anthropic/claude-opus-4-7-20251101",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
    ):
        result = await editor_gate_1(state)

    brief = result["brief"]
    assert set(brief.keys()) == set(BRIEF_FIELDS)
    assert brief["centralClaim"] == "HighOrg wins on operational rigor."
    assert brief["voiceIntention"] == "Muted, dry, deadpan."

    insert_calls = [
        c
        for c in mock_convex.call_args_list
        if c.args and c.args[0] == "briefs:insert"
    ]
    assert len(insert_calls) == 1
    insert_args = insert_calls[0].args[1]
    assert insert_args["runId"] == state["run_id"]
    for field in BRIEF_FIELDS:
        assert insert_args[field] == brief[field]
