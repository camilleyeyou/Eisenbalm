"""Phase 36 Plan 02 (§36.2) — Layer-1 axis passthrough RED->GREEN tests.

Asserts ``agents/qa/__init__.py::qa()`` no longer overwrites every Layer-1
finding's axis to ``"hard-rule"``. Each predicate's true axis (gravity /
sentiment / irony-signaling / precision) must survive into
``state['qa_corrections']`` AND the ``qaCorrections:insert`` mutation
payload written to Convex.

Research Pitfall 3: without this passthrough, the D-05 machine-tell
predicate (Plan 36-05) would be written as axis="hard-rule" and Voice
Pass's axis filter would never see it.

Judge (Layer 2) is stubbed to return an empty findings list so only
Layer-1 (deterministic predicate) findings are under test.
"""
from __future__ import annotations

import pytest

from eisenbalm_pipeline.agents.qa import qa

pytestmark = pytest.mark.anyio


def _state(**overrides) -> dict:
    base: dict = {
        "run_id": "run-abc",
        "origin_story": {"body": ""},
        "problem_statement": {"body": ""},
        "founder_bio": {"body": ""},
        "case_study": {"body": ""},
        "game": {},
        "bonus": {"body": ""},
        "research": {},
        "narrator": None,
        "config": None,
        "model_versions": {},
    }
    base.update(overrides)
    return base


async def _run_qa(monkeypatch, state: dict):
    """Run qa() with the Layer-2 judge stubbed to [] and Convex writes captured."""
    calls: list[tuple[str, dict]] = []

    async def _fake_mutation_safe(path, args):
        calls.append((path, args))

    async def _fake_judge(sections, *, run_id, narrator=None, rubric=None):
        return [], "stub-model"

    # Patch the names bound in the qa package's own namespace (module-level
    # `from ... import` bindings), NOT the origin modules.
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.qa.convex_mutation_safe", _fake_mutation_safe
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents._wrapper.convex_mutation_safe", _fake_mutation_safe
    )
    monkeypatch.setattr("eisenbalm_pipeline.agents.qa.run_llm_judge", _fake_judge)

    new_state = await qa(state)
    return new_state, calls


async def test_sentiment_finding_axis_passthrough(monkeypatch):
    """A sentiment-keyword hit surfaces with axis == 'sentiment', not 'hard-rule'."""
    state = _state(
        problem_statement={"body": "This is a truly heartwarming ending."}
    )
    new_state, _calls = await _run_qa(monkeypatch, state)

    corrections = new_state["qa_corrections"]
    sentiment_findings = [c for c in corrections if c["axis"] == "sentiment"]
    assert sentiment_findings, f"No sentiment-axis findings; corrections={corrections}"
    assert all(c["axis"] != "hard-rule" for c in corrections)


async def test_exclamation_finding_axis_gravity(monkeypatch):
    """An exclamation-mark hit surfaces with axis == 'gravity'."""
    state = _state(origin_story={"body": "Hello world!"})
    new_state, _calls = await _run_qa(monkeypatch, state)

    corrections = new_state["qa_corrections"]
    gravity_findings = [c for c in corrections if c["axis"] == "gravity"]
    assert gravity_findings, f"No gravity-axis findings; corrections={corrections}"
    assert all(c["axis"] != "hard-rule" for c in corrections)


async def test_unverified_name_axis_precision(monkeypatch):
    """check_unverified_name's finding surfaces with axis == 'precision'.

    Routes to Review Desk (factual), not Voice Pass — Pitfall 5 resolved.
    """
    research = {"founderName": "Jane Doe", "founderNameVerified": False}
    state = _state(
        founder_bio={"body": "Jane has led this work since 2003."},
        research=research,
    )
    new_state, _calls = await _run_qa(monkeypatch, state)

    corrections = new_state["qa_corrections"]
    precision_findings = [c for c in corrections if c["axis"] == "precision"]
    assert precision_findings, f"No precision-axis findings; corrections={corrections}"
    assert all(c["axis"] != "hard-rule" for c in corrections)


async def test_convex_insert_payload_axis_passthrough(monkeypatch):
    """The qaCorrections:insert mutation payload carries axis == f.axis (true axis)."""
    state = _state(origin_story={"body": "Hello world!"})
    _new_state, calls = await _run_qa(monkeypatch, state)

    insert_calls = [args for path, args in calls if path == "qaCorrections:insert"]
    assert insert_calls, "Expected at least one qaCorrections:insert call"
    assert all(c["axis"] != "hard-rule" for c in insert_calls)
    assert any(c["axis"] == "gravity" for c in insert_calls)
