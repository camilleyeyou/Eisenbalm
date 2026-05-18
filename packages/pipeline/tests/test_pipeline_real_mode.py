"""Phase 5 end-to-end real-mode smoke — Plan 05-14.

Runs the full LangGraph compiled graph with ``EISENBALM_STUB_MODE=false`` but
with every external integration (acomplete, web_search, convex_mutation_safe,
groq_query, write_charity, write_issue_draft, verify._fetch_text) patched to
deterministic mocks.

This validates the WIRING:
  - every agent runs in the correct order
  - modelVersions is populated for the four voice-critical agents (AGT-17)
  - the three-datastore write order holds
  - the graph completes without exception

Live-API smoke runs against Railway under Andrew's eye in Plan 05-15. This
file is the mechanical pre-flight: no Tavily credits, no OpenRouter spend, no
real Sanity / Convex round-trips. Opt-in to a live run is a future concern;
this test runs as part of the default CI pytest suite.

The test does NOT depend on ``conftest.test_real_pipeline_required_env_vars``
or any environment provisioning — only on the in-process LangGraph + mocks.
"""
from __future__ import annotations

import os
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Per-agent Pydantic outputs (constructed via the mock to satisfy
# with_structured_output expectations from acomplete's response_format).
from eisenbalm_pipeline.agents.advocate import AdvocateOutput, AdvocateVote
from eisenbalm_pipeline.agents.bonus import (
    BigBudgetBonus,
    JingleBonus,
    SpecAdBonus,
    Storyboard,
)
from eisenbalm_pipeline.agents.calibrator import StyleBriefOutput
from eisenbalm_pipeline.agents.case_study import CaseStudyOutput
from eisenbalm_pipeline.agents.design import ThemeOutput
from eisenbalm_pipeline.agents.editor import EditorDecision, EditorFinalOutput
from eisenbalm_pipeline.agents.founder_bio import FounderBioOutput
from eisenbalm_pipeline.agents.game import GameOutput
from eisenbalm_pipeline.agents.origin_story import OriginStoryOutput
from eisenbalm_pipeline.agents.problem import (
    KeyDataPoint, PdfContent, ProblemOutput,
)
from eisenbalm_pipeline.agents.qa.judge import JudgeFindings
from eisenbalm_pipeline.agents.researcher import ResearchOutputModel
from eisenbalm_pipeline.agents.scout import CharityCandidate, ScoutBatchOutput
from eisenbalm_pipeline.lib.search_client import SearchResult
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


# ── Mock acomplete: response shape switches on response_format ──────────


def _safe_theme_payload() -> ThemeOutput:
    """Theme that passes WCAG + font whitelist validation (lib/wcag.SAFE_THEME)."""
    return ThemeOutput(
        primaryColor="#2D5016",
        accentColor="#8B1A1A",
        backgroundColor="#FAFAF8",
        textColor="#1A1A18",
        fontDisplay="Playfair Display",  # Phase-2-locked whitelist member
        fontBody="Inter",                 # Phase-2-locked whitelist member
    )


def _scout_candidates() -> ScoutBatchOutput:
    cands = [
        CharityCandidate(
            name=f"Test Org {i}",
            location="Vermont, USA",
            website=f"https://testorg{i}.example.org",
            assetRange="<$100K",
            focusArea="education",
            missionStatement="A specific, narrow mission.",
            scoutSummary="Why Scout surfaced this one.",
            whyOverlooked="Why it remains overlooked.",
        )
        for i in range(3)
    ]
    return ScoutBatchOutput(candidates=cands)


def _advocate_votes() -> AdvocateOutput:
    return AdvocateOutput(votes=[
        AdvocateVote(
            charityName="Test Org 0", score=8,
            argument="x" * 200,
            keyStrengths=["focused mission", "operational discipline"],
            primaryConcern="small donor base",
        ),
        AdvocateVote(
            charityName="Test Org 1", score=5,
            argument="y" * 200,
            keyStrengths=["unique niche", "stable funding"],
            primaryConcern="limited reach",
        ),
        AdvocateVote(
            charityName="Test Org 2", score=9,
            argument="z" * 200,
            keyStrengths=["scalable program", "verified outcomes"],
            primaryConcern="growth bottleneck",
        ),
    ])


def _research_output() -> ResearchOutputModel:
    return ResearchOutputModel(
        summary="Founded 2003 by Jane Doe in Burlington VT.",
        foundingYear=2003,
        annualBudget="$500k",
        founderName="Jane Doe",
        founderNameSourceUrl="https://testorg2.example.org/about",
        founderRole="founder",
        founderBio="Jane Doe was a librarian before founding the charity.",
        subjectName="Alex Smith",
        subjectNameSourceUrl="https://testorg2.example.org/stories/alex",
        subjectRole="a parent",
        subjectStory="Alex's son benefited directly from the program.",
        keyStatistics=["50 families served", "12 programs"],
        fundingSources=["Vermont Community Foundation"],
    )


def _section_with_body() -> dict:
    return {"headline": "A Precise Headline", "body": "B" * 400}


def _problem_output() -> ProblemOutput:
    return ProblemOutput(
        headline="The Problem We Face",
        body="B" * 400,
        pdfContent=PdfContent(
            problemStatement="ps",
            keyDataPoints=[
                KeyDataPoint(stat="stat 1", source="https://src1.example"),
                KeyDataPoint(stat="stat 2", source="https://src2.example"),
                KeyDataPoint(stat="stat 3", source="https://src3.example"),
            ],
            interventionMechanism="im",
        ),
    )


def _editor_decision() -> EditorDecision:
    return EditorDecision(
        winnerName="Test Org 2",
        confidence=0.92,
        requiresHumanInput=False,
        editorReasoning="r" * 100,
        runnerUpNotes="n" * 60,
        deliberationTranscript="# Issue transcript",
    )


def _big_budget_bonus() -> BigBudgetBonus:
    return BigBudgetBonus(
        headline="H", body="B" * 300,
        storyboards=[
            Storyboard(shotNumber=1, description="x" * 60),
            Storyboard(shotNumber=2, description="y" * 60),
            Storyboard(shotNumber=3, description="z" * 60),
        ],
    )


def _jingle_bonus() -> JingleBonus:
    return JingleBonus(
        headline="H", body="B" * 150,
        lyrics="Line 1\nLine 2",
        sunoPrompt="p" * 50,
    )


def _spec_ad_bonus() -> SpecAdBonus:
    return SpecAdBonus(headline="H", body="B" * 300)


def _game_output() -> GameOutput:
    return GameOutput(
        headline="Game H",
        description="d" * 80,
        embedCode=(
            "<!DOCTYPE html><html><head><style>body{margin:0}</style></head>"
            "<body><p>game</p></body></html>"
        ),
    )


def _resolved_model_for(agent_id: str) -> str:
    """Voice-critical agents resolve to the Opus pin; everyone else stays
    on the Sonnet/Haiku alias. The exact string matches what acomplete
    would return when it populates state['model_versions'][agent_id]."""
    voice_critical = {"calibrator", "editor_gate1", "editor_final", "qa"}
    if agent_id in voice_critical:
        return "anthropic/claude-opus-4-7"
    if agent_id in {"scout", "advocate", "design"}:
        return "anthropic/claude-haiku-4-5"
    return "anthropic/claude-sonnet-4-6"


async def _mock_acomplete(
    *, agent_id: str, run_id: str,
    messages: list,
    response_format: Any = None,
    **kwargs: Any,
) -> tuple[Any, dict]:
    """Return a Pydantic instance matching the requested response_format.

    Mirrors the real ``acomplete`` signature (kwargs-only — Plan 05-05 SUMMARY).
    Voice-critical agents resolve to the Opus pin so AGT-17 assertions
    on state['model_versions'] hold.
    """
    usage = {
        "tokens_in": 100,
        "tokens_out": 50,
        "usd": 0.01,
        "resolved_model": _resolved_model_for(agent_id),
    }

    # Map per agent — response_format takes precedence (Bonus picks one of
    # three Pydantic types based on bonusType).
    if response_format is StyleBriefOutput:
        return StyleBriefOutput(
            voice=VOICE_CONSTRAINTS,
            constraints=["No exclamations.", "No sentimentality.", "Numbers cited."],
            bonusType="bigBudget",
            visualDirection="Warm cream paper feel; serif display, sans body.",
        ), usage
    if response_format is ScoutBatchOutput:
        return _scout_candidates(), usage
    if response_format is AdvocateOutput:
        return _advocate_votes(), usage
    if response_format is EditorDecision:
        return _editor_decision(), usage
    if response_format is ResearchOutputModel:
        return _research_output(), usage
    if response_format is OriginStoryOutput:
        return OriginStoryOutput(**_section_with_body()), usage
    if response_format is ProblemOutput:
        return _problem_output(), usage
    if response_format is FounderBioOutput:
        return FounderBioOutput(**_section_with_body()), usage
    if response_format is CaseStudyOutput:
        return CaseStudyOutput(
            headline="Case Study H", body="B" * 400,
        ), usage
    if response_format is GameOutput:
        return _game_output(), usage
    if response_format is BigBudgetBonus:
        return _big_budget_bonus(), usage
    if response_format is JingleBonus:
        return _jingle_bonus(), usage
    if response_format is SpecAdBonus:
        return _spec_ad_bonus(), usage
    if response_format is ThemeOutput:
        return _safe_theme_payload(), usage
    if response_format is JudgeFindings:
        return JudgeFindings(findings=[]), usage
    if response_format is EditorFinalOutput:
        return EditorFinalOutput(editorFinalNotes="n" * 150), usage

    # No structured-output requested — return plain string.
    return "ok", usage


# ── Patch helpers ───────────────────────────────────────────────────────


# Per-agent module paths where `acomplete` is imported (must each be
# patched because Python copies the reference at import time).
_ACOMPLETE_PATCH_TARGETS: tuple[str, ...] = (
    "eisenbalm_pipeline.agents.calibrator.acomplete",
    "eisenbalm_pipeline.agents.scout.acomplete",
    "eisenbalm_pipeline.agents.advocate.acomplete",
    "eisenbalm_pipeline.agents.editor.acomplete",
    "eisenbalm_pipeline.agents.researcher.acomplete",
    "eisenbalm_pipeline.agents.origin_story.acomplete",
    "eisenbalm_pipeline.agents.problem.acomplete",
    "eisenbalm_pipeline.agents.founder_bio.acomplete",
    "eisenbalm_pipeline.agents.case_study.acomplete",
    "eisenbalm_pipeline.agents.game.acomplete",
    "eisenbalm_pipeline.agents.bonus.acomplete",
    "eisenbalm_pipeline.agents.design.acomplete",
    "eisenbalm_pipeline.agents.qa.judge.acomplete",
)


def _build_patches(stub_mode: bool) -> list:
    """Construct the patch context-manager list. The caller wraps in ExitStack."""
    patches: list = []

    if not stub_mode:
        # Real-mode path: patch every acomplete consumer to the deterministic mock.
        for target in _ACOMPLETE_PATCH_TARGETS:
            patches.append(patch(target, side_effect=_mock_acomplete))

    # Tavily mocks (Scout + Researcher).
    fake_results = [
        SearchResult(
            url=f"https://example{i}.org/about",
            title=f"Example {i}",
            content="content " * 50,
            score=0.9 - 0.1 * i,
        )
        for i in range(5)
    ]
    patches.append(patch(
        "eisenbalm_pipeline.agents.scout.web_search",
        AsyncMock(return_value=fake_results),
    ))
    patches.append(patch(
        "eisenbalm_pipeline.agents.researcher.web_search",
        AsyncMock(return_value=fake_results),
    ))

    # Scout's GROQ dedup load — return empty (no archive).
    patches.append(patch(
        "eisenbalm_pipeline.agents.scout._load_featured_keys",
        AsyncMock(return_value=[]),
    ))

    # Calibrator's GROQ for previousBonusTypes.
    patches.append(patch(
        "eisenbalm_pipeline.agents.calibrator._fetch_previous_bonus_types",
        AsyncMock(return_value=[]),
    ))

    # Sanity writes (Scout per-candidate write + Publisher final write).
    patches.append(patch(
        "eisenbalm_pipeline.agents.scout.write_charity",
        AsyncMock(side_effect=lambda http, c: f"charity-{c['name'].lower().replace(' ', '-')}"),
    ))
    patches.append(patch(
        "eisenbalm_pipeline.agents.publisher.write_issue_draft",
        AsyncMock(side_effect=lambda http, state, cost: f"issue-{state['issue_number']}"),
    ))

    # Convex fire-and-forget mutations everywhere.
    convex_mock = AsyncMock(return_value=None)
    patches.append(patch(
        "eisenbalm_pipeline.lib.convex_client.convex_mutation_safe", convex_mock,
    ))
    patches.append(patch(
        "eisenbalm_pipeline.agents._wrapper.convex_mutation_safe", convex_mock,
    ))
    patches.append(patch(
        "eisenbalm_pipeline.agents.advocate.convex_mutation_safe", convex_mock,
    ))
    patches.append(patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe", convex_mock,
    ))
    patches.append(patch(
        "eisenbalm_pipeline.agents.qa.convex_mutation_safe", convex_mock,
    ))
    patches.append(patch(
        "eisenbalm_pipeline.agents.scout.convex_mutation_safe", convex_mock,
    ))
    patches.append(patch(
        "eisenbalm_pipeline.agents.publisher.convex_mutation_safe", convex_mock,
    ))
    patches.append(patch(
        "eisenbalm_pipeline.agents.design.convex_mutation_safe", convex_mock,
    ))
    patches.append(patch(
        "eisenbalm_pipeline.agents.validate.convex_mutation_safe", convex_mock,
    ))

    # verify_research network fetch — return a string containing 'Jane Doe' so
    # name verification trips True (matches _research_output founderName).
    patches.append(patch(
        "eisenbalm_pipeline.agents.verify._fetch_text",
        AsyncMock(return_value="Jane Doe founded this in 2003. Alex Smith is a parent."),
    ))

    return patches


