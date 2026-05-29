"""Phase 16 Wave 0 — Calibrator narrator wiring (NRR-03).

Asserts:
  - calibrator() reads state['narrator'] and passes it to assemble_voice
  - style_brief['voice'] equals assemble_voice(narrator)
  - inactive narrator (active=False) falls back to Jesse AND emits a warning
    deliberationEvents event (D-14)
  - narrator=None → byte-equivalent Jesse behavior

RED until Plan 16-05 lands.

Skip guard: importing `assemble_voice` from lib/voice doubles as the
"Phase 16-04 has landed" signal. While calibrator() exists today (Phase 5),
its narrator-awareness depends on assemble_voice, so we gate on the latter
to keep the existing 168-passing pipeline suite green at this Wave 0 commit.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


try:
    from eisenbalm_pipeline.agents.calibrator import calibrator  # noqa: F401
    from eisenbalm_pipeline.lib.voice import (  # noqa: F401
        VOICE_CONSTRAINTS,
        assemble_voice,  # Phase 16-04 sentinel
    )
    CALIBRATOR_PHASE_16_AVAILABLE = True
except ImportError:
    CALIBRATOR_PHASE_16_AVAILABLE = False


pytestmark = pytest.mark.skipif(
    not CALIBRATOR_PHASE_16_AVAILABLE,
    reason="Plan 16-05 not yet landed — calibrator narrator wiring missing (gated on assemble_voice import)",
)


def _state(narrator: dict | None = None) -> dict:
    return {
        "run_id": "run-cal-test-001",
        "issue_number": 42,
        "publish_date": "2026-06-04",
        "narrator": narrator,
        "model_versions": {},
    }


@pytest.mark.asyncio
async def test_calibrator_uses_assemble_voice_with_narrator():
    """When state['narrator'] is set, calibrator MUST call assemble_voice(narrator) and put the result on style_brief['voice']."""
    from eisenbalm_pipeline.agents import calibrator as cal_mod
    herzog = {
        "name": "Werner Herzog",
        "slug": "werner-herzog",
        "voiceConstraints": "Speak with geological gravity. The sentences breathe.",
        "voiceRubric": "Reward geological-time metaphors.",
        "exampleSamples": ["Sample 1", "Sample 2", "Sample 3"],
        "active": True,
    }
    state = _state(narrator=herzog)

    # Stub LLM + Sanity round-trip so we can run the node in isolation.
    with patch.object(cal_mod, "_fetch_previous_bonus_types", new=AsyncMock(return_value=[])), \
         patch.object(cal_mod, "acomplete", new=AsyncMock(return_value=(None, {"resolved_model": "stub"}))):
        result = await cal_mod.calibrator(state)

    voice = result["style_brief"]["voice"]
    assert "geological gravity" in voice, (
        "Calibrator did not merge narrator.voiceConstraints into style_brief['voice']"
    )


@pytest.mark.asyncio
async def test_calibrator_narrator_none_byte_equivalent_to_jesse():
    """When narrator is None, style_brief['voice'] == VOICE_CONSTRAINTS (NRR-10)."""
    from eisenbalm_pipeline.agents import calibrator as cal_mod
    from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS

    state = _state(narrator=None)
    with patch.object(cal_mod, "_fetch_previous_bonus_types", new=AsyncMock(return_value=[])), \
         patch.object(cal_mod, "acomplete", new=AsyncMock(return_value=(None, {"resolved_model": "stub"}))):
        result = await cal_mod.calibrator(state)

    assert result["style_brief"]["voice"] == VOICE_CONSTRAINTS, (
        "Byte-equivalence regression: narrator=None should produce VOICE_CONSTRAINTS verbatim"
    )


@pytest.mark.asyncio
async def test_inactive_narrator_falls_back_to_jesse_with_warning():
    """active=False → fall back to Jesse + emit warning via existing editor-decision eventType (D-14)."""
    from eisenbalm_pipeline.agents import calibrator as cal_mod
    from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS

    parked = {
        "name": "Aaron Sorkin",
        "slug": "aaron-sorkin",
        "voiceConstraints": "Walk and talk.",
        "voiceRubric": "Reward stage directions.",
        "exampleSamples": [],
        "active": False,
    }
    state = _state(narrator=parked)

    warning_calls: list[dict] = []

    async def _capture_event(**kwargs):
        warning_calls.append(kwargs)

    with patch.object(cal_mod, "_fetch_previous_bonus_types", new=AsyncMock(return_value=[])), \
         patch.object(cal_mod, "acomplete", new=AsyncMock(return_value=(None, {"resolved_model": "stub"}))), \
         patch("eisenbalm_pipeline.agents.calibrator.convex_mutation_safe", new=AsyncMock(side_effect=_capture_event)):
        result = await cal_mod.calibrator(state)

    # Fall-back assertion
    assert result["style_brief"]["voice"] == VOICE_CONSTRAINTS, (
        "Inactive narrator did not fall back to Jesse voice (D-14)"
    )
    # Warning assertion — at least one Convex mutation call carries the warning payload
    warning_payloads = []
    for call_kwargs in warning_calls:
        # convex_mutation_safe typically takes (mutation_name, args) — inspect both kwargs and positional shapes
        for value in list(call_kwargs.values()):
            if isinstance(value, dict) and "warning" in str(value).lower():
                warning_payloads.append(value)
    assert any(warning_payloads) or any(
        "warning" in str(call).lower() for call in warning_calls
    ), (
        "Inactive narrator did not emit a warning deliberationEvents row (D-14). "
        "Expected Convex mutation with payload containing 'warning' and inactive narrator name."
    )
