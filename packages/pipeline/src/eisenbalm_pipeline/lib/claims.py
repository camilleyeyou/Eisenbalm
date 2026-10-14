"""Deterministic factual-claims extractor for Phase 26 RVW-05.

Extracts every number, date, and proper-noun sequence from issue sections
for the operator review sign-off checklist. No LLM calls — full recall is
the acceptance bar, and deterministic extraction guarantees it.

Phase 51.1: `extract_assertions_by_block` is the publisher's extractor (one row
per assertion sentence); the token-level functions below are retained for
back-compat only.

Usage (publisher node):
    from eisenbalm_pipeline.lib.claims import extract_claims
    claims = extract_claims(state_sections)

Usage (standalone / tests):
    from eisenbalm_pipeline.lib.claims import extract_all_claim_types, flatten_portable_text
    claims = extract_all_claim_types(portable_text_blocks)

Source: docs/API_CONTRACTS.md §26.2 + 26-RESEARCH.md Pattern 6.
"""
from __future__ import annotations

import re
import string
from typing import Any, Iterable


# ── Compiled regex patterns (verbatim from RESEARCH Pattern 6) ───────────────

RE_NUMBER = re.compile(
    r'\b(?:\$[\d,]+(?:\.\d+)?[BMK]?|\d[\d,]*(?:\.\d+)?%?(?:st|nd|rd|th)?)\b'
)

RE_DATE = re.compile(
    r'\b(?:19|20)\d{2}\b'
    r'|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?'
    r'|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
    r'\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b',
    re.IGNORECASE,
)