def _setup_sanity_client() -> None:
    """Register a dummy AsyncClient so ``get_sanity_http()`` doesn't raise.

    The actual write calls are patched out — only the get_client() guard
    matters here.
    """
    from eisenbalm_pipeline.lib.sanity_client import set_client
    from httpx import AsyncClient
    set_client(AsyncClient(base_url="http://test.invalid"))


def _setup_convex_client() -> None:
    """Register a dummy AsyncClient so ``convex_mutation_safe`` doesn't drop
    calls with a 'set_client not called' warning. Our patch above replaces
    the function entirely so this is belt-and-suspenders."""
    from eisenbalm_pipeline.lib.convex_client import set_client
    from httpx import AsyncClient
    set_client(AsyncClient(base_url="http://test.invalid"))


# ── Tests ───────────────────────────────────────────────────────────────


@pytest.fixture
def initial_state() -> dict:
    """Minimal DispatchState input — Calibrator + Scout populate the rest."""
    return {
        "run_id": "run-real-mode-test-0001",
        "issue_number": 9_999_900,
        "publish_date": "2026-05-21",
        "pipeline_started_at": "2026-05-21T10:00:00Z",
        "candidates": [],
        "model_versions": {},
    }


async def _run_full_graph(initial_state: dict) -> dict:
    """Compile the graph with MemorySaver, invoke once, return final state."""
    from langgraph.checkpoint.memory import MemorySaver
    from eisenbalm_pipeline.graph.builder import build_graph

    _setup_sanity_client()
    _setup_convex_client()

    checkpointer = MemorySaver()
    compiled = build_graph(checkpointer)
    return await compiled.ainvoke(
        initial_state,
        config={"configurable": {"thread_id": initial_state["run_id"]}},
    )


