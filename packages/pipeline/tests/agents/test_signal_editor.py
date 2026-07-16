"""Phase 46 Plan 04 — Signal Editor agent tests (SGE-01, SGE-02, SGE-05).

Mirrors ``tests/agents/test_scout_discover.py``'s monkeypatch pattern:
``acomplete`` / ``web_search`` / ``convex_mutation_safe`` /
``convex_query_safe`` are all patched as module attributes on
``eisenbalm_pipeline.agents.signal_editor`` so the wrapped ``@agent_node``
body runs its real logic end-to-end against fully-controlled stand-ins.

Test names are locked by the Wave-0 scaffold (46-01) / 46-VALIDATION.md's
requirement->test map — do not rename.
"""
from __future__ import annotations

import logging
from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.signal_editor import (
    SignalEditorOutput,
    StoryLeadModel,
    signal_editor,
)
from eisenbalm_pipeline.lib.search_client import SearchResult

_USAGE = {
    "tokens_in": 10,
    "tokens_out": 5,
    "usd": 0.001,
    "resolved_model": "anthropic/claude-sonnet-4-6",
}

_TAVILY_RESULTS = [
    SearchResult(
        url=f"https://news{i}.example/story",
        title=f"Story {i}",
        content="A dated, sourced event happened.",
        score=0.9,
    )
    for i in range(3)
]


def _make_lead(**overrides) -> StoryLeadModel:
    base = dict(
        premise="A regional food bank responds to a sudden shortfall.",
        datedPeg="2026-07-14 supply-chain disruption reported by local news.",
        pegSourceUrl="https://news.example/2026-07-14-shortfall",
        readerEnergy="Immediate, local, and quietly urgent.",
        charitableAngle="Connects directly to a food-security response.",
        category="food security",
        confidence="medium",
        brandRiskFlag=False,
        brandRiskReason=None,
        repetitionWarning=None,
        recommended=False,
    )
    base.update(overrides)
    return StoryLeadModel(**base)


def _state(**overrides) -> dict:
    base = {"run_id": "test-run-signal-0001", "issue_number": 1, "model_versions": {}}
    base.update(overrides)
    return base


def _patch_common(*, acomplete_return, convex_query_safe_return=None, convex_query_safe_side_effect=None):
    """Returns the list of active patchers (used as a context-manager tuple)."""
    return (
        patch(
            "eisenbalm_pipeline.agents.signal_editor.web_search",
            AsyncMock(return_value=_TAVILY_RESULTS),
        ),
        patch(
            "eisenbalm_pipeline.agents.signal_editor.acomplete",
            AsyncMock(return_value=acomplete_return),
        ),
        patch(
            "eisenbalm_pipeline.agents.signal_editor.convex_mutation_safe",
            AsyncMock(),
        ),
        patch(
            "eisenbalm_pipeline.agents.signal_editor.convex_query_safe",
            AsyncMock(
                return_value=convex_query_safe_return,
                side_effect=convex_query_safe_side_effect,
            ),
        ),
    )


async def test_emits_leads_with_required_fields() -> None:
    """SGE-01: signal_editor emits 3-5 StoryLead dicts with all required fields."""
    leads = [_make_lead() for _ in range(4)]
    output = SignalEditorOutput(leads=leads)

    p1, p2, p3, p4 = _patch_common(acomplete_return=(output, _USAGE))
    with p1, p2, p3, p4:
        result = await signal_editor(_state())

    story_leads = result["story_leads"]
    assert 3 <= len(story_leads) <= 5
    expected_keys = {
        "premise", "datedPeg", "pegSourceUrl", "readerEnergy", "charitableAngle",
        "category", "confidence", "brandRiskFlag", "brandRiskReason",
        "repetitionWarning", "recommended",
    }
    for lead in story_leads:
        assert expected_keys.issubset(lead.keys())
    assert result["model_versions"]["signal_editor"] == "anthropic/claude-sonnet-4-6"


async def test_brand_risk_never_recommended() -> None:
    """SGE-02: `recommended` is never True on a brandRiskFlag=True lead, even if
    the LLM output claims otherwise — enforced in Python, not only prompted."""
    risky = _make_lead(
        brandRiskFlag=True,
        brandRiskReason="Touches an active, politically contested dispute.",
        recommended=True,  # the LLM violating the rule — Python must correct it
    )
    safe_leads = [_make_lead() for _ in range(2)]
    output = SignalEditorOutput(leads=[risky, *safe_leads])

    p1, p2, p3, p4 = _patch_common(acomplete_return=(output, _USAGE))
    with p1, p2, p3, p4:
        result = await signal_editor(_state())

    flagged = [l for l in result["story_leads"] if l["brandRiskFlag"]]
    assert flagged, "expected at least one brand-risk-flagged lead in the result"
    for lead in flagged:
        assert lead["recommended"] is False
        assert lead["brandRiskReason"]


