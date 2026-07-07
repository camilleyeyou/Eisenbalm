"""Phase 32 (GLY-02, D-11) — QA blockIndexHint unit tests.

_block_index_hint computes the ordinal of the ONE block whose text contains
the finding's quotedSpan, mirroring the client resolver's unique-substring
rule (D-12: never guess). Covers: unique match, no match, ambiguous match,
unknown/game section, and empty quotedSpan.
"""
from __future__ import annotations

from eisenbalm_pipeline.agents.qa import _block_index_hint


def _block(text: str) -> dict:
    return {"children": [{"text": text}]}


def test_unique_match_returns_index() -> None:
    state = {
        "origin_story": {
            "body": [
                _block("The founder began in obscurity."),
                _block("A quiet act of charity changed everything."),
                _block("The mission grew from there."),
            ]
        }
    }
    hint = _block_index_hint(state, "origin_story", "quiet act of charity")
    assert hint == 1


def test_no_match_returns_none() -> None:
    state = {
        "origin_story": {
            "body": [
                _block("The founder began in obscurity."),
                _block("The mission grew from there."),
            ]
        }
    }
    assert _block_index_hint(state, "origin_story", "nonexistent phrase") is None


def test_ambiguous_match_returns_none() -> None:
    state = {
        "problem_statement": {
            "body": [
                _block("The crisis is dire and growing worse."),
                _block("Indeed, the crisis is dire and growing worse."),
            ]
        }
    }
    hint = _block_index_hint(state, "problem", "crisis is dire and growing worse")
    assert hint is None


def test_game_section_returns_none() -> None:
    state = {"game": {"description": "irrelevant"}}
    assert _block_index_hint(state, "game", "irrelevant") is None


def test_unknown_section_returns_none() -> None:
    state = {}
    assert _block_index_hint(state, "not_a_real_section", "quoted") is None


def test_empty_quoted_span_returns_none() -> None:
    state = {
        "origin_story": {"body": [_block("Some text.")]},
    }
    assert _block_index_hint(state, "origin_story", "") is None
    assert _block_index_hint(state, "origin_story", None) is None