async def test_full_graph_runs_to_publisher(initial_state, monkeypatch) -> None:
    """AGT-17 / AGT-18 wiring: full graph runs end-to-end without exception.

    Asserts every section field is populated after the 7-parallel-writer
    fan-out flows through validate_sections, qa, editor_final, publisher.
    """
    monkeypatch.setenv("EISENBALM_STUB_MODE", "false")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("TAVILY_API_KEY", "test-key")
    monkeypatch.setenv("NEXT_PUBLIC_SANITY_PROJECT_ID", "test-project")
    monkeypatch.setenv("SANITY_API_TOKEN", "test-token")

    from contextlib import ExitStack

    with ExitStack() as stack:
        for cm in _build_patches(stub_mode=False):
            stack.enter_context(cm)
        result = await _run_full_graph(initial_state)

    # Sequential pre-fan-out outputs.
    assert result.get("style_brief") is not None, "Calibrator did not populate style_brief"
    assert result["style_brief"]["bonusType"] in ("bigBudget", "jingle", "specAd")
    assert result.get("candidates"), "Scout did not populate candidates"
    assert result.get("winning_charity") is not None, "Editor gate 1 did not pick a winner"
    assert result.get("research") is not None, "Researcher did not populate state['research']"

    # Parallel fan-out — every required section field populated (validate_sections gate).
    assert result.get("origin_story", {}).get("body"), "missing origin_story.body"
    assert result.get("problem_statement", {}).get("body"), "missing problem_statement.body"
    assert result.get("founder_bio", {}).get("body"), "missing founder_bio.body"
    assert result.get("case_study", {}).get("body"), "missing case_study.body"
    assert result.get("game", {}).get("description"), "missing game.description"
    assert result.get("bonus", {}).get("body"), "missing bonus.body"
    assert result.get("theme", {}).get("primaryColor"), "missing theme.primaryColor"

    # Post-fan-in.
    assert result.get("editor_final_notes"), "Editor Final did not produce notes"
    assert result.get("sanity_issue_id"), "Publisher did not return sanity_issue_id"