async def test_repetition_warning_attached() -> None:
    """SGE-05: a lead overlapping recent coverage / the avoid-list gets an
    advisory `repetitionWarning`; the lead is still emitted (surface, never
    suppress)."""
    overlapping = _make_lead(
        category="weather", repetitionWarning="avoid US-SE · avoid weather",
    )
    other_leads = [_make_lead() for _ in range(2)]
    output = SignalEditorOutput(leads=[overlapping, *other_leads])

    acomplete_mock = AsyncMock(return_value=(output, _USAGE))
    convex_query_safe_mock = AsyncMock(
        return_value=[{"sanityCharityId": f"charity-{i}"} for i in range(8)]
    )
    groq_rows = [
        {"_id": "charity-0", "focusArea": "weather", "location": "US-SE"},
        {"_id": "charity-1", "focusArea": "weather", "location": "US-SE"},
        {"_id": "charity-2", "focusArea": "weather", "location": "US-SE"},
        {"_id": "charity-3", "focusArea": "housing", "location": "US-NE"},
    ]
    groq_query_mock = AsyncMock(return_value=groq_rows)

    with patch(
        "eisenbalm_pipeline.agents.signal_editor.web_search",
        AsyncMock(return_value=_TAVILY_RESULTS),
    ), patch(
        "eisenbalm_pipeline.agents.signal_editor.acomplete", acomplete_mock,
    ), patch(
        "eisenbalm_pipeline.agents.signal_editor.convex_mutation_safe", AsyncMock(),
    ), patch(
        "eisenbalm_pipeline.agents.signal_editor.convex_query_safe",
        convex_query_safe_mock,
    ), patch(
        "eisenbalm_pipeline.agents.signal_editor.groq_query", groq_query_mock,
    ):
        result = await signal_editor(_state())

    story_leads = result["story_leads"]
    # Surface, never suppress: no lead is dropped on repetition grounds.
    assert len(story_leads) == 3
    warned = [l for l in story_leads if l.get("repetitionWarning")]
    assert warned, "expected at least one lead to carry a repetitionWarning"
    assert warned[0]["repetitionWarning"] == "avoid US-SE · avoid weather"

    # The avoid-note actually reached the prompt (threaded through, not dropped).
    sent_messages = acomplete_mock.await_args.kwargs["messages"]
    system_content = sent_messages[0]["content"]
    assert "avoid US-SE" in system_content or "avoid weather" in system_content


async def test_editorial_memory_read_empty_fallback() -> None:
    """SGE-05 / D-17: Convex unreachable => leads still emitted,
    `repetitionWarning` omitted — never crashes."""
    leads = [_make_lead() for _ in range(3)]
    output = SignalEditorOutput(leads=leads)

    p1, p2, p3, p4 = _patch_common(
        acomplete_return=(output, _USAGE),
        convex_query_safe_side_effect=RuntimeError("Convex unavailable"),
    )
    with p1, p2, p3, p4:
        result = await signal_editor(_state())

    story_leads = result["story_leads"]
    assert len(story_leads) == 3
    assert all(l.get("repetitionWarning") is None for l in story_leads)


async def test_repetition_read_logged(caplog: pytest.LogCaptureFixture) -> None:
    """SGE-05: the Editorial Memory read is logged with a count (verifiable in
    logs, mirrors the MEM-03/D-10 `caplog` pattern)."""
    leads = [_make_lead() for _ in range(3)]
    output = SignalEditorOutput(leads=leads)

    p1, p2, p3, p4 = _patch_common(
        acomplete_return=(output, _USAGE), convex_query_safe_return=None,
    )
    with caplog.at_level(
        logging.INFO, logger="eisenbalm_pipeline.agents.signal_editor"
    ):
        with p1, p2, p3, p4:
            await signal_editor(_state())

    matching = [
        rec for rec in caplog.records if "signal_editor: read" in rec.getMessage()
    ]
    assert matching, "expected a log record announcing the Editorial Memory read count"
    matched_text = matching[0].getMessage()
    assert "0" in matched_text or "no repetition" in matched_text
