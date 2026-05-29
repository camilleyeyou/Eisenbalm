"""Phase 16 Wave 0 — QA judge narrator-awareness (NRR-06).

Asserts:
  - run_llm_judge accepts narrator: Optional[dict] = None kwarg (signature gate)
  - when narrator is set, the system message includes narrator.voiceRubric AND
    at least one entry from narrator.exampleSamples[:3]
  - when narrator is None, the system message matches the legacy rubric.md
    content byte-equivalently (NRR-10 zero-regression)

RED until Plan 16-07 lands.

Skip guard: gates on `assemble_voice` import (Phase 16-04 sentinel) so this
file stays SKIPPED at the Wave 0 commit even though run_llm_judge already
exists (Phase 5) — the narrator kwarg is the Phase 16-07 addition.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


try:
    from eisenbalm_pipeline.agents.qa.judge import run_llm_judge  # noqa: F401
    from eisenbalm_pipeline.lib.voice import assemble_voice  # noqa: F401  # Phase 16-04 sentinel
    JUDGE_AVAILABLE = True
except ImportError:
    JUDGE_AVAILABLE = False


pytestmark = pytest.mark.skipif(
    not JUDGE_AVAILABLE,
    reason="Plan 16-07 not yet landed — QA judge narrator kwarg missing (gated on assemble_voice import)",
)


def _sections() -> dict[str, str]:
    return {
        "origin_story": "Stub origin story body.",
        "problem": "Stub problem body.",
        "founder_bio": "Stub founder bio body.",
        "case_study": "Stub case study body.",
        "game": "Stub game body.",
        "bonus": "Stub bonus body.",
    }


@pytest.mark.asyncio
async def test_judge_signature_accepts_narrator_kwarg():
    """run_llm_judge MUST accept narrator: Optional[dict] = None as kwarg (Plan 16-07 contract)."""
    import inspect
    from eisenbalm_pipeline.agents.qa.judge import run_llm_judge
    sig = inspect.signature(run_llm_judge)
    assert "narrator" in sig.parameters, (
        "run_llm_judge missing 'narrator' kwarg — NRR-06 contract requires the judge accept narrator at call time"
    )


@pytest.mark.asyncio
async def test_judge_appends_narrator_rubric():
    """When narrator is set, the system message must include narrator.voiceRubric content."""
    from eisenbalm_pipeline.agents.qa import judge as judge_mod
    herzog = {
        "name": "Werner Herzog",
        "slug": "werner-herzog",
        "voiceConstraints": "Speak with geological gravity.",
        "voiceRubric": "HERZOG_RUBRIC_SENTINEL — reward sweeping cosmic framing.",
        "exampleSamples": ["HERZOG_SAMPLE_SENTINEL — a sample of his voice.", "Another sample.", "Third sample."],
        "active": True,
    }
    captured_messages: list[list[dict]] = []

    async def _capture_complete(**kwargs):
        captured_messages.append(kwargs["messages"])
        # Return an empty findings result so the judge happy-path completes.
        class _Result:
            findings = []
        return _Result(), {"resolved_model": "stub"}

    with patch.object(judge_mod, "acomplete", new=_capture_complete):
        await judge_mod.run_llm_judge(_sections(), run_id="r1", narrator=herzog)

    assert captured_messages, "acomplete was not called"
    system_content = captured_messages[0][0]["content"]
    assert "HERZOG_RUBRIC_SENTINEL" in system_content, (
        "QA judge did not append narrator.voiceRubric to the system message"
    )
    assert "HERZOG_SAMPLE_SENTINEL" in system_content, (
        "QA judge did not append at least one exampleSamples entry as few-shot anchor"
    )


@pytest.mark.asyncio
async def test_qa_judge_narrator_none_preserves_legacy_messages():
    """When narrator is None, the system message MUST equal the legacy rubric.md content (NRR-10 zero-regression)."""
    from eisenbalm_pipeline.agents.qa import judge as judge_mod
    legacy_rubric = judge_mod._load_rubric()   # noqa: SLF001

    captured_messages: list[list[dict]] = []

    async def _capture_complete(**kwargs):
        captured_messages.append(kwargs["messages"])
        class _Result:
            findings = []
        return _Result(), {"resolved_model": "stub"}

    with patch.object(judge_mod, "acomplete", new=_capture_complete):
        await judge_mod.run_llm_judge(_sections(), run_id="r1", narrator=None)

    system_content = captured_messages[0][0]["content"]
    assert system_content == legacy_rubric, (
        "QA judge system message diverged from legacy rubric.md when narrator=None (NRR-10)"
    )

    # B6 fix (revision 1): NRR-10 also pins the USER message byte-for-byte when narrator=None.
    # The legacy Phase 5 user message content is reconstructed here from the same template
    # judge.py uses, so the test catches any user-message drift (e.g., narrator-aware
    # user_intro prefixes accidentally landing on the narrator=None path).
    import json as _json
    sections_json = _json.dumps(_sections(), indent=2)
    legacy_user_content = (
        "Evaluate these section bodies against the Jesse voice rubric. "
        "Return JSON JudgeFindings with a `findings` array. "
        "An empty array is a passing grade.\n\n"
        f"SECTIONS:\n{sections_json}"
    )
    user_content = captured_messages[0][1]["content"]
    assert user_content == legacy_user_content, (
        "QA judge USER message diverged from legacy Phase 5 content when narrator=None (NRR-10). "
        "Plan 16-07 must NOT inject a narrator-aware user_intro on the narrator=None path."
    )