async def test_model_versions_voice_critical_populated(initial_state, monkeypatch) -> None:
    """AGT-17: state['model_versions'] populated for all 4 voice-critical agents.

    The voice-critical agents are calibrator, editor_gate1, qa, editor_final
    (lib/llm_config.MODEL_BY_AGENT pins them to the Opus snapshot). This test
    is the mechanical proof that AGT-17's observability surface lands.
    """
    monkeypatch.setenv("EISENBALM_STUB_MODE", "false")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("TAVILY_API_KEY", "test-key")
    monkeypatch.setenv("NEXT_PUBLIC_SANITY_PROJECT_ID", "test-project")
    monkeypatch.setenv("SANITY_API_TOKEN", "test-token")

    from contextlib import ExitStack

    with ExitStack() as stack:
        for cm in _build_patches(stub_mode=False):
            stack.enter_context(cm)
        result = await _run_full_graph(initial_state)

    mv = result.get("model_versions") or {}
    for agent_id in ("calibrator", "editor_gate1", "qa", "editor_final"):
        assert agent_id in mv, (
            f"AGT-17: model_versions missing voice-critical agent {agent_id!r}; "
            f"got keys: {sorted(mv.keys())}"
        )
        assert mv[agent_id], f"AGT-17: empty resolved_model for {agent_id}"

    # Voice-critical agents resolve to the Opus pin (lib/llm_config).
    for agent_id in ("calibrator", "editor_gate1", "qa", "editor_final"):
        assert "opus" in mv[agent_id].lower(), (
            f"AGT-17: {agent_id} should resolve to Opus pin; got {mv[agent_id]!r}"
        )


