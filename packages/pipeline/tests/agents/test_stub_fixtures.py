"""Stub fixture TypedDict-shape validation (PIP-04).

Parametrized over the 15 fixture functions in stubs/fixtures.py. Each fixture
returns the partial DispatchState update its agent owns; this test asserts:

  - the returned object is a dict
  - its top-level keys exactly match the expected set
  - every returned key belongs to the canonical DispatchState (API_CONTRACTS §7)

Plus deeper structural checks on the two fixtures with format contracts:
  - design_output: 4 hex fields match ^#[0-9A-Fa-f]{6}$, both font names non-empty
  - game_output:   embedCode is self-contained — no <script src=, no external URLs

These tests have ZERO external dependencies (no Sanity / Convex / Supabase) —
they run green in every environment, including unprovisioned ones.

The 14-agent sequence (editor runs twice — gate 1 + final) is covered by 15
fixture functions: calibrator, scout, advocate, editor_gate_1, researcher,
origin_story, problem, founder_bio, case_study, game, bonus, design, qa,
editor_final, publisher.

Source: 04-CONTEXT.md D-16, 04-VALIDATION.md, docs/API_CONTRACTS.md §7.
"""
from __future__ import annotations

import re
from typing import Callable

import pytest

from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.stubs import fixtures


DISPATCH_STATE_FIELDS = set(DispatchState.__annotations__.keys())

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


@pytest.fixture(scope="module")
def candidates_for_advocate() -> list[dict]:
    """Scout's 3 raw candidates — the input advocate_scored consumes."""
    return fixtures.scout_candidates()["candidates"]


# Each entry: (id, callable returning the fixture dict, expected top-level keys).
# advocate_scored takes input candidates, so it gets its own dedicated test.
FIXTURE_CASES: list[tuple[str, Callable[[], dict], set[str]]] = [
    ("calibrator", lambda: fixtures.calibrator_output(), {"style_brief"}),
    ("scout", lambda: fixtures.scout_candidates(), {"candidates"}),
    (
        "editor_gate_1",
        lambda: fixtures.editor_decision_output("The Quiet Foundation"),
        {"editor_decision", "runner_up_notes", "deliberation_transcript"},
    ),
    ("researcher", lambda: fixtures.research_output(), {"research"}),
    ("origin_story", lambda: fixtures.origin_story_output(), {"origin_story"}),
    (
        "problem",
        lambda: fixtures.problem_output(),
        {"problem_statement", "problem_pdf_content"},
    ),
    ("founder_bio", lambda: fixtures.founder_bio_output(), {"founder_bio"}),
    ("case_study", lambda: fixtures.case_study_output(), {"case_study"}),
    ("game", lambda: fixtures.game_output(), {"game"}),
    ("bonus", lambda: fixtures.bonus_output(), {"bonus"}),
    ("design", lambda: fixtures.design_output(), {"theme"}),
    ("qa", lambda: fixtures.qa_output(), {"qa_corrections"}),
    (
        "editor_final",
        lambda: fixtures.editor_final_output(),
        {"editor_final_notes"},
    ),
    ("publisher", lambda: fixtures.publisher_output(), {"sanity_issue_id"}),
]


@pytest.mark.parametrize(
    "fixture_name,fixture_call,expected_keys",
    FIXTURE_CASES,
    ids=[name for name, _, _ in FIXTURE_CASES],
)
def test_stub_fixture_returns_valid_dispatch_state_shape(
    fixture_name: str, fixture_call: Callable[[], dict], expected_keys: set[str]
) -> None:
    """PIP-04: fixture's returned dict has exactly the expected DispatchState keys."""
    result = fixture_call()
    assert isinstance(result, dict), (
        f"{fixture_name} should return a dict; got {type(result)}"
    )
    actual_keys = set(result.keys())
    assert actual_keys == expected_keys, (
        f"{fixture_name} keys mismatch: expected {expected_keys}, got {actual_keys}"
    )
    # Every returned key must belong to the canonical DispatchState (locked
    # contract — CLAUDE.md: field names are locked across schemas + contracts).
    unknown = actual_keys - DISPATCH_STATE_FIELDS
    assert not unknown, (
        f"{fixture_name} returned non-DispatchState keys: {unknown}"
    )


def test_advocate_scored_shape(candidates_for_advocate: list[dict]) -> None:
    """PIP-04: advocate_scored consumes candidates and returns a scored list."""
    result = fixtures.advocate_scored(candidates_for_advocate)
    assert set(result.keys()) == {"candidates"}
    assert "candidates" in DISPATCH_STATE_FIELDS
    scored = result["candidates"]
    assert len(scored) == len(candidates_for_advocate)
    for c in scored:
        assert isinstance(c.get("advocateScore"), int), (
            f"advocateScore must be int; got {c.get('advocateScore')!r}"
        )
        assert 1 <= c["advocateScore"] <= 10, (
            f"advocateScore out of 1-10 range: {c['advocateScore']}"
        )
        assert isinstance(c.get("advocateArgument"), str) and c["advocateArgument"], (
            "advocateArgument must be a non-empty string"
        )


def test_design_output_hex_and_fonts() -> None:
    """PIP-04: design_output theme has 6-digit hex colors + non-empty font names."""
    theme = fixtures.design_output()["theme"]
    for field in ("primaryColor", "accentColor", "backgroundColor", "textColor"):
        value = theme[field]
        assert HEX_RE.match(value), (
            f"theme.{field} must match ^#[0-9A-Fa-f]{{6}}$; got {value!r}"
        )
    for field in ("fontDisplay", "fontBody"):
        value = theme[field]
        assert isinstance(value, str) and value.strip(), (
            f"theme.{field} must be a non-empty string; got {value!r}"
        )


def test_game_output_embed_is_self_contained() -> None:
    """PIP-04: game_output embedCode is self-contained — no external script/URLs.

    Phase 7's GameWriter validator will harden this, but the Phase 4 stub must
    already be clean: the embed renders inside `iframe srcdoc sandbox` so any
    external resource reference is a contract violation from day one.
    """
    embed = fixtures.game_output()["game"]["embedCode"]
    assert isinstance(embed, str) and embed, "embedCode must be a non-empty string"
    lowered = embed.lower()
    assert "<script src=" not in lowered, (
        "embedCode must not load external scripts"
    )
    assert "http://" not in lowered and "https://" not in lowered, (
        "embedCode must not reference external URLs"
    )
