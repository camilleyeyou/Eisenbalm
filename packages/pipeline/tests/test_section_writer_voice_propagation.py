"""Phase 16 Wave 0 — 4 narrative writers propagate narrator voice (NRR-04).

Per 16-RESEARCH Pitfall 2: the 4 narrative writer agents (origin_story,
problem, founder_bio, case_study) MUST pass
voice_constraints=style_brief.get("voice", VOICE_CONSTRAINTS) to
build_section_writer_prompt. Otherwise the narrator voice never reaches the
writers and the Herzog/Maya runs produce Jesse-in-disguise output.

This test patches build_section_writer_prompt with a capturing side_effect
and asserts the kwarg is passed.

RED until Plan 16-05 lands.

Skip guard: gates on `assemble_voice` import (Phase 16-04 sentinel) so this
file stays SKIPPED at the Wave 0 commit even though the writer modules
themselves already exist (Phase 5).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


try:
    from eisenbalm_pipeline.lib.voice import assemble_voice  # noqa: F401  # Phase 16-04 sentinel
    PHASE_16_VOICE_AVAILABLE = True
except ImportError:
    PHASE_16_VOICE_AVAILABLE = False


pytestmark = pytest.mark.skipif(
    not PHASE_16_VOICE_AVAILABLE,
    reason="Plan 16-05 not yet landed — section writers do not yet propagate narrator voice (gated on assemble_voice import)",
)


WRITERS = [
    ("origin_story", "eisenbalm_pipeline.agents.origin_story", "origin_story"),
    ("problem", "eisenbalm_pipeline.agents.problem", "problem"),
    ("founder_bio", "eisenbalm_pipeline.agents.founder_bio", "founder_bio"),
    ("case_study", "eisenbalm_pipeline.agents.case_study", "case_study"),
]


def _state_with_narrator_voice() -> dict:
    return {
        "run_id": "run-writer-test-001",
        "issue_number": 42,
        "style_brief": {
            "voice": "HERZOG_PERSONA_MARKER",   # sentinel: if this reaches build_section_writer_prompt, propagation works
            "constraints": [],
            "bonusType": "bigBudget",
            "visualDirection": "",
            "previousBonusTypes": [],
        },
        "winning_charity": {"name": "The Nap Ministry", "location": "Atlanta"},
        "research": {"foundingMoment": "x", "founderBackground": "y"},
        "model_versions": {},
    }


@pytest.mark.parametrize("writer_name,module_path,func_name", WRITERS)
@pytest.mark.asyncio
async def test_writer_propagates_narrator_voice(writer_name: str, module_path: str, func_name: str):
    """Each writer MUST forward style_brief['voice'] into build_section_writer_prompt's voice_constraints kwarg."""
    try:
        import importlib
        mod = importlib.import_module(module_path)
        writer_fn = getattr(mod, func_name)
    except (ImportError, AttributeError):
        pytest.skip(f"Plan 16-05 not yet landed for writer {writer_name}")

    captured: dict = {}

    def _capture(**kwargs):
        captured.update(kwargs)
        return [{"role": "system", "content": "stub"}, {"role": "user", "content": "stub"}]

    with patch.object(mod, "build_section_writer_prompt", side_effect=_capture), \
         patch.object(mod, "acomplete", new=AsyncMock(return_value=(None, {"resolved_model": "stub"}))):
        try:
            await writer_fn(_state_with_narrator_voice())
        except Exception:
            # The writer may raise after build_section_writer_prompt is called (no real LLM response);
            # we only care that the kwarg was captured.
            pass

    assert "voice_constraints" in captured, (
        f"writer '{writer_name}' did not pass voice_constraints kwarg to build_section_writer_prompt — "
        f"narrator voice will silently fall back to Jesse default (Pitfall 2)"
    )
    assert captured["voice_constraints"] == "HERZOG_PERSONA_MARKER", (
        f"writer '{writer_name}' passed a voice_constraints value that does not match style_brief['voice'] — "
        f"got {captured['voice_constraints']!r}, expected the style_brief['voice'] sentinel string"
    )
