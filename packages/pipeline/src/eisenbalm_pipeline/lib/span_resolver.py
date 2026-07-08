"""Server-side quotedSpan resolution (Phase 33, docs/API_CONTRACTS.md §33.5).

A 1:1 Python port of ``apps/dispatch-control/lib/galley/spanResolver.ts`` so
client and server resolution always agree — a finding the galley renders as
anchored must not 409 on accept, and vice versa.

Anchors a QA finding's ``quotedSpan`` onto exact character offsets within a
SINGLE draft block's text — NEVER the whole section's concatenated text (a
cross-block "match" is not a real match). Three stages, tried in order,
each searched block-by-block:

  1. Exact:                ``block["text"].find(quoted)``
  2. Quote-normalized:     curly ``‘’“”`` -> straight ``'"`` on BOTH sides —
                           a 1:1, length-preserving char swap, so offsets
                           computed on normalized text index the ORIGINAL
                           text directly.
  3. Whitespace-tolerant:  ``re.escape`` the quote-normalized span with every
                           whitespace run collapsed to a ``\\s+`` pattern,
                           matched via ``re.finditer`` over the
                           quote-normalized block text; the match's own
                           ``start()``/``end()`` index the original text.

Disambiguation (identical to the TS ``disambiguate``): 0 matches -> next
stage; exactly 1 -> winner; 2+ -> ``block_index_hint`` wins ONLY if it names
an actual candidate block, otherwise ambiguous = unresolved (``None``).

**Never guess** (D-12/D-05): a wrong anchor is worse than an honest miss —
ambiguity of any kind resolves to ``None``, which the accept endpoint maps
to 409 ``span_not_resolved``.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional, Union


@dataclass(frozen=True)
class Match:
    """A resolved span: offsets index blocks[block_index]["text"] directly."""

    block_index: int
    start: int
    end: int


# Sentinel distinguishing "2+ matches, unresolvable" (stop — unresolved)
# from "0 matches" (None — fall through to the next stage).
_AMBIGUOUS = object()

_CURLY_SINGLE = re.compile(r"[‘’]")
_CURLY_DOUBLE = re.compile(r"[“”]")


def _norm_quotes(s: str) -> str:
    """Curly -> straight quote substitution ONLY — a 1:1 char swap, so it
    never changes string length. Offsets computed against the normalized
    string therefore map directly onto the ORIGINAL (un-normalized) string."""
    return _CURLY_DOUBLE.sub('"', _CURLY_SINGLE.sub("'", s))


def _exact_matches(blocks: list[dict], quoted: str) -> list[Match]:
    out: list[Match] = []
    for i, block in enumerate(blocks):
        idx = block.get("text", "").find(quoted)
        if idx >= 0:
            out.append(Match(block_index=i, start=idx, end=idx + len(quoted)))
    return out


def _quote_normalized_matches(blocks: list[dict], quoted: str) -> list[Match]:
    """Stage 2: quote-substitution normalization (length-preserving). Still
    requires an exact substring match after normalizing both sides."""
    normalized_quoted = _norm_quotes(quoted)
    out: list[Match] = []
    for i, block in enumerate(blocks):
        idx = _norm_quotes(block.get("text", "")).find(normalized_quoted)
        if idx >= 0:
            out.append(Match(block_index=i, start=idx, end=idx + len(quoted)))
    return out


def _whitespace_tolerant_matches(blocks: list[dict], quoted: str) -> list[Match]:
    """Stage 3: whitespace-tolerant regex over the quote-normalized text.
    Quote substitution never changes length, so ``m.start()``/``m.end()``
    index the ORIGINAL block text directly — never a normalized string.
    The matched run in the TEXT may differ in length from ``quoted``.

    NOTE: unlike the TS ``escapeRegExp``, Python's ``re.escape`` ALSO escapes
    whitespace chars (``' ' -> '\\ '``), so a naive
    ``re.sub(r"\\s+", ..., re.escape(s))`` would leave orphaned backslashes.
    Split on whitespace runs FIRST, escape each part, then join with
    ``\\s+`` — semantically identical to the TS pattern build."""
    normalized_quoted = _norm_quotes(quoted)
    pattern = r"\s+".join(
        re.escape(part) for part in re.split(r"\s+", normalized_quoted)
    )
    out: list[Match] = []
    for i, block in enumerate(blocks):
        normalized_text = _norm_quotes(block.get("text", ""))
        for m in re.finditer(pattern, normalized_text):
            out.append(Match(block_index=i, start=m.start(), end=m.end()))
    return out


def _disambiguate(
    matches: list[Match],
    block_index_hint: Optional[int],
    block_count: int,
) -> Union[Match, None, object]:
    """Resolve candidates to a single winner, or signal ambiguity.

    Never guesses: a hint only disambiguates when it names a block that is
    ACTUALLY one of the candidates; an invalid/stale/non-matching hint is
    ignored entirely (-> ambiguous -> unresolved at the caller).

    Returns:
        None       — 0 matches (caller falls through to the next stage)
        Match      — exactly one winner
        _AMBIGUOUS — 2+ matches with no usable hint (caller stops: unresolved)
    """
    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]
    if (
        isinstance(block_index_hint, int)
        and not isinstance(block_index_hint, bool)
        and 0 <= block_index_hint < block_count
    ):
        for m in matches:
            if m.block_index == block_index_hint:
                return m
    return _AMBIGUOUS


def resolve_span(
    blocks: list[dict],
    quoted: str,
    block_index_hint: Optional[int] = None,
) -> Optional[Match]:
    """Resolve ``quoted`` against a section's draft blocks ({type,text}[]).

    Searches one block at a time — never against the blocks joined together.
    Returns a :class:`Match` whose offsets index the ORIGINAL block text, or
    ``None`` when the span is missing OR ambiguous (never a guess).
    """
    if not quoted or not blocks:
        return None

    candidate = _disambiguate(
        _exact_matches(blocks, quoted), block_index_hint, len(blocks)
    )
    if candidate is None:
        candidate = _disambiguate(
            _quote_normalized_matches(blocks, quoted), block_index_hint, len(blocks)
        )
    if candidate is None:
        candidate = _disambiguate(
            _whitespace_tolerant_matches(blocks, quoted),
            block_index_hint,
            len(blocks),
        )

    if candidate is None or candidate is _AMBIGUOUS:
        return None
    return candidate
