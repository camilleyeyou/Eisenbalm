"""
Wave 0 scaffold — Phase 26 RVW-05: Claims extractor unit tests.

These tests are pre-written stubs for the claims extraction module
(eisenbalm_pipeline.lib.claims) which will be implemented in Plan 26-02.

All tests use pytest.skip() at import time if the module is not yet present —
so this file MUST run green (all skipped) with no infrastructure changes.

Implementation target (Plan 26-02):
  eisenbalm_pipeline/lib/claims.py
    - extract_all_claim_types(portable_text: list[dict]) -> list[dict]
      Returns flat list: [{text, claimType, context, claimIndex}, ...]
      claimType in {"number", "date", "proper_noun"}
    - flatten_portable_text(portable_text: list[dict]) -> str
      Converts Sanity Portable Text blocks to plain-text string for extraction.
"""

import pytest

# ── Import guard ──────────────────────────────────────────────────────────────

try:
    from eisenbalm_pipeline.lib.claims import (  # type: ignore[import]
        extract_all_claim_types,
        flatten_portable_text,
    )
    _CLAIMS_MODULE_AVAILABLE = True
except ImportError:
    _CLAIMS_MODULE_AVAILABLE = False
    extract_all_claim_types = None
    flatten_portable_text = None


skip_if_no_module = pytest.mark.skipif(
    not _CLAIMS_MODULE_AVAILABLE,
    reason="eisenbalm_pipeline.lib.claims not yet implemented (Plan 26-02)",
)


# ── flatten_portable_text ─────────────────────────────────────────────────────


@skip_if_no_module
def test_flatten_portable_text_single_block():
    """Single paragraph block → plain string."""
    blocks = [
        {
            "_type": "block",
            "_key": "abc",
            "style": "normal",
            "markDefs": [],
            "children": [
                {"_type": "span", "_key": "s1", "text": "Hello world.", "marks": []}
            ],
        }
    ]
    result = flatten_portable_text(blocks)
    assert isinstance(result, str)
    assert "Hello world." in result


@skip_if_no_module
def test_flatten_portable_text_multiple_blocks():
    """Multiple blocks are joined and all text is present."""
    blocks = [
        {
            "_type": "block",
            "_key": "b1",
            "style": "normal",
            "markDefs": [],
            "children": [
                {"_type": "span", "_key": "s1", "text": "First paragraph.", "marks": []}
            ],
        },
        {
            "_type": "block",
            "_key": "b2",
            "style": "normal",
            "markDefs": [],
            "children": [
                {"_type": "span", "_key": "s2", "text": "Second paragraph.", "marks": []}
            ],
        },
    ]
    result = flatten_portable_text(blocks)
    assert "First paragraph." in result
    assert "Second paragraph." in result


@skip_if_no_module
def test_flatten_portable_text_empty_input():
    """Empty block list → empty string (no crash)."""
    result = flatten_portable_text([])
    assert result == ""


@skip_if_no_module
def test_flatten_portable_text_ignores_non_block_types():
    """Non-block objects (images, etc.) are gracefully ignored."""
    blocks = [
        {"_type": "image", "_key": "img1", "asset": {"_ref": "image-ref"}},
        {
            "_type": "block",
            "_key": "b1",
            "style": "normal",
            "markDefs": [],
            "children": [
                {"_type": "span", "_key": "s1", "text": "After image.", "marks": []}
            ],
        },
    ]
    result = flatten_portable_text(blocks)
    assert "After image." in result


# ── extract_all_claim_types ───────────────────────────────────────────────────


@skip_if_no_module
def test_extract_finds_numbers():
    """Numbers in text are extracted as claimType='number'."""
    blocks = [
        {
            "_type": "block",
            "_key": "b1",
            "style": "normal",
            "markDefs": [],
            "children": [
                {
                    "_type": "span",
                    "_key": "s1",
                    "text": "The charity served 12,000 meals in 2023.",
                    "marks": [],
                }
            ],
        }
    ]
    claims = extract_all_claim_types(blocks)
    assert isinstance(claims, list)
    number_claims = [c for c in claims if c.get("claimType") == "number"]
    assert len(number_claims) >= 1