RE_PROPER_NOUN = re.compile(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b')


# Heading + blockquote block markers. Matches BOTH vocabularies used across
# the two extraction paths: nested Sanity Portable Text block `style`
# ('h1'..'h4', 'blockquote') and flat writer BodyBlock `type` ('h2', 'h3',
# 'blockquote' — see lib/portable_text.py compose_section_body). Blocks
# carrying one of these markers are section HEADLINES or pull-quotes, not
# body prose, and must never seed a factual claim (run 999605 regression).
_HEADING_BLOCKQUOTE = frozenset({"h1", "h2", "h3", "h4", "blockquote"})

# Section string-field keys that are titles/decorative copy, not factual
# content. Excluded from `_section_to_text` extraction. Other string fields
# (e.g. `subjectName`, `subjectRole`) are factual and must survive.
_HEADLINE_KEYS = frozenset(
    {
        "headline",
        "title",
        "subtitle",
        "subhead",
        "subheading",
        "sectiontitle",
        "kicker",
        "deck",
        "pullquote",
    }
)

# Person/org names are typically 2-5 words ("Jane Doe"=2, "The Riverside
# Community Trust"=4). A Title-Case run of 6+ words is a headline or
# multi-clause sentence fragment leaking past extraction, not a name — reject
# it wholesale rather than truncate it (RE_PROPER_NOUN stays greedy/unbounded
# so these runaway runs are matched in full, then dropped here).
_MAX_PROPER_NOUN_WORDS = 5


# ── Portable Text flattener ───────────────────────────────────────────────────


def _flatten_portable_text(blocks: Any, exclude_styles: frozenset[str] = frozenset()) -> str:
    """Extract plain text from Sanity Portable Text block array.

    Args:
        blocks: Either a str (pass-through) or a list of Portable Text block
                dicts. Each block dict may have a ``children`` list of spans,
                each span having a ``text`` key.
        exclude_styles: Block ``style`` values to skip entirely (e.g. heading
                or blockquote styles). Defaults to empty, so the public
                ``flatten_portable_text`` alias and its Wave 0 tests (which
                only exercise 'normal' blocks) are unaffected.

    Returns:
        Flat plain-text string. Multiple blocks joined with newlines.

    Notes:
        - Non-dict entries in the list are silently skipped (e.g., images).
        - Blocks without a ``children`` key emit an empty string for that block.
        - Pitfall 4 from RESEARCH: dict blocks must be flattened, not regexed
          directly.
    """
    if isinstance(blocks, str):
        return blocks
    if not isinstance(blocks, list):
        return ""
    parts: list[str] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        if exclude_styles and block.get("style") in exclude_styles:
            continue
        children = block.get("children")
        if not children or not isinstance(children, list):
            continue
        block_text = "".join(
            child.get("text", "") if isinstance(child, dict) else ""
            for child in children
        )
        parts.append(block_text)
    return "\n".join(parts)


# Public alias used by the Wave 0 test scaffold (no underscore prefix).
flatten_portable_text = _flatten_portable_text


# ── Per-type extractors ───────────────────────────────────────────────────────


def _word_bounded_context(text: str, start: int, end: int, radius: int = 40) -> str:
    """Build a ±radius-char context snippet, expanded to word boundaries.

    A fixed-width slice (the old ``text[start-30:end+30]``) frequently cuts a
    token in half at either edge (e.g. "Riverside" -> "side", "Justice" ->
    "Just"). This takes a ±radius window, then advances the start past the
    first whitespace (unless the window already starts at position 0) and
    retreats the end before the last whitespace (unless the window already
    reaches the end of ``text``), so neither edge cuts a word. The matched
    claim text itself is never truncated — only the surrounding context.
    """
    win_start = max(0, start - radius)
    win_end = min(len(text), end + radius)
    window = text[win_start:win_end]

    left_trim = 0
    if win_start > 0:
        # Advance past the first whitespace run so we don't start mid-word.
        ws = re.search(r"\s", window)
        if ws:
            left_trim = ws.end()

    right_trim = len(window)
    if win_end < len(text):
        # Retreat before the last whitespace run so we don't end mid-word.
        ws_matches = list(re.finditer(r"\s", window))
        if ws_matches:
            right_trim = ws_matches[-1].start()

    if left_trim > right_trim:
        # Degenerate case (radius too small to contain any whitespace) —
        # fall back to the raw window rather than an inverted slice.
        return window.strip()
    return window[left_trim:right_trim].strip()


def _extract_from_text(text: str, claim_type: str, regex: re.Pattern) -> list[dict]:
    """Run a single compiled regex against text; return raw (un-deduped) matches.

    Returns list of dicts: {text, claimType, context}. claimIndex is assigned
    later by the dedup pass in extract_claims / extract_all_claim_types.

    proper_noun matches longer than ``_MAX_PROPER_NOUN_WORDS`` words are
    skipped entirely — a runaway Title-Case run (headline/pull-quote
    sentence) is rejected wholesale, not truncated into a shorter fragment.
    """
    results: list[dict] = []
    for m in regex.finditer(text):
        matched_text = m.group(0)
        if claim_type == "proper_noun" and len(matched_text.split()) > _MAX_PROPER_NOUN_WORDS:
            continue
        start, end = m.start(), m.end()
        context = _word_bounded_context(text, start, end)
        results.append(
            {
                "text": matched_text,
                "claimType": claim_type,
                "context": context,
            }
        )
    return results


# ── Normalisation helpers ─────────────────────────────────────────────────────


def _normalise(text: str) -> str:
    """Case-fold + strip surrounding punctuation for dedup comparison."""
    return text.lower().strip(string.punctuation + " ")


# ── Core extraction over a flat text string ───────────────────────────────────


def _deoverlap_proper_nouns(claims: list[dict]) -> list[dict]:
    """Drop a proper_noun claim whose normalised text is a whole-word
    substring of a longer surviving proper_noun claim's normalised text.

    Only proper_noun claims are compared; number/date claims (and their
    relative order, and DATE-before-NUMBER typing) are untouched. Uses a
    word-boundary containment check (padding both sides with a space) so
    e.g. "Trust" is not treated as contained in "Trustees". Preserves
    first-occurrence order of survivors.
    """
    proper_indices = [i for i, c in enumerate(claims) if c["claimType"] == "proper_noun"]
    normalised = {i: _normalise(claims[i]["text"]) for i in proper_indices}

    drop: set[int] = set()
    for i in proper_indices:
        short = normalised[i]
        for j in proper_indices:
            if i == j or len(normalised[j]) <= len(short):
                continue
            long = normalised[j]
            if f" {short} " in f" {long} ":
                drop.add(i)
                break
    return [c for idx, c in enumerate(claims) if idx not in drop]


def _extract_and_dedup(text: str) -> list[dict]:
    """Run all three extractors against a flat string; return deduped claims.

    Run DATE before NUMBER so a bare four-digit year is typed "date" not
    "number". Deduplicate on normalised text (first occurrence wins), then
    collapse overlapping proper_noun fragments down to the longest survivor.
    Returns list without claimIndex — caller assigns ordinals.
    """
    raw: list[dict] = []
    # Date first (prevents bare year matching as a number)
    raw.extend(_extract_from_text(text, "date", RE_DATE))
    raw.extend(_extract_from_text(text, "number", RE_NUMBER))
    raw.extend(_extract_from_text(text, "proper_noun", RE_PROPER_NOUN))

    seen: set[str] = set()
    deduped: list[dict] = []
    for item in raw:
        key = _normalise(item["text"])
        if key not in seen:
            seen.add(key)
            deduped.append(item)
    return _deoverlap_proper_nouns(deduped)


# ── Public API: extract_all_claim_types (portable-text-input variant) ─────────


def extract_all_claim_types(blocks: Any) -> list[dict]:
    """Extract claims from a Portable Text block list (Wave 0 test interface).

    This is the per-section variant that accepts a Portable Text block list
    directly (as used by the Wave 0 test scaffold in test_claims_extractor.py).

    Args:
        blocks: A Sanity Portable Text block list or a plain string.

    Returns:
        Flat ordered list of ``{claimIndex, text, claimType, context}`` dicts.
        ``claimIndex`` is the 0-based ordinal of first appearance after dedup.
        An empty input returns ``[]``.
    """
    text = _flatten_portable_text(blocks, exclude_styles=_HEADING_BLOCKQUOTE)
    if not text.strip():
        return []
    claims = _extract_and_dedup(text)
    return [
        {
            "claimIndex": idx,
            "text": c["text"],
            "claimType": c["claimType"],
            "context": c["context"],
        }
        for idx, c in enumerate(claims)
    ]


# ── Section-value text extractor ──────────────────────────────────────────────


def _section_to_text(value: Any) -> str:
    """Extract plain text from a DispatchState section value.

    Section values are dicts that may have a ``body`` (Portable Text list)
    and/or string fields. Plain str values pass through. Headline/title-type
    string fields (``_HEADLINE_KEYS``) are excluded — they're decorative
    copy, not factual content; other string fields (e.g. ``subjectName``,
    ``subjectRole``) are factual and still extracted.
    """
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        # Treat bare list as Portable Text blocks
        return _flatten_portable_text(value, exclude_styles=_HEADING_BLOCKQUOTE)
    if isinstance(value, dict):
        parts: list[str] = []
        # body is Portable Text blocks
        body = value.get("body")
        if body is not None:
            parts.append(_flatten_portable_text(body, exclude_styles=_HEADING_BLOCKQUOTE))
        # String fields (subjectName, subjectRole, etc.) — headline/title
        # keys excluded. Joined with ". " (not "\n") so two adjacent
        # Title-Case field values (e.g. subjectName + subjectRole) can never
        # bleed into one accidental cross-field proper_noun match — "\n" is
        # whitespace to RE_PROPER_NOUN's `\s+`, a period is not.
        field_texts: list[str] = [
            v
            for key, v in value.items()
            if key.lower() not in _HEADLINE_KEYS and isinstance(v, str) and v
        ]
        if field_texts:
            parts.append(". ".join(field_texts))
        return "\n".join(p for p in parts if p)
    return ""


# ── Public API: extract_claims (publisher-node variant) ───────────────────────

# Canonical section order for deterministic extraction.
_SECTION_ORDER = (
    "origin_story",
    "problem_statement",
    "founder_bio",
    "case_study",
    "bonus",
)


# ── Public API: block_index_hint (Phase 35 PRV-02/PRV-04) ────────────────────


def block_index_hint(blocks: Any, as_written: str | None) -> int | None:
    """Return the 0-based index of the first flat BodyBlock containing
    ``as_written`` (case-insensitive substring), else ``None``.

    Research Pitfall 1: at publish time ``state[section]["body"]`` is the
    RAW ``BodyBlock.model_dump()`` output — a flat list of
    ``{"type": ..., "text": ...}`` dicts. This is NOT the same shape as
    Sanity Portable Text's nested-span-list block shape, which is what
    ``agents/qa/__init__.py::_block_index_hint`` reads. Reading the nested
    key against this flat shape would never match (the key is absent here)
    — this helper reads ``text`` DIRECTLY instead, and must never be
    "corrected" to read the nested-span-list shape.

    Unlike the QA helper's D-12 "never guess" ambiguous-match-returns-None
    rule (which is resolving an UNKNOWN quoted span against a whole
    section), this helper is always called with a writer-declared
    ``asWritten`` span that already names one physical location — the
    first match is the correct, deterministic answer, not a guess.
    """
    if not as_written:
        return None
    needle = as_written.strip().lower()
    if not needle:
        return None
    if not isinstance(blocks, list):
        return None
    for i, block in enumerate(blocks):
        if not isinstance(block, dict):
            continue
        text = block.get("text", "")
        if not isinstance(text, str):
            continue
        if needle in text.lower():
            return i
    return None


# ── Public API: extract_claims_by_block (Phase 35 PRV-02/PRV-04) ─────────────

# Internal DispatchState section key -> galley sectionName vocabulary the
# frontend uses (matches the publisher's writer claimSpans sectionName and
# the Phase 32/33 qaCorrections precedent).
_SECTION_TO_GALLEY_ID = {
    "origin_story": "originStory",
    "problem_statement": "problemStatement",
    "founder_bio": "founderBio",
    "case_study": "caseStudy",
    "bonus": "bonus",
}


def extract_claims_by_block(sections: dict) -> list[dict]:
    """Per-section, per-block deterministic claims extraction (D-13).

    Restructures extraction from Phase 26/33's globally-joined-then-dedup
    behavior (``extract_claims``, unchanged, kept for back-compat) to run
    the three regexes independently against EACH block's own text, so every
    returned row owns a resolvable (sectionName, blockIndexHint) anchor for
    the galley + decision-rail jump links. Dedup happens WITHIN a block
    only — the same fact repeated across two blocks (or two sections)
    yields two independent rows, by design (one-row-per-occurrence).

    Does NOT assign ``claimIndex`` — the publisher assigns a single global
    ordinal after merging sourced + unsourced rows (§35.5).

    Args:
        sections: Dict keyed by internal section name (``origin_story``,
                  ``problem_statement``, ``founder_bio``, ``case_study``,
                  ``bonus``) with DispatchState section values (each a dict
                  with a ``body`` list of flat ``{"type","text"}`` blocks).
                  Keys not in the canonical order, or values without a list
                  ``body``, are skipped.

    Returns:
        Flat list of ``{sectionName, blockIndexHint, text, claimType,
        context}`` dicts, in canonical section order then block order.
    """
    rows: list[dict] = []
    for key in _SECTION_ORDER:
        value = sections.get(key)
        if not isinstance(value, dict):
            continue
        body = value.get("body")
        if not isinstance(body, list):
            continue
        galley_id = _SECTION_TO_GALLEY_ID[key]
        for bi, block in enumerate(body):
            if not isinstance(block, dict):
                continue
            if block.get("type") in _HEADING_BLOCKQUOTE:
                # Heading/blockquote body blocks are section HEADLINES or
                # pull-quotes, not factual prose — skip entirely (run 999605
                # regression: h2/h3/blockquote leakage into claims).
                continue
            text = block.get("text", "")
            if not isinstance(text, str) or not text.strip():
                continue
            claims = _extract_and_dedup(text)
            for c in claims:
                rows.append(
                    {
                        "sectionName": galley_id,
                        "blockIndexHint": bi,
                        "text": c["text"],
                        "claimType": c["claimType"],
                        "context": c["context"],
                    }
                )
    return rows


# ── Public API: extract_assertions_by_block (Phase 51.1 VRD-02, API_CONTRACTS §51.1.5) ──

_ABBREVIATIONS = frozenset({
    "mr", "mrs", "ms", "dr", "st", "jr", "sr", "inc", "ltd", "co", "no", "vs",
    "etc", "e.g", "i.e", "u.s", "mt", "ft", "prof", "gov", "sen", "rep",
})
_SENTENCE_END = re.compile(r'[.!?]["\'\u201d\u2019)]*(?=\s+|$)')
_MIN_ASSERTION_WORDS = 4
_MIN_FREE_ALPHA_WORDS = 2
_ASSERTION_CONTEXT_CHARS = 300
_ALPHA_WORD = re.compile(r"^[A-Za-z][A-Za-z'\u2019-]*$")


def split_sentences(text: str) -> list[str]:
    """Split text into sentences; each result is an exact substring of text.

    Does not split after known abbreviations ("Dr.") or single-letter initials.
    Decimals ("2.3") never split since a terminator needs trailing whitespace.
    """
    sentences: list[str] = []
    seg_start = 0
    for m in _SENTENCE_END.finditer(text):
        tok = re.search(r"(\S+)$", text[seg_start:m.start()])
        if tok:
            word = tok.group(1).lower().rstrip(".")
            if m.group(0)[0] == "." and (word in _ABBREVIATIONS or len(word.strip("\"'(")) == 1):
                continue
        sentence = text[seg_start:m.end()].strip()
        if sentence:
            sentences.append(sentence)
        seg_start = m.end()
    tail = text[seg_start:].strip()
    if tail:
        sentences.append(tail)
    return sentences


def _assertion_matches(sentence: str) -> list[tuple[int, int, str]]:
    found: list[tuple[int, int, str]] = []
    dates = [(m.start(), m.end(), "date") for m in RE_DATE.finditer(sentence)]
    found.extend(dates)
    for m in RE_NUMBER.finditer(sentence):
        if any(d[0] <= m.start() and m.end() <= d[1] for d in dates):
            continue
        found.append((m.start(), m.end(), "number"))
    for m in RE_PROPER_NOUN.finditer(sentence):
        if len(m.group(0).split()) > _MAX_PROPER_NOUN_WORDS:
            continue
        found.append((m.start(), m.end(), "proper_noun"))
    order = {"date": 0, "number": 1, "proper_noun": 2}
    found.sort(key=lambda t: (t[0], order[t[2]]))
    return found


def extract_assertions_by_block(sections: dict, known_entities: Iterable[str] = ()) -> list[dict]:
    """One row per assertion sentence (a sentence with >=1 number/date/proper noun).

    ``text`` is an exact substring of the block, so the galley's
    ``resolveSectionFindings`` resolves it. Rows carry no ``claimIndex`` (the
    publisher assigns it). Writer-claimSpan containment is applied by the
    publisher, not here. Dedupe is within a block only. No LLM calls.
    """
    known = {_normalise(e) for e in known_entities if e and _normalise(e)}
    rows: list[dict] = []
    for key in _SECTION_ORDER:
        value = sections.get(key)
        if not isinstance(value, dict):
            continue
        body = value.get("body")
        if not isinstance(body, list):
            continue
        galley_id = _SECTION_TO_GALLEY_ID[key]
        for bi, block in enumerate(body):
            if not isinstance(block, dict) or block.get("type") in _HEADING_BLOCKQUOTE:
                continue
            text = block.get("text", "")
            if not isinstance(text, str) or not text.strip():
                continue
            seen: set[str] = set()
            for sentence in split_sentences(text):
                matches = _assertion_matches(sentence)
                if not matches:
                    continue
                if len(sentence.split()) < _MIN_ASSERTION_WORDS:
                    continue
                chars = list(sentence)
                for st, en, _t in matches:
                    for i in range(st, en):
                        chars[i] = " "
                free = [
                    w for w in "".join(chars).split()
                    if _ALPHA_WORD.match(w.strip(string.punctuation))
                ]
                if len(free) < _MIN_FREE_ALPHA_WORDS:
                    continue
                if known and all(t == "proper_noun" for _s, _e, t in matches):
                    def _is_entity(span: tuple[int, int, str]) -> bool:
                        n = f" {_normalise(sentence[span[0]:span[1]])} "
                        return any(n == f" {k} " or f" {k} " in n or n in f" {k} " for k in known)
                    if all(_is_entity(m) for m in matches):
                        continue
                nkey = _normalise(sentence)
                if nkey in seen:
                    continue
                seen.add(nkey)
                rows.append(
                    {
                        "sectionName": galley_id,
                        "blockIndexHint": bi,
                        "text": sentence,
                        "claimType": matches[0][2],
                        "context": sentence[:_ASSERTION_CONTEXT_CHARS],
                    }
                )
    return rows


def extract_claims(sections: dict) -> list[dict]:
    """Extract claims from DispatchState section dict at pipeline run-end.

    Iterates sections in a fixed canonical order so claimIndex values are
    stable across re-runs on the same content.

    Args:
        sections: Dict keyed by section name with DispatchState values
                  (each may be a dict with ``body`` Portable Text + string
                  headlines, a plain str, or a list of Portable Text blocks).
                  Keys not in the canonical order are ignored.

    Returns:
        Flat ordered list of ``{claimIndex, text, claimType, context}`` dicts.
        ``claimIndex`` is the 0-based ordinal of first appearance (globally,
        across all sections). De-duplication is case-folded + punctuation-stripped.
    """
    combined_parts: list[str] = []
    for key in _SECTION_ORDER:
        value = sections.get(key)
        text = _section_to_text(value)
        if text.strip():
            combined_parts.append(text)

    combined_text = "\n".join(combined_parts)
    if not combined_text.strip():
        return []

    claims = _extract_and_dedup(combined_text)
    return [
        {
            "claimIndex": idx,
            "text": c["text"],
            "claimType": c["claimType"],
            "context": c["context"],
        }
        for idx, c in enumerate(claims)
    ]
