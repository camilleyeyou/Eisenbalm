"""Phase 5 OriginStoryWriter unit tests — implemented by Plan 05-10.

Validation: AGT-09 (voice isolation via build_section_writer_prompt),
AGT-17 (modelVersions recording).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.origin_story import (
    OriginStoryOutput,
    SECTION_GUIDANCE,
    origin_story,
)


def test_section_guidance_is_substantive() -> None:
    """Guidance must convey Fortune-500 framing."""
    assert "400-600" in SECTION_GUIDANCE
    assert "Fortune-500" in SECTION_GUIDANCE


def test_output_schema_shape() -> None:
    """OriginStoryOutput is {headline, body}."""
    assert set(OriginStoryOutput.model_fields.keys()) == {"headline", "body"}


@pytest.mark.asyncio
async def test_origin_story_runs(sample_dispatch_state) -> None:
    """AGT-09: writer calls build_section_writer_prompt (voice isolation).
    AGT-17: model_versions['origin_story'] populated.
    """
    out = OriginStoryOutput(headline="H", body="B")
    with patch(
        "eisenbalm_pipeline.agents.origin_story.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await origin_story(sample_dispatch_state)

    assert result["origin_story"]["headline"] == "H"
    assert result["origin_story"]["body"] == "B"
    assert result["model_versions"]["origin_story"] == "anthropic/claude-sonnet-4-6"


@pytest.mark.asyncio
async def test_origin_story_voice_isolation(sample_dispatch_state) -> None:
    """AGT-09: agent calls build_section_writer_prompt with only the
    whitelisted 4 state slices — never reads other section state.
    """
    out = OriginStoryOutput(headline="H", body="B")
    captured: dict = {}

    def _capture(**kwargs):
        captured.update(kwargs)
        return [{"role": "system", "content": "ok"}, {"role": "user", "content": "ok"}]

    with patch(
        "eisenbalm_pipeline.agents.origin_story.build_section_writer_prompt",
        side_effect=_capture,
    ), patch(
        "eisenbalm_pipeline.agents.origin_story.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        # Pollute state with sibling-section outputs; agent must NOT pass them through.
        sample_dispatch_state["problem_statement"] = {"headline": "X", "body": "X"}
        sample_dispatch_state["founder_bio"] = {"headline": "X", "body": "X"}
        await origin_story(sample_dispatch_state)

    # Phase 16 (Plan 16-05 NRR-04): voice_constraints added as a 7th
    # whitelisted kwarg so the calibrator-set narrator voice can propagate
    # through to the writer's system prompt. Voice-isolation property
    # still holds: voice_constraints is the narrator-aware voice string,
    # NOT a sibling-section's output.
    allowed = {
        "section_id", "section_title", "section_guidance",
        "charity", "research", "style_brief", "voice_constraints",
    }
    assert set(captured.keys()).issubset(allowed)