@skip_if_no_module
def test_extract_finds_dates():
    """Dates in text are extracted as claimType='date'."""
    blocks = [
        {
            "_type": "block",
            "_key": "b1",
            "style": "normal",
            "markDefs": [],
            "children": [
                {
                    "_type": "span",
                    "_key": "s1",
                    "text": "Founded in March 1987 by Dr. Eleanor Finch.",
                    "marks": [],
                }
            ],
        }
    ]
    claims = extract_all_claim_types(blocks)
    date_claims = [c for c in claims if c.get("claimType") == "date"]
    assert len(date_claims) >= 1


@skip_if_no_module
def test_extract_finds_proper_nouns():
    """Proper nouns are extracted as claimType='proper_noun'."""
    blocks = [
        {
            "_type": "block",
            "_key": "b1",
            "style": "normal",
            "markDefs": [],
            "children": [
                {
                    "_type": "span",
                    "_key": "s1",
                    "text": "The Riverside Community Trust operates out of Portland, Oregon.",
                    "marks": [],
                }
            ],
        }
    ]
    claims = extract_all_claim_types(blocks)
    noun_claims = [c for c in claims if c.get("claimType") == "proper_noun"]
    assert len(noun_claims) >= 1


@skip_if_no_module
def test_extract_returns_sequential_indices():
    """claimIndex values are unique and 0-based sequential integers."""
    blocks = [
        {
            "_type": "block",
            "_key": "b1",
            "style": "normal",
            "markDefs": [],
            "children": [
                {
                    "_type": "span",
                    "_key": "s1",
                    "text": "In 2021, the Greenway Foundation raised $500,000 in San Francisco.",
                    "marks": [],
                }
            ],
        }
    ]
    claims = extract_all_claim_types(blocks)
    if not claims:
        pytest.skip("No claims found — text may not trigger extraction")

    indices = [c["claimIndex"] for c in claims]
    assert sorted(indices) == list(range(len(claims))), (
        "claimIndex values must be 0-based sequential integers"
    )


@skip_if_no_module
def test_extract_each_claim_has_required_fields():
    """Every claim dict has the required keys: text, claimType, context, claimIndex."""
    blocks = [
        {
            "_type": "block",
            "_key": "b1",
            "style": "normal",
            "markDefs": [],
            "children": [
                {
                    "_type": "span",
                    "_key": "s1",
                    "text": "The Elmwood Project served 4,500 children in Detroit during 2019.",
                    "marks": [],
                }
            ],
        }
    ]
    claims = extract_all_claim_types(blocks)
    required_keys = {"text", "claimType", "context", "claimIndex"}
    for claim in claims:
        missing = required_keys - set(claim.keys())
        assert not missing, f"Claim missing keys {missing}: {claim}"


@skip_if_no_module
def test_extract_empty_blocks_returns_empty_list():
    """Empty portable text → empty claims list (no crash)."""
    claims = extract_all_claim_types([])
    assert claims == []


# ── extract_claims_by_block (Phase 35 PRV-02/PRV-04) ──────────────────────
#
# Per-section/per-block extraction restructure (D-13, one-row-per-occurrence):
# every row carries a sectionName (galley id vocabulary) + blockIndexHint (the
# block's own 0-based loop index) anchor. This is a NEW function alongside the
# legacy extract_claims (global-join, Phase 26/33) — legacy exports stay
# unchanged. Imported locally inside each test (not at module import time) so
# a not-yet-implemented function only fails these new tests, not every test
# already passing in this file.


