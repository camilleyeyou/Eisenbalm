"""Phase 47 (BRF-05, Plan 47-03) — all 7 section writers thread the Brief.

Verifies:
  1. Source-level: every one of the 7 SECTION_WRITERS modules
     (origin_story, problem, founder_bio, case_study, game, bonus, design)
     references ``state.get("brief")`` — the grep-verifiable proof cited in
     the plan's acceptance criteria.
  2. Behavioral: the 4 helper-routed writers (origin_story, problem,
     founder_bio, case_study) pass ``brief=state.get("brief")`` into
     ``build_section_writer_prompt`` — mirrors
     ``test_section_writer_voice_propagation.py``'s capture pattern for the
     ``voice_constraints`` kwarg.

Only 4 writers route through ``build_section_writer_prompt`` (RESEARCH
correction to the original "7 call sites" hypothesis); the other 3
(game, bonus, design) are bespoke prompt builders that call
``lib.voice.build_brief_block`` directly — see 47-03-PLAN.md.
"""
from __future__ import annotations

import importlib
import inspect
from unittest.mock import AsyncMock, patch

import pytest

WRITER_MODULES = [
    "eisenbalm_pipeline.agents.origin_story",
    "eisenbalm_pipeline.agents.problem",
    "eisenbalm_pipeline.agents.founder_bio",
    "eisenbalm_pipeline.agents.case_study",
    "eisenbalm_pipeline.agents.game",
    "eisenbalm_pipeline.agents.bonus",
    "eisenbalm_pipeline.agents.design",
]


@pytest.mark.parametrize("module_path", WRITER_MODULES)
def test_writer_module_references_state_get_brief(module_path: str) -> None:
    """Every SECTION_WRITERS module's source must contain the literal
    ``state.get("brief")`` — the plan's grep-verifiable proof that all 7
    section writers thread the Brief."""
    mod = importlib.import_module(module_path)
    source = inspect.getsource(mod)
    assert 'state.get("brief")' in source, (
        f"{module_path} does not reference state.get(\"brief\") — "
        f"this writer does not thread the Story Brief (BRF-05)"
    )


HELPER_WRITERS = [
    ("origin_story", "eisenbalm_pipeline.agents.origin_story", "origin_story"),
    ("problem", "eisenbalm_pipeline.agents.problem", "problem"),
    ("founder_bio", "eisenbalm_pipeline.agents.founder_bio", "founder_bio"),
    ("case_study", "eisenbalm_pipeline.agents.case_study", "case_study"),
]


def _state_with_brief() -> dict:
    return {
        "run_id": "run-brief-threading-test-001",
        "issue_number": 42,
        "style_brief": {
            "voice": "",
            "constraints": [],
            "bonusType": "bigBudget",
            "visualDirection": "",
            "previousBonusTypes": [],
        },
        "winning_charity": {"name": "The Nap Ministry", "location": "Atlanta"},
        "research": {"foundingMoment": "x", "founderBackground": "y"},
        "brief": {
            "premise": "BRIEF_PREMISE_SENTINEL",
            "currentPeg": "",
            "centralClaim": "",
            "readerEffect": "",
            "knownRisks": "",
            "voiceIntention": "",
        },
        "model_versions": {},
    }


@pytest.mark.parametrize("writer_name,module_path,func_name", HELPER_WRITERS)
@pytest.mark.asyncio
async def test_helper_writer_passes_brief_kwarg(
    writer_name: str, module_path: str, func_name: str
) -> None:
    """Each of the 4 helper-routed writers MUST forward
    state.get("brief") into build_section_writer_prompt's brief= kwarg."""
    mod = importlib.import_module(module_path)
    writer_fn = getattr(mod, func_name)

    captured: dict = {}

    def _capture(**kwargs):
        captured.update(kwargs)
        return [{"role": "system", "content": "stub"}, {"role": "user", "content": "stub"}]

    with patch.object(mod, "build_section_writer_prompt", side_effect=_capture), \
         patch.object(mod, "acomplete", new=AsyncMock(return_value=(None, {"resolved_model": "stub"}))):
        try:
            await writer_fn(_state_with_brief())
        except Exception:
            # The writer may raise after build_section_writer_prompt is
            # called (no real LLM response); we only care the kwarg landed.
            pass

    assert "brief" in captured, (
        f"writer '{writer_name}' did not pass the brief kwarg to "
        f"build_section_writer_prompt (BRF-05)"
    )
    assert captured["brief"]["premise"] == "BRIEF_PREMISE_SENTINEL", (
        f"writer '{writer_name}' passed a brief value that does not match "
        f"state['brief'] — got {captured['brief']!r}"
    )
