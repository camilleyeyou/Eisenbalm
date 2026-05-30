"""Phase 5 FounderBioWriter unit tests — implemented by Plan 05-10.

Validation source: .planning/phases/05-agent-quality/05-VALIDATION.md
REQ-ID: AGT-10 (role-framing branching), AGT-09 (voice isolation), AGT-17.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.founder_bio import (
    FounderBioOutput,
    GUIDANCE_ANONYMOUS,
    GUIDANCE_VERIFIED,
    _select_guidance_and_scrub,
    founder_bio,
)


def test_select_guidance_verified() -> None:
    """AGT-10: founderNameVerified=True returns the verified guidance and
    preserves the founderName in the research dict.
    """
    g, r = _select_guidance_and_scrub({
        "founderName": "Jane Doe",
        "founderNameVerified": True,
    })
    assert g == GUIDANCE_VERIFIED
    assert "verified; use it" in g
    assert r["founderName"] == "Jane Doe"


def test_role_framing() -> None:
    """AGT-10: founderNameVerified=False switches to role framing + scrubs
    founderName from the research dict before it reaches the LLM
    (RESEARCH Pitfall 5).
    """
    g, r = _select_guidance_and_scrub({
        "founderName": "Jane Doe",
        "founderNameVerified": False,
        "founderRole": "executive director",
    })
    assert "Do NOT use or guess a name" in g
    assert "executive director" in g
    assert r["founderName"] is None


def test_role_framing_default_role() -> None:
    """AGT-10: missing founderRole falls back to generic 'founder' role."""
    g, r = _select_guidance_and_scrub({
        "founderName": "Jane Doe",
        "founderNameVerified": False,
    })
    assert "founder" in g
    assert r["founderName"] is None


@pytest.mark.asyncio
async def test_founder_bio_runs(sample_dispatch_state) -> None:
    """AGT-17: model_versions['founder_bio'] populated; state['founder_bio'] set."""
    sample_dispatch_state["research"] = {
        "founderName": "Jane Doe",
        "founderNameVerified": True,
        "founderBio": "bio",
        "summary": "s",
    }
    out = FounderBioOutput.model_construct(headline="H", body=[])
    with patch(
        "eisenbalm_pipeline.agents.founder_bio.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await founder_bio(sample_dispatch_state)
    assert result["founder_bio"]["headline"] == "H"
    assert result["founder_bio"]["body"] == []
    assert result["model_versions"]["founder_bio"] == "anthropic/claude-sonnet-4-6"


@pytest.mark.asyncio
async def test_founder_bio_voice_isolation(sample_dispatch_state) -> None:
    """AGT-09: only whitelisted state slices reach build_section_writer_prompt."""
    out = FounderBioOutput.model_construct(headline="H", body=[])
    captured: dict = {}

    def _capture(**kwargs):
        captured.update(kwargs)
        return [{"role": "system", "content": "ok"}, {"role": "user", "content": "ok"}]

    with patch(
        "eisenbalm_pipeline.agents.founder_bio.build_section_writer_prompt",
        side_effect=_capture,
    ), patch(
        "eisenbalm_pipeline.agents.founder_bio.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        sample_dispatch_state["origin_story"] = {"headline": "X", "body": []}
        sample_dispatch_state["problem_statement"] = {"headline": "X", "body": []}
        sample_dispatch_state["case_study"] = {"headline": "X", "body": []}
        await founder_bio(sample_dispatch_state)

    # Phase 16 (Plan 16-05 NRR-04): voice_constraints added as a 7th
    # whitelisted kwarg so the calibrator-set narrator voice can propagate.
    allowed = {
        "section_id", "section_title", "section_guidance",
        "charity", "research", "style_brief", "voice_constraints",
    }
    assert set(captured.keys()).issubset(allowed)


@pytest.mark.asyncio
async def test_founder_bio_unverified_scrubs_name(sample_dispatch_state) -> None:
    """AGT-10 / Pitfall 5: when verified=False, the research dict passed
    into the prompt has founderName=None — preventing model hallucination
    that the name is somehow still authoritative.
    """
    sample_dispatch_state["research"] = {
        "founderName": "Some Name",
        "founderNameVerified": False,
        "founderRole": "director",
    }
    out = FounderBioOutput.model_construct(headline="H", body=[])
    captured: dict = {}

    def _capture(**kwargs):
        captured.update(kwargs)
        return [{"role": "system", "content": "ok"}, {"role": "user", "content": "ok"}]

    with patch(
        "eisenbalm_pipeline.agents.founder_bio.build_section_writer_prompt",
        side_effect=_capture,
    ), patch(
        "eisenbalm_pipeline.agents.founder_bio.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        await founder_bio(sample_dispatch_state)

    assert captured["research"]["founderName"] is None
    assert "Do NOT use or guess a name" in captured["section_guidance"]
