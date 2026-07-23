"""Regression coverage — debug session ``stale-empty-section-qa-findings``
(2026-07-23).

Root cause: ``_body_to_text`` (and ``_block_index_hint``, covered separately
in ``test_block_index_hint.py``) assumed the legacy nested Portable-Text-like
block shape (``{"children": [{"text": ...}]}``), but every long-read writer
has emitted the FLAT ``BodyBlock`` shape (``{"type": ..., "text": ...}``, no
``children`` key) since Phase 18 (see ``graph/blocks.py``). The mismatch made
``_body_to_text`` silently return "" for every list-bodied section on every
run, feeding the Layer-2 LLM judge an empty view of sections the writers had
actually populated — which is why real Sanity drafts had full content while
QA intermittently flagged those same sections as "empty".

These tests exercise ``_body_to_text`` and ``_extract_sections`` directly
with the REAL production shape, so a regression back to the old assumption
fails loudly.
"""
from __future__ import annotations

from eisenbalm_pipeline.agents.qa import _body_to_text, _extract_sections


def test_body_to_text_extracts_flat_body_block_shape() -> None:
    """The actual production shape: {"type": ..., "text": ...}, no 'children'."""
    body = [
        {"type": "paragraph", "text": "Pediatric osteosarcoma is rare."},
        {"type": "h2", "text": "A Diagnosis Before the Nonprofit"},
        {"type": "paragraph", "text": "Ann Graham founded MIB Agents in 2016."},
        {"type": "blockquote", "text": "The organization did not begin as an institution."},
    ]
    text = _body_to_text(body)
    assert text != ""
    assert "Pediatric osteosarcoma is rare." in text
    assert "A Diagnosis Before the Nonprofit" in text
    assert "Ann Graham founded MIB Agents in 2016." in text
    assert "The organization did not begin as an institution." in text


def test_body_to_text_legacy_nested_children_shape_still_supported() -> None:
    """Back-compat fallback only — not the production shape since Phase 18."""
    body = [
        {"children": [{"text": "Legacy nested paragraph one."}]},
        {"children": [{"text": "Legacy nested paragraph two."}]},
    ]
    text = _body_to_text(body)
    assert "Legacy nested paragraph one." in text
    assert "Legacy nested paragraph two." in text


def test_body_to_text_passes_through_plain_string() -> None:
    """BigBudget/Jingle bonus bodies remain plain str (Phase 18 D-04)."""
    assert _body_to_text("Plain prose body.") == "Plain prose body."


def test_body_to_text_empty_list_is_genuinely_empty() -> None:
    assert _body_to_text([]) == ""


def test_body_to_text_blocks_with_empty_text_field_are_empty() -> None:
    """A block that legitimately has type but no prose still yields ''."""
    body = [{"type": "paragraph", "text": ""}]
    assert _body_to_text(body) == ""


def test_extract_sections_regression_flat_bodies_are_not_empty() -> None:
    """End-to-end regression for the exact bug: a DispatchState with REAL
    flat BodyBlock content for all four long-read sections must extract to
    non-empty text for every one of them — this is what the Layer-2 judge
    actually sees. Before the fix, every one of these would have extracted
    to "" despite the rich content below, which is exactly what caused QA
    to hallucinate "the {section} section is empty" findings against a
    fully-populated Sanity draft.
    """
    state = {
        "origin_story": {
            "headline": "H1",
            "body": [
                {"type": "paragraph", "text": "Origin story prose."},
                {"type": "h2", "text": "A Sub-header"},
            ],
        },
        "problem_statement": {
            "headline": "H2",
            "body": [{"type": "paragraph", "text": "Problem statement prose."}],
        },
        "founder_bio": {
            "headline": "H3",
            "body": [{"type": "paragraph", "text": "Founder bio prose."}],
        },
        "case_study": {
            "headline": "H4",
            "body": [{"type": "paragraph", "text": "Case study prose."}],
        },
        "game": {"description": "Game description text."},
        "bonus": {
            "headline": "H5",
            "body": [{"type": "paragraph", "text": "Bonus prose."}],
        },
    }
    sections = _extract_sections(state)
    assert sections["origin_story"] != "" and "Origin story prose." in sections["origin_story"]
    assert sections["problem"] != "" and "Problem statement prose." in sections["problem"]
    assert sections["founder_bio"] != "" and "Founder bio prose." in sections["founder_bio"]
    assert sections["case_study"] != "" and "Case study prose." in sections["case_study"]
    assert sections["game"] == "Game description text."
    assert sections["bonus"] != "" and "Bonus prose." in sections["bonus"]


def test_extract_sections_bonus_as_plain_string_still_works() -> None:
    """BigBudget/Jingle bonus (str body) — unaffected by the BodyBlock fix."""
    state = {"bonus": {"headline": "H", "body": "Plain bonus prose."}}
    sections = _extract_sections(state)
    assert sections["bonus"] == "Plain bonus prose."
