"""Phase 5 ProblemWriter unit tests — implemented by Plan 05-10.

Validation: AGT-09 (voice isolation via build_section_writer_prompt),
AGT-17 (modelVersions), Phase 6 contract (pdfContent shape locked).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.problem import (
    KeyDataPoint,
    PdfContent,
    ProblemOutput,
    SECTION_GUIDANCE,
    problem,
)


def test_pdf_content_locked_shape() -> None:
    """Phase 6 contract: pdfContent has exactly 3 fields, 3 keyDataPoints."""
    pc = PdfContent(
        problemStatement="x",
        keyDataPoints=[
            KeyDataPoint(stat="s1", source="u1"),
            KeyDataPoint(stat="s2", source="u2"),
            KeyDataPoint(stat="s3", source="u3"),
        ],
        interventionMechanism="y",
    )
    assert len(pc.keyDataPoints) == 3
    assert set(PdfContent.model_fields.keys()) == {
        "problemStatement", "keyDataPoints", "interventionMechanism",
    }
    assert set(KeyDataPoint.model_fields.keys()) == {"stat", "source"}


def test_key_data_points_must_be_three() -> None:
    """Phase 6 contract: keyDataPoints has min_length=3, max_length=3."""
    with pytest.raises(Exception):
        PdfContent(
            problemStatement="x",
            keyDataPoints=[KeyDataPoint(stat="s1", source="u1")],
            interventionMechanism="y",
        )
    with pytest.raises(Exception):
        PdfContent(
            problemStatement="x",
            keyDataPoints=[KeyDataPoint(stat=f"s{i}", source=f"u{i}") for i in range(4)],
            interventionMechanism="y",
        )


def test_section_guidance_mentions_pdf_content() -> None:
    assert "pdfContent" in SECTION_GUIDANCE
    assert "WeasyPrint" in SECTION_GUIDANCE


@pytest.mark.asyncio
async def test_problem_pdf_content(sample_dispatch_state) -> None:
    """AGT-09 + Phase 6 contract: pdfContent shape passes through to state."""
    pdf = PdfContent(
        problemStatement="ps",
        keyDataPoints=[
            KeyDataPoint(stat="s1", source="u1"),
            KeyDataPoint(stat="s2", source="u2"),
            KeyDataPoint(stat="s3", source="u3"),
        ],
        interventionMechanism="im",
    )
    # Phase 18 D-01: ProblemOutput.body is now list[BodyBlock]; D-03: pdfContent unchanged.
    # Use model_construct to bypass structural floor validation in this integration test.
    out = ProblemOutput.model_construct(headline="H", body=[], pdfContent=pdf)
    with patch(
        "eisenbalm_pipeline.agents.problem.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await problem(sample_dispatch_state)

    # State field is problem_statement (DispatchState §7) per validate_sections REQUIRED_FIELDS.
    assert "problem_statement" in result
    assert result["problem_statement"]["headline"] == "H"
    assert result["problem_statement"]["body"] == []
    assert len(result["problem_statement"]["pdfContent"]["keyDataPoints"]) == 3
    assert "problemStatement" in result["problem_statement"]["pdfContent"]
    assert "interventionMechanism" in result["problem_statement"]["pdfContent"]
    assert result["model_versions"]["problem"] == "anthropic/claude-sonnet-4-6"


@pytest.mark.asyncio
async def test_problem_voice_isolation(sample_dispatch_state) -> None:
    """AGT-09: build_section_writer_prompt called only with the 4 whitelisted slices."""
    pdf = PdfContent(
        problemStatement="p",
        keyDataPoints=[KeyDataPoint(stat=f"s{i}", source=f"u{i}") for i in range(3)],
        interventionMechanism="i",
    )
    out = ProblemOutput.model_construct(headline="H", body=[], pdfContent=pdf)
    captured: dict = {}

    def _capture(**kwargs):
        captured.update(kwargs)
        return [{"role": "system", "content": "ok"}, {"role": "user", "content": "ok"}]

    with patch(
        "eisenbalm_pipeline.agents.problem.build_section_writer_prompt",
        side_effect=_capture,
    ), patch(
        "eisenbalm_pipeline.agents.problem.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        sample_dispatch_state["origin_story"] = {"headline": "X", "body": []}
        sample_dispatch_state["founder_bio"] = {"headline": "X", "body": []}
        sample_dispatch_state["case_study"] = {"headline": "X", "body": []}
        await problem(sample_dispatch_state)

    # Phase 16 (Plan 16-05 NRR-04): voice_constraints added as a 7th
    # whitelisted kwarg so the calibrator-set narrator voice can propagate.
    allowed = {
        "section_id", "section_title", "section_guidance",
        "charity", "research", "style_brief", "voice_constraints",
    }
    assert set(captured.keys()).issubset(allowed)


@pytest.mark.asyncio
async def test_problem_drops_unknown_claim_id(sample_dispatch_state) -> None:
    """Phase 35 D-07: unknown claimId dropped leniently; known claimId kept."""
    pdf = PdfContent(
        problemStatement="p",
        keyDataPoints=[KeyDataPoint(stat=f"s{i}", source=f"u{i}") for i in range(3)],
        interventionMechanism="i",
    )
    sample_dispatch_state["research"] = {
        **(sample_dispatch_state.get("research") or {}),
        "claims": [{"claimId": "a-0", "text": "x", "sourceUrl": None, "retrievedAt": None}],
    }
    out = ProblemOutput.model_construct(
        headline="H",
        body=[],
        pdfContent=pdf,
        claimSpans=[
            {"claimId": "a-0", "asWritten": "x"},
            {"claimId": "ZZZ", "asWritten": "y"},
        ],
    )
    with patch(
        "eisenbalm_pipeline.agents.problem.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await problem(sample_dispatch_state)

    spans = result["problem_statement"]["claimSpans"]
    assert len(spans) == 1
    assert spans[0]["claimId"] == "a-0"
