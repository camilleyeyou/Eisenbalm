"""Phase 5 QA Layer-2 judge tests — Plan 05-13. Validation: AGT-15.

Asserts the single-Opus-call shape of run_llm_judge:
  - Rubric loads from disk and contains the Jesse Voice section
  - Findings are returned as QAFinding NamedTuples (Layer-1 + Layer-2 share
    the same downstream shape so the orchestrator does not branch)
  - Empty findings list is a passing grade (matches rubric.md sentinel)
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.qa.judge import (
    JudgeFinding,
    JudgeFindings,
    _load_rubric,
    run_llm_judge,
)
from eisenbalm_pipeline.agents.qa.rules import QAFinding


def test_rubric_loads() -> None:
    rubric = _load_rubric()
    assert "Jesse Voice" in rubric
    assert "Empty findings array = passing grade" in rubric


def test_judge_finding_validates_severity_enum() -> None:
    """JudgeFinding.severity must be Literal['info', 'warning', 'error']."""
    jf = JudgeFinding(
        section="origin_story",
        severity="error",
        axis="sentiment",
        quotedSpan="passion-driven",
        reason="Sentiment keyword detected.",
        suggestedFix="Rewrite with precise observation.",
    )
    assert jf.severity == "error"
    assert jf.axis == "sentiment"


@pytest.mark.asyncio
async def test_run_llm_judge_returns_findings() -> None:
    """AGT-15: Layer-2 judge returns Pydantic-validated findings as QAFindings."""
    mock_findings = JudgeFindings(
        findings=[
            JudgeFinding(
                section="origin_story",
                severity="warning",
                axis="sentiment",
                quotedSpan="passion-driven",
                reason="passion is a forbidden sentiment keyword",
                suggestedFix="describe the work without 'passion'",
            ),
        ]
    )
    with patch(
        "eisenbalm_pipeline.agents.qa.judge.acomplete",
        AsyncMock(
            return_value=(
                mock_findings,
                {
                    "tokens_in": 100,
                    "tokens_out": 50,
                    "usd": 0.02,
                    "resolved_model": "anthropic/claude-opus-4-7-20251101",
                },
            )
        ),
    ):
        findings, model = await run_llm_judge(
            {
                "origin_story": "passion-driven work",
                "problem": "x",
                "founder_bio": "y",
                "case_study": "z",
                "game": "g",
                "bonus": "b",
            },
            run_id="run-test-judge-0001",
        )
    assert len(findings) == 1
    assert isinstance(findings[0], QAFinding)
    assert findings[0].section == "origin_story"
    assert findings[0].severity == "warning"
    assert findings[0].axis == "sentiment"
    assert model == "anthropic/claude-opus-4-7-20251101"


@pytest.mark.asyncio
async def test_run_llm_judge_empty_findings_is_passing() -> None:
    """AGT-15: empty findings list = passing grade."""
    mock_findings = JudgeFindings(findings=[])
    with patch(
        "eisenbalm_pipeline.agents.qa.judge.acomplete",
        AsyncMock(
            return_value=(
                mock_findings,
                {
                    "tokens_in": 0,
                    "tokens_out": 0,
                    "usd": 0.0,
                    "resolved_model": "anthropic/claude-opus-4-7",
                },
            )
        ),
    ):
        findings, model = await run_llm_judge(
            {"origin_story": "good"},
            run_id="run-test-judge-empty",
        )
    assert findings == []
    assert model == "anthropic/claude-opus-4-7"


@pytest.mark.asyncio
async def test_run_llm_judge_makes_exactly_one_call() -> None:
    """D-03: single Opus call per run over all section bodies concatenated."""
    mock_acomplete = AsyncMock(
        return_value=(
            JudgeFindings(findings=[]),
            {
                "tokens_in": 0,
                "tokens_out": 0,
                "usd": 0.0,
                "resolved_model": "anthropic/claude-opus-4-7",
            },
        )
    )
    with patch(
        "eisenbalm_pipeline.agents.qa.judge.acomplete", mock_acomplete,
    ):
        await run_llm_judge(
            {
                "origin_story": "a",
                "problem": "b",
                "founder_bio": "c",
                "case_study": "d",
                "game": "e",
                "bonus": "f",
            },
            run_id="run-test-single-call",
        )
    assert mock_acomplete.call_count == 1
