"""Deterministic factual-claims extractor for Phase 26 RVW-05.

Extracts every number, date, and proper-noun sequence from issue sections
for the operator review sign-off checklist. No LLM calls — full recall is
the acceptance bar, and deterministic extraction guarantees it.

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
from typing import Any


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


# ── Portable Text flattener ───────────────────────────────────────────────────


def _flatten_portable_text(blocks: Any) -> str:
    """Extract plain text from Sanity Portable Text block array.

    Args:
        blocks: Either a str (pass-through) or a list of Portable Text block
                dicts. Each block dict may have a ``children`` list of spans,
                each span having a ``text`` key.

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


def _extract_from_text(text: str, claim_type: str, regex: re.Pattern) -> list[dict]:
    """Run a single compiled regex against text; return raw (un-deduped) matches.

    Returns list of dicts: {text, claimType, context}. claimIndex is assigned
    later by the dedup pass in extract_claims / extract_all_claim_types.
    """
    results: list[dict] = []
    for m in regex.finditer(text):
        start, end = m.start(), m.end()
        context = text[max(0, start - 30) : end + 30]
        results.append(
            {
                "text": m.group(0),
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


def _extract_and_dedup(text: str) -> list[dict]:
    """Run all three extractors against a flat string; return deduped claims.

    Run DATE before NUMBER so a bare four-digit year is typed "date" not
    "number". Deduplicate on normalised text (first occurrence wins).
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
    return deduped


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
    text = _flatten_portable_text(blocks)
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
    and/or string headline fields. Plain str values pass through.
    """
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        # Treat bare list as Portable Text blocks
        return _flatten_portable_text(value)
    if isinstance(value, dict):
        parts: list[str] = []
        # body is Portable Text blocks
        body = value.get("body")
        if body is not None:
            parts.append(_flatten_portable_text(body))
        # String fields (headlines, etc.)
        for v in value.values():
            if isinstance(v, str) and v:
                parts.append(v)
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
