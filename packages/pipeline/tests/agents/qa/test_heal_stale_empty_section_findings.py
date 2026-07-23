"""Unit tests — ``heal_stale_empty_section_findings`` (debug session
``stale-empty-section-qa-findings``, 2026-07-23, fix direction (b)).

Auto-dismisses an OPEN "{section} section is empty" qaCorrections finding
once the section is proven to have real content (heals both pre-fix runs'
already-inserted false findings and any future one-off LLM hallucination of
the same claim despite correct, non-empty input).
"""
from __future__ import annotations

from unittest.mock import AsyncMock

import eisenbalm_pipeline.agents.qa as _qa_mod
from eisenbalm_pipeline.agents.qa import heal_stale_empty_section_findings


def _finding(
    *,
    id_: str,
    section: str,
    reason: str,
    resolution=None,
) -> dict:
    return {
        "_id": id_,
        "sectionName": section,
        "reason": reason,
        "severity": "error",
        "resolution": resolution,
    }


async def test_dismisses_stale_empty_finding_when_section_now_has_content(monkeypatch):
    rows = [
        _finding(
            id_="finding-1",
            section="origin_story",
            reason=(
                "The origin_story section is empty. This is a required "
                "section and cannot be evaluated or published without content."
            ),
        ),
    ]
    monkeypatch.setattr(_qa_mod, "convex_query_safe", AsyncMock(return_value=rows))
    mutate = AsyncMock(return_value=None)
    monkeypatch.setattr(_qa_mod, "convex_mutation_safe", mutate)

    healed = await heal_stale_empty_section_findings(
        "run-1", {"origin_story": "Real, non-empty prose."},
    )

    assert healed == 1
    mutate.assert_awaited_once()
    path, payload = mutate.await_args.args
    assert path == "qaCorrections:setResolution"
    assert payload["id"] == "finding-1"
    assert payload["resolution"] == "dismissed"
    assert payload["resolvedBy"] == "pipeline-auto-heal"
    assert "resolutionReason" in payload


async def test_does_not_heal_when_section_is_genuinely_still_empty(monkeypatch):
    rows = [
        _finding(
            id_="finding-1",
            section="origin_story",
            reason="The origin_story section is empty. No content to evaluate.",
        ),
    ]
    monkeypatch.setattr(_qa_mod, "convex_query_safe", AsyncMock(return_value=rows))
    mutate = AsyncMock(return_value=None)
    monkeypatch.setattr(_qa_mod, "convex_mutation_safe", mutate)

    healed = await heal_stale_empty_section_findings("run-1", {"origin_story": ""})

    assert healed == 0
    mutate.assert_not_awaited()


async def test_skips_already_resolved_findings(monkeypatch):
    rows = [
        _finding(
            id_="finding-1",
            section="origin_story",
            reason="The origin_story section is empty. No content to evaluate.",
            resolution="dismissed",
        ),
    ]
    monkeypatch.setattr(_qa_mod, "convex_query_safe", AsyncMock(return_value=rows))
    mutate = AsyncMock(return_value=None)
    monkeypatch.setattr(_qa_mod, "convex_mutation_safe", mutate)

    healed = await heal_stale_empty_section_findings(
        "run-1", {"origin_story": "Real prose now."},
    )

    assert healed == 0
    mutate.assert_not_awaited()


async def test_never_touches_unrelated_findings(monkeypatch):
    """A real voice/precision finding on genuine content must never be
    auto-dismissed by this heal path — only the specific 'section is empty'
    self-contradiction is in scope."""
    rows = [
        _finding(
            id_="finding-1",
            section="bonus",
            reason="Vague hedge ('roughly') paired with an unattributed statistic.",
        ),
    ]
    monkeypatch.setattr(_qa_mod, "convex_query_safe", AsyncMock(return_value=rows))
    mutate = AsyncMock(return_value=None)
    monkeypatch.setattr(_qa_mod, "convex_mutation_safe", mutate)

    healed = await heal_stale_empty_section_findings(
        "run-1", {"bonus": "roughly 400 American children each year"},
    )

    assert healed == 0
    mutate.assert_not_awaited()


async def test_does_not_cross_contaminate_sections(monkeypatch):
    """A finding about section A being empty must not be healed by section
    B's content — the match is scoped to the finding's OWN sectionName."""
    rows = [
        _finding(
            id_="finding-1",
            section="problem",
            reason="The problem section is empty. No content to evaluate.",
        ),
    ]
    monkeypatch.setattr(_qa_mod, "convex_query_safe", AsyncMock(return_value=rows))
    mutate = AsyncMock(return_value=None)
    monkeypatch.setattr(_qa_mod, "convex_mutation_safe", mutate)

    healed = await heal_stale_empty_section_findings(
        "run-1",
        {"problem": "", "origin_story": "Unrelated section has content."},
    )

    assert healed == 0
    mutate.assert_not_awaited()


async def test_no_rows_is_a_no_op(monkeypatch):
    monkeypatch.setattr(_qa_mod, "convex_query_safe", AsyncMock(return_value=None))
    mutate = AsyncMock(return_value=None)
    monkeypatch.setattr(_qa_mod, "convex_mutation_safe", mutate)

    healed = await heal_stale_empty_section_findings("run-1", {"origin_story": "x"})

    assert healed == 0
    mutate.assert_not_awaited()


async def test_heals_multiple_findings_in_one_run(monkeypatch):
    rows = [
        _finding(
            id_="finding-1",
            section="origin_story",
            reason="The origin_story section is empty. No content to evaluate.",
        ),
        _finding(
            id_="finding-2",
            section="problem",
            reason="The problem section is empty. No content to evaluate.",
        ),
    ]
    monkeypatch.setattr(_qa_mod, "convex_query_safe", AsyncMock(return_value=rows))
    mutate = AsyncMock(return_value=None)
    monkeypatch.setattr(_qa_mod, "convex_mutation_safe", mutate)

    healed = await heal_stale_empty_section_findings(
        "run-1",
        {"origin_story": "Real prose.", "problem": "Real prose too."},
    )

    assert healed == 2
    assert mutate.await_count == 2
