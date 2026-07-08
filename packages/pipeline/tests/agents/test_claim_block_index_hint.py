"""Phase 35 (PRV-02/PRV-04) — lib.claims.block_index_hint unit tests.

Corrected flat-shape sibling to the buggy qa/__init__.py::_block_index_hint
(which reads a nested list of spans under each block — the WRONG shape at
publish time). At publish time state[section]["body"] is BodyBlock's
model_dump() output: flat {"type": ..., "text": ...} dicts. This helper
reads "text" directly — never a nested per-block span list (Research
Pitfall 1). Fixtures here use ONLY the flat shape.
"""
from __future__ import annotations

from eisenbalm_pipeline.lib.claims import block_index_hint


def _block(block_type: str, text: str) -> dict:
    return {"type": block_type, "text": text}


def test_flat_shape_returns_matching_block_index() -> None:
    blocks = [
        _block("paragraph", "A $2.3M budget."),
        _block("paragraph", "Founded 1998."),
    ]
    assert block_index_hint(blocks, "Founded 1998") == 1


def test_no_match_returns_none() -> None:
    blocks = [_block("paragraph", "The founder began in obscurity.")]
    assert block_index_hint(blocks, "nonexistent phrase") is None


def test_case_insensitive_substring_match() -> None:
    blocks = [_block("paragraph", "The Mission Grew from there.")]
    assert block_index_hint(blocks, "mission grew") == 0


def test_empty_as_written_returns_none() -> None:
    blocks = [_block("paragraph", "Some text.")]
    assert block_index_hint(blocks, "") is None
    assert block_index_hint(blocks, None) is None  # type: ignore[arg-type]


def test_empty_blocks_returns_none() -> None:
    assert block_index_hint([], "anything") is None


def test_first_match_wins_when_multiple_blocks_contain_text() -> None:
    """Unlike qa's ambiguous-match-returns-None rule (D-12 "never guess"
    across an UNKNOWN quoted span), this per-occurrence helper is always
    called with a per-span ``as_written`` string a writer already anchored
    to one physical location — first match is the correct, deterministic
    choice here, not a guess."""
    blocks = [
        _block("paragraph", "The crisis is dire and growing worse."),
        _block("paragraph", "Indeed, the crisis is dire and growing worse."),
    ]
    assert block_index_hint(blocks, "crisis is dire") == 0


def test_non_dict_blocks_are_skipped() -> None:
    blocks = ["not-a-dict", _block("paragraph", "Founded 1998.")]
    assert block_index_hint(blocks, "Founded 1998") == 1
