"""Phase 5 CaseStudyWriter unit tests — implemented by Plan 05-10.

Validation: AGT-10 (subjectName scrub mirror of FounderBio), AGT-09
(voice isolation), AGT-17 (modelVersions).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.case_study import (
    CaseStudyOutput,
    GUIDANCE_ANONYMOUS,
    GUIDANCE_VERIFIED,
    _select_guidance_and_scrub,
    case_study,
)


def test_select_guidance_verified() -> None:
    g, r = _select_guidance_and_scrub({
        "subjectName": "Alex Park",
        "subjectNameVerified": True,
    })
    assert g == GUIDANCE_VERIFIED
    assert "verified" in g
    assert r["subjectName"] == "Alex Park"


def test_select_guidance_anonymous() -> None:
    """AGT-10: subjectNameVerified=False → role framing + name scrubbed."""
    g, r = _select_guidance_and_scrub({
        "subjectName": "Alex",
        "subjectNameVerified": False,
        "subjectRole": "a parent",
    })
    assert "Do NOT name the subject" in g
    assert "a parent" in g
    assert r["subjectName"] is None


def test_select_guidance_anonymous_default_role() -> None:
    """AGT-10: missing subjectRole falls back to 'a program participant'."""
    g, r = _select_guidance_and_scrub({
        "subjectName": "Alex",
        "subjectNameVerified": False,
    })
    assert "a program participant" in g
    assert r["subjectName"] is None


@pytest.mark.asyncio
async def test_case_study_runs(sample_dispatch_state) -> None:
    """AGT-17: model_versions['case_study'] populated."""
    sample_dispatch_state["research"] = {
        "subjectName": "Alex Park",
        "subjectNameVerified": True,
        "subjectStory": "story",
        "summary": "s",
    }
    # Phase 18 D-01: CaseStudyOutput.body is now list[BodyBlock].
    # Use model_construct to bypass validation in this integration-path test
    # (the structural floor is tested separately in test_writer_structural_floor.py).
    out = CaseStudyOutput.model_construct(headline="H", body=[])
    with patch(
        "eisenbalm_pipeline.agents.case_study.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await case_study(sample_dispatch_state)
    assert result["case_study"]["headline"] == "H"
    assert result["case_study"]["body"] == []
    assert result["model_versions"]["case_study"] == "anthropic/claude-sonnet-4-6"


@pytest.mark.asyncio
async def test_case_study_voice_isolation(sample_dispatch_state) -> None:
    """AGT-09: build_section_writer_prompt called with only the 4 whitelisted slices."""
    out = CaseStudyOutput.model_construct(headline="H", body=[])
    captured: dict = {}

    def _capture(**kwargs):
        captured.update(kwargs)
        return [{"role": "system", "content": "ok"}, {"role": "user", "content": "ok"}]

    with patch(
        "eisenbalm_pipeline.agents.case_study.build_section_writer_prompt",
        side_effect=_capture,
    ), patch(
        "eisenbalm_pipeline.agents.case_study.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        sample_dispatch_state["origin_story"] = {"headline": "X", "body": []}
        sample_dispatch_state["problem_statement"] = {"headline": "X", "body": []}
        sample_dispatch_state["founder_bio"] = {"headline": "X", "body": []}
        await case_study(sample_dispatch_state)

    # Phase 16 (Plan 16-05 NRR-04): voice_constraints added as a 7th
    # whitelisted kwarg so the calibrator-set narrator voice can propagate.
    allowed = {
        "section_id", "section_title", "section_guidance",
        "charity", "research", "style_brief", "voice_constraints",
    }
    assert set(captured.keys()).issubset(allowed)


@pytest.mark.asyncio
async def test_case_study_unverified_scrubs_subject_name(sample_dispatch_state) -> None:
    """AGT-10 mirror: unverified subjectName -> None in prompt research dict."""
    sample_dispatch_state["research"] = {
        "subjectName": "Some Subject",
        "subjectNameVerified": False,
        "subjectRole": "a graduate",
    }
    out = CaseStudyOutput.model_construct(headline="H", body=[])
    captured: dict = {}

    def _capture(**kwargs):
        captured.update(kwargs)
        return [{"role": "system", "content": "ok"}, {"role": "user", "content": "ok"}]

    with patch(
        "eisenbalm_pipeline.agents.case_study.build_section_writer_prompt",
        side_effect=_capture,
    ), patch(
        "eisenbalm_pipeline.agents.case_study.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        await case_study(sample_dispatch_state)

    assert captured["research"]["subjectName"] is None
    assert "Do NOT name the subject" in captured["section_guidance"]