def test_extract_claims_by_block_emits_sectionname_and_blockindexhint():
    """Per-section/per-block extraction: every row carries sectionName (galley
    vocabulary) + blockIndexHint (the block's own loop index)."""
    from eisenbalm_pipeline.lib.claims import extract_claims_by_block

    sections = {
        "origin_story": {
            "body": [
                {"type": "paragraph", "text": "Founded in 1998 by Jane Doe."},
                {"type": "paragraph", "text": "The Riverside Trust grew slowly."},
            ]
        },
    }
    rows = extract_claims_by_block(sections)
    assert rows, "expected at least one extracted claim row"
    for row in rows:
        assert row["sectionName"] == "originStory"
        assert isinstance(row["blockIndexHint"], int)

    date_rows = [r for r in rows if r["claimType"] == "date"]
    assert any(r["blockIndexHint"] == 0 for r in date_rows)


def test_extract_claims_by_block_same_fact_two_sections_yields_two_rows():
    """The same fact stated in two sections yields TWO independent rows with
    distinct (sectionName, blockIndexHint) anchors — D-13 one-row-per-
    occurrence (not the legacy global-dedup behavior)."""
    from eisenbalm_pipeline.lib.claims import extract_claims_by_block

    sections = {
        "origin_story": {
            "body": [{"type": "paragraph", "text": "Founded in 1998."}],
        },
        "founder_bio": {
            "body": [{"type": "paragraph", "text": "The org was founded in 1998."}],
        },
    }
    rows = extract_claims_by_block(sections)
    date_rows = [r for r in rows if r["text"] == "1998"]
    assert len(date_rows) == 2
    section_names = {r["sectionName"] for r in date_rows}
    assert section_names == {"originStory", "founderBio"}


def test_extract_claims_by_block_dedups_within_block_only():
    """Two occurrences of the same claim text WITHIN one block dedup to one
    row (dedup is per-block, not per-section or global)."""
    from eisenbalm_pipeline.lib.claims import extract_claims_by_block

    sections = {
        "origin_story": {
            "body": [
                {
                    "type": "paragraph",
                    "text": (
                        "Founded in 1998. Also founded in 1998 by a second "
                        "account."
                    ),
                },
            ],
        },
    }
    rows = extract_claims_by_block(sections)
    date_rows = [r for r in rows if r["text"] == "1998"]
    assert len(date_rows) == 1


def test_extract_claims_by_block_ignores_unknown_section_keys():
    from eisenbalm_pipeline.lib.claims import extract_claims_by_block

    rows = extract_claims_by_block({"not_a_real_section": {"body": []}})
    assert rows == []


def test_extract_claims_by_block_rows_have_no_claimindex():
    """claimIndex ordinals are assigned by the publisher (global merge of
    sourced + unsourced rows), never by this per-block extractor."""
    from eisenbalm_pipeline.lib.claims import extract_claims_by_block

    sections = {
        "origin_story": {"body": [{"type": "paragraph", "text": "Founded in 1998."}]},
    }
    rows = extract_claims_by_block(sections)
    assert rows
    for row in rows:
        assert "claimIndex" not in row


def test_extract_claims_by_block_maps_all_five_galley_section_ids():
    """Internal section keys map to the galley sectionName vocabulary the
    frontend uses: originStory | problemStatement | founderBio | caseStudy |
    bonus."""
    from eisenbalm_pipeline.lib.claims import extract_claims_by_block

    sections = {
        "origin_story": {"body": [{"type": "paragraph", "text": "Founded 1998."}]},
        "problem_statement": {"body": [{"type": "paragraph", "text": "Founded 1998."}]},
        "founder_bio": {"body": [{"type": "paragraph", "text": "Founded 1998."}]},
        "case_study": {"body": [{"type": "paragraph", "text": "Founded 1998."}]},
        "bonus": {"body": [{"type": "paragraph", "text": "Founded 1998."}]},
    }
    rows = extract_claims_by_block(sections)
    section_names = {r["sectionName"] for r in rows}
    assert section_names == {
        "originStory", "problemStatement", "founderBio", "caseStudy", "bonus",
    }