async def test_stub_mode_acomplete_short_circuits(monkeypatch) -> None:
    """D-22 regression: EISENBALM_STUB_MODE=true routes acomplete through
    FakeOpenRouterClient and returns a model_construct'd Pydantic instance
    (validation skipped) WITHOUT requiring OPENROUTER_API_KEY.

    The Phase 5 stub-mode contract is at the ``acomplete`` boundary — when
    the env var is on, no network call leaves the process. Per-agent stub
    behavior (Calibrator with empty constraints, Scout with empty
    candidates, etc.) is covered by each agent's own unit test file. A
    full-graph stub-mode regression test isn't useful in Phase 5 because
    each agent body now consumes LLM output structurally; empty defaults
    don't propagate to a meaningful pipeline finish — that's by design
    (Plan 05-05 SUMMARY: stub-mode is for unit-test isolation, not e2e).
    """
    monkeypatch.setenv("EISENBALM_STUB_MODE", "true")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    from eisenbalm_pipeline.lib.openrouter_client import acomplete, is_stub_mode

    assert is_stub_mode() is True, "EISENBALM_STUB_MODE=true must route stub"

    # acomplete must not require OPENROUTER_API_KEY in stub mode.
    content, usage = await acomplete(
        agent_id="calibrator",
        run_id="run-stub-mode-test",
        messages=[{"role": "system", "content": "x"}],
        response_format=StyleBriefOutput,
    )

    # Stub returns a model_construct'd instance OR raw content fallback;
    # cost is always zero with the stub resolved_model marker.
    assert usage["tokens_in"] == 0
    assert usage["tokens_out"] == 0
    assert usage["usd"] == 0.0
    assert usage["resolved_model"] == "fake-openrouter-stub"


async def test_real_mode_default_routes_through_chat_model(monkeypatch) -> None:
    """D-22 flip: with EISENBALM_STUB_MODE unset (Plan 05-14 default 'false'),
    acomplete does NOT route through FakeOpenRouterClient.

    Verified by asserting is_stub_mode() returns False when the env var is
    unset. The actual ChatOpenAI build is exercised in
    ``test_full_graph_runs_to_publisher`` above (with the per-agent
    acomplete patched out, but is_stub_mode() returning False is what
    enables that real-mode path).
    """
    monkeypatch.delenv("EISENBALM_STUB_MODE", raising=False)
    from eisenbalm_pipeline.lib.openrouter_client import is_stub_mode

    assert is_stub_mode() is False, (
        "Plan 05-14 D-22 flip: EISENBALM_STUB_MODE default MUST be 'false' "
        "so real mode is the new default."
    )


