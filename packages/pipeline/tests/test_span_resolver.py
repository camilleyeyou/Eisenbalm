"""Phase 33 (Plan 33-03 Task 1) — Python span-resolver parity tests.

Mirrors apps/dispatch-control/__tests__/spanResolver.test.ts case-for-case
so client (spanResolver.ts) and server (lib/span_resolver.py) resolution
always agree (docs/API_CONTRACTS.md §33.5). A finding the galley renders as
anchored must never 409 on accept, and vice versa.

Core invariants under test:
  - three stages IN ORDER (exact -> quote-normalized -> whitespace-tolerant),
    each searched block-by-block, NEVER against joined section text
  - offsets always index the ORIGINAL (un-normalized) block text
  - ambiguity (2+ matches, no usable blockIndexHint) -> None, NEVER a guess
  - an out-of-range / non-candidate hint is ignored, not authoritative
"""
from __future__ import annotations

import re

from eisenbalm_pipeline.lib.span_resolver import resolve_span


def _blocks(*texts: str) -> list[dict]:
    return [{"type": "paragraph", "text": t} for t in texts]


def _normalize(s: str) -> str:
    """Test-side helper mirroring the TS suite's `normalize` — curly->straight
    quotes + whitespace collapse. Only used to compare slices, never imported
    from the implementation."""
    s = s.replace("‘", "'").replace("’", "'")
    s = s.replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).strip()


# ── (a) exact single match ─────────────────────────────────────────────────


def test_exact_single_match_resolves_with_correct_offsets():
    blocks = _blocks("The facility opened its doors in 1974.")
    m = resolve_span(blocks, "opened its doors", None)
    assert m is not None
    assert m.block_index == 0
    assert blocks[0]["text"][m.start : m.end] == "opened its doors"


# ── (b) no match anywhere ──────────────────────────────────────────────────


def test_no_match_returns_none():
    blocks = _blocks("The facility opened its doors in 1974.")
    assert resolve_span(blocks, "a phrase that never appears", None) is None


# ── (c) ambiguity with no hint — never guess ───────────────────────────────


def test_duplicate_phrase_two_blocks_no_hint_is_unresolved():
    blocks = _blocks(
        "Rent at the aging facility tripled that year.",
        "Even so, the aging facility kept its doors open.",
    )
    # 2+ matches, no usable hint -> None (D-12: never guess).
    assert resolve_span(blocks, "the aging facility", None) is None


# ── (d) hint disambiguates ─────────────────────────────────────────────────


def test_hint_disambiguates_to_hinted_block():
    blocks = _blocks(
        "Rent at the aging facility tripled that year.",
        "Even so, the aging facility kept its doors open.",
    )
    m = resolve_span(blocks, "the aging facility", 1)
    assert m is not None
    assert m.block_index == 1
    assert blocks[1]["text"][m.start : m.end] == "the aging facility"


# ── (e) hint out of range is ignored ───────────────────────────────────────


def test_out_of_range_hint_ignored_unique_match_still_resolves():
    blocks = _blocks(
        "Founded quietly, with little fanfare.",
        "No press release accompanied the launch.",
        "The unique phrase appears only here.",
    )
    m = resolve_span(blocks, "The unique phrase appears only here.", 99)
    assert m is not None
    assert m.block_index == 2


# ── (f) hint naming a non-candidate block is ignored ───────────────────────


def test_hint_at_non_candidate_block_ignored_unique_match_resolves():
    blocks = _blocks(
        "Founded quietly, with little fanfare.",
        "No press release accompanied the launch.",
        "The unique phrase appears only here.",
    )
    m = resolve_span(blocks, "The unique phrase appears only here.", 0)
    assert m is not None
    assert m.block_index == 2


def test_hint_at_non_candidate_block_with_two_candidates_is_unresolved():
    # 2 candidate blocks, hint names a block that is NOT a candidate ->
    # ambiguous -> None (hint only wins when it names an ACTUAL candidate).
    blocks = _blocks(
        "Rent at the aging facility tripled that year.",
        "Even so, the aging facility kept its doors open.",
        "A third block with no matching phrase at all.",
    )
    assert resolve_span(blocks, "the aging facility", 2) is None


# ── (g) normalization — offsets index the ORIGINAL text ────────────────────


def test_curly_quotes_and_whitespace_resolve_offsets_index_original():
    # Block has straight quotes and a DOUBLE space between "hello" and "world".
    blocks = _blocks('She whispered "hello  world" and left.')
    # quotedSpan (as QA emitted it) has curly quotes and a SINGLE space.
    quoted = "“hello world”"
    m = resolve_span(blocks, quoted, None)
    assert m is not None
    assert m.block_index == 0
    raw_slice = blocks[0]["text"][m.start : m.end]
    assert _normalize(raw_slice) == _normalize(quoted)
    # The raw slice must be the actual original substring, not the
    # normalized string re-inserted in place of the original text.
    assert raw_slice == '"hello  world"'


def test_curly_quote_only_difference_resolves_via_quote_norm_stage():
    blocks = _blocks("The board said “we regret this” at the hearing.")
    m = resolve_span(blocks, '"we regret this"', None)
    assert m is not None
    assert m.block_index == 0
    raw_slice = blocks[0]["text"][m.start : m.end]
    assert raw_slice == "“we regret this”"


# ── (h) still ambiguous after normalization ────────────────────────────────


def test_still_ambiguous_after_normalization_is_unresolved():
    blocks = _blocks(
        "The board said “we regret this” at the hearing.",
        'Later, staff repeated: "we regret this" to the press.',
    )
    # Curly quotes + double space: only the whitespace-tolerant stage can
    # match, and it matches BOTH blocks -> ambiguous -> None.
    assert resolve_span(blocks, "“we  regret this”", None) is None


# ── (i) cross-block span never falsely resolves ────────────────────────────


def test_cross_block_span_never_resolves():
    blocks = _blocks(
        "The founder arrived at the shelter early",
        "every single morning without fail.",
    )
    # Only exists if blocks are joined with a space — must NOT match either
    # block alone (per-block search is a hard invariant, §33.5).
    assert resolve_span(blocks, "shelter early every single morning", None) is None


# ── guards ─────────────────────────────────────────────────────────────────


def test_empty_quoted_span_returns_none():
    blocks = _blocks("Some text.")
    assert resolve_span(blocks, "", None) is None


def test_empty_blocks_returns_none():
    assert resolve_span([], "anything", None) is None


def test_whitespace_tolerant_newline_in_block_resolves():
    blocks = _blocks("The grant covered\nthree full years of rent.")
    m = resolve_span(blocks, "covered three full years", None)
    assert m is not None
    raw_slice = blocks[0]["text"][m.start : m.end]
    assert raw_slice == "covered\nthree full years"
