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
from eisenbalm_pipeline.lib.voice import build_section_writer_prompt


def test_section_guidance_is_substantive() -> None:
    """Guidance must convey Fortune-500 framing."""
    assert "400-600" in SECTION_GUIDANCE
    assert "Fortune-500" in SECTION_GUIDANCE


def test_output_schema_shape() -> None:
    """OriginStoryOutput is {headline, body, claimSpans} (Phase 35 PRV-02 adds
    claimSpans as an additive sidecar field)."""
    assert set(OriginStoryOutput.model_fields.keys()) == {
        "headline", "body", "claimSpans",
    }


@pytest.mark.asyncio
async def test_origin_story_runs(sample_dispatch_state) -> None:
    """AGT-09: writer calls build_section_writer_prompt (voice isolation).
    AGT-17: model_versions['origin_story'] populated.
    """
    out = OriginStoryOutput.model_construct(headline="H", body=[])
    with patch(
        "eisenbalm_pipeline.agents.origin_story.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await origin_story(sample_dispatch_state)

    assert result["origin_story"]["headline"] == "H"
    assert result["origin_story"]["body"] == []
    assert result["model_versions"]["origin_story"] == "anthropic/claude-sonnet-4-6"


@pytest.mark.asyncio
async def test_origin_story_voice_isolation(sample_dispatch_state) -> None:
    """AGT-09: agent calls build_section_writer_prompt with only the
    whitelisted 4 state slices — never reads other section state.
    """
    out = OriginStoryOutput.model_construct(headline="H", body=[])
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
        sample_dispatch_state["problem_statement"] = {"headline": "X", "body": []}
        sample_dispatch_state["founder_bio"] = {"headline": "X", "body": []}
        await origin_story(sample_dispatch_state)

    # Phase 16 (Plan 16-05 NRR-04): voice_constraints added as a 7th
    # whitelisted kwarg so the calibrator-set narrator voice can propagate
    # through to the writer's system prompt. Voice-isolation property
    # still holds: voice_constraints is the narrator-aware voice string,
    # NOT a sibling-section's output.
    # Phase 35 PRV-02: claims added as an 8th whitelisted kwarg (the run's
    # claims whitelist derived from state["research"]["claims"] — not a
    # sibling-section's output either).
    allowed = {
        "section_id", "section_title", "section_guidance",
        "charity", "research", "style_brief", "voice_constraints", "claims",
    }
    assert set(captured.keys()).issubset(allowed)


# ─── Phase 35 PRV-02 — claims whitelist injection + claimSpans drop ────────


def _base_prompt_kwargs(claims=None) -> dict:
    kwargs = dict(
        section_id="origin_story",
        section_title="Origin Story",
        section_guidance="guidance",
        charity={"name": "Foo Org", "location": "Nowhere"},
        research={},
        style_brief={},
    )
    if claims is not None:
        kwargs["claims"] = claims
    return kwargs


def test_build_section_writer_prompt_claims_injection() -> None:
    """PRV-02: claims whitelist (claimId + text) lands in the USER message
    only — never the system message (voice isolation, D-05)."""
    messages = build_section_writer_prompt(**_base_prompt_kwargs(
        claims=[{"claimId": "a-0", "text": "$2.3M budget"}]
    ))
    system_content = messages[0]["content"]
    user_content = messages[1]["content"]
    assert "a-0" in user_content
    assert "$2.3M budget" in user_content
    assert "a-0" not in system_content
    assert "$2.3M budget" not in system_content


def test_build_section_writer_prompt_no_claims_no_crash() -> None:
    """No claims kwarg -> still a valid 2-message list, no claims header
    emitted (PRV-02, empty-claims path)."""
    messages = build_section_writer_prompt(**_base_prompt_kwargs())
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"
    assert "SOURCEABLE CLAIMS" not in messages[1]["content"]


def test_build_section_writer_prompt_system_byte_identical_with_claims() -> None:
    """Voice isolation (D-05): system message is byte-identical whether or
    not claims are passed — claims injection is user-prompt only."""
    no_claims = build_section_writer_prompt(**_base_prompt_kwargs())
    with_claims = build_section_writer_prompt(**_base_prompt_kwargs(
        claims=[{"claimId": "a-0", "text": "$2.3M budget"}]
    ))
    assert no_claims[0]["content"] == with_claims[0]["content"]


@pytest.mark.asyncio
async def test_origin_story_drops_unknown_claim_id(sample_dispatch_state) -> None:
    """D-07: a claimSpans entry whose claimId is not in the run's claims
    whitelist is dropped leniently — never raises."""
    sample_dispatch_state["research"] = {
        **(sample_dispatch_state.get("research") or {}),
        "claims": [{"claimId": "a-0", "text": "x", "sourceUrl": None, "retrievedAt": None}],
    }
    out = OriginStoryOutput.model_construct(
        headline="H",
        body=[],
        claimSpans=[
            {"claimId": "a-0", "asWritten": "x"},
            {"claimId": "ZZZ", "asWritten": "y"},
        ],
    )
    with patch(
        "eisenbalm_pipeline.agents.origin_story.acomplete",
        AsyncMock(return_value=(out, {
            "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
            "resolved_model": "anthropic/claude-sonnet-4-6",
        })),
    ):
        result = await origin_story(sample_dispatch_state)

    spans = result["origin_story"]["claimSpans"]
    assert len(spans) == 1
    assert spans[0]["claimId"] == "a-0"