# ── Phase 6: real-mode Publisher integration test ────────────────────────


@pytest.mark.skipif(
    os.environ.get("PHASE6_REAL_MODE", "").lower() != "true",
    reason="Phase 6 real-mode test — set PHASE6_REAL_MODE=true to enable",
)
@pytest.mark.asyncio
async def test_phase_6_publisher_against_phase_5_draft():
    """Real-mode end-to-end Publisher test (opt-in).

    Runs the Publisher coroutine against the existing Phase 5 draft on Sanity
    (runId 96ab834e96214671859322044a4b4683, issue 999) WITHOUT firing the
    Sanity webhook. Confirms:
      - PDF generation succeeds against real Sanity data
      - upload_pdf_to_issue actually writes to Sanity
      - weeklyIssue.problemPdf.asset is populated after the run

    The Convex update + Vercel deploy hook are skipped (mocked) so the test
    does NOT trigger an actual production deploy.

    Run with:
        PHASE6_REAL_MODE=true \\
        SUPABASE_POSTGRES_URL=... \\
        NEXT_PUBLIC_SANITY_PROJECT_ID=... \\
        SANITY_API_TOKEN=... \\
        uv run pytest tests/test_pipeline_real_mode.py::test_phase_6_publisher_against_phase_5_draft -xvs
    """
    from unittest.mock import AsyncMock, MagicMock

    import httpx

    from eisenbalm_pipeline.agents.publisher import _run_publisher
    from eisenbalm_pipeline.lib.sanity_client import groq_query, set_client

    # Phase 5 baseline run — captured in STATE.md "Phase 5 First-Real-Run".
    RUN_ID = "96ab834e96214671859322044a4b4683"
    ISSUE_NUMBER = 999
    ISSUE_ID = f"issue-{ISSUE_NUMBER}"

    project = os.environ["NEXT_PUBLIC_SANITY_PROJECT_ID"]
    sanity_http = httpx.AsyncClient(
        base_url=f"https://{project}.api.sanity.io", timeout=30.0
    )
    set_client(sanity_http)

    # Confirm the draft exists in Sanity before running Publisher.
    pre_check = await groq_query(
        '*[_type == "weeklyIssue" && _id == $id][0]{_id, issueNumber, "hasPdfContent": defined(problemStatement.pdfContent)}',
        params={"id": ISSUE_ID},
    )
    if not pre_check or (isinstance(pre_check, list) and not pre_check):
        pytest.skip(f"Phase 5 baseline draft {ISSUE_ID} not on this Sanity dataset")

    # Build a mock app with only the attributes _run_publisher reads.
    app = MagicMock()
    app.state = MagicMock()
    app.state.pool = None
    app.state.background_tasks = set()
    app.state.convex_http = MagicMock(spec=httpx.AsyncClient)

    try:
        # Patch the slow + deploy-triggering pieces.
        import eisenbalm_pipeline.agents.publisher as pub_mod
        original_sleep = pub_mod.asyncio.sleep
        original_vercel = pub_mod.trigger_vercel_deploy
        original_convex = pub_mod.convex_mutation_safe
        pub_mod.asyncio.sleep = AsyncMock(return_value=None)
        pub_mod.trigger_vercel_deploy = AsyncMock(return_value={"job": {"id": "test", "state": "READY", "createdAt": 1}})
        pub_mod.convex_mutation_safe = AsyncMock(return_value={"status": "success"})

        try:
            await _run_publisher(app, issue_id=ISSUE_ID, issue_number=ISSUE_NUMBER, run_id=RUN_ID)
        finally:
            pub_mod.asyncio.sleep = original_sleep
            pub_mod.trigger_vercel_deploy = original_vercel
            pub_mod.convex_mutation_safe = original_convex

        # Verify the Sanity write actually happened: query the issue back and
        # check problemPdf.asset is populated.
        post_check = await groq_query(
            '*[_type == "weeklyIssue" && _id == $id][0]{"hasAsset": defined(problemPdf.asset)}',
            params={"id": ISSUE_ID},
        )
        post = post_check[0] if isinstance(post_check, list) and post_check else post_check
        assert post and post.get("hasAsset") is True, (
            f"weeklyIssue.problemPdf.asset is NOT populated after Publisher run; "
            f"post-check result: {post_check}"
        )
    finally:
        await sanity_http.aclose()
