"""Phase 42 Plan 02 Task 1 — FCT-01: Researcher-emitted `importance`.

Pure-logic unit tests for:
  - ``ClaimOutput`` retaining an LLM-emitted ``importance`` and defaulting to
    'Supporting' when the model omits the field (D-03 — never silently
    'Load-bearing').
  - ``_map_claims`` (the extracted, independently-testable body of the
    mapped_claims construction loop in ``researcher()``) carrying
    ``importance`` through onto every mapped research claim.

No network calls — mirrors ``test_claims_extractor.py``'s pure-logic style:
raw claim dicts are constructed directly and the mapping is asserted.
"""

from __future__ import annotations

from eisenbalm_pipeline.agents.researcher import ClaimOutput, _map_claims
from eisenbalm_pipeline.lib.search_client import SearchResult


# ── ClaimOutput ────────────────────────────────────────────────────────────


def test_claim_output_retains_explicit_importance():
    """A ClaimOutput parsed from model JSON with an explicit importance
    retains it verbatim."""
    claim = ClaimOutput(text="Founded in 1998.", sourceIndex=0, importance="Load-bearing")
    assert claim.importance == "Load-bearing"


def test_claim_output_defaults_importance_to_supporting_when_omitted():
    """A ClaimOutput with no importance key defaults to 'Supporting'."""
    claim = ClaimOutput(text="Founded in 1998.", sourceIndex=0)
    assert claim.importance == "Supporting"


def test_claim_output_accepts_all_three_literal_values():
    for tier in ("Load-bearing", "Supporting", "Incidental"):
        claim = ClaimOutput(text="x", importance=tier)
        assert claim.importance == tier


# ── _map_claims ──────────────────────────────────────────────────────────


_TAVILY_RESULTS = [
    SearchResult(url="https://example.org/a", title="A", content="...", score=0.9),
    SearchResult(url="https://example.org/b", title="B", content="...", score=0.8),
]
_RETRIEVED_AT_BY_INDEX = [1_700_000_000_000, 1_700_000_000_000]


def test_map_claims_carries_explicit_importance_through():
    """A raw claim dict with an explicit importance lands on the mapped
    claim with that same value."""
    raw_claims = [{"text": "Founded in 1998.", "sourceIndex": 0, "importance": "Load-bearing"}]
    mapped = _map_claims(raw_claims, _TAVILY_RESULTS, _RETRIEVED_AT_BY_INDEX, "abcdef1234")
    assert len(mapped) == 1
    assert mapped[0]["importance"] == "Load-bearing"


def test_map_claims_defaults_importance_to_supporting_when_absent():
    """A raw claim dict with no importance key defaults to 'Supporting' on
    the mapped claim (mirrors ClaimOutput's own default, but exercised at
    the dict-mapping layer since the LLM output may already be a plain
    dict — e.g. stub mode / dict-shaped test fixtures)."""
    raw_claims = [{"text": "Served 12,000 meals.", "sourceIndex": None}]
    mapped = _map_claims(raw_claims, _TAVILY_RESULTS, _RETRIEVED_AT_BY_INDEX, "abcdef1234")
    assert len(mapped) == 1
    assert mapped[0]["importance"] == "Supporting"


def test_map_claims_every_mapped_claim_carries_importance_key():
    """Every entry in the mapped claims list has an 'importance' key,
    regardless of sourceIndex validity."""
    raw_claims = [
        {"text": "Sourced claim.", "sourceIndex": 0, "importance": "Incidental"},
        {"text": "Unsourced claim.", "sourceIndex": None},
        {"text": "Out of range index.", "sourceIndex": 99, "importance": "Supporting"},
    ]
    mapped = _map_claims(raw_claims, _TAVILY_RESULTS, _RETRIEVED_AT_BY_INDEX, "abcdef1234")
    assert len(mapped) == 3
    for claim in mapped:
        assert "importance" in claim
    assert mapped[0]["importance"] == "Incidental"
    assert mapped[1]["importance"] == "Supporting"
    assert mapped[2]["importance"] == "Supporting"


def test_map_claims_out_of_range_source_index_still_gets_supporting_default():
    """An out-of-range sourceIndex still honestly nulls sourceUrl/retrievedAt
    (unrelated to importance) while importance still defaults correctly."""
    raw_claims = [{"text": "x", "sourceIndex": 99}]
    mapped = _map_claims(raw_claims, _TAVILY_RESULTS, _RETRIEVED_AT_BY_INDEX, "abcdef1234")
    assert mapped[0]["sourceUrl"] is None
    assert mapped[0]["retrievedAt"] is None
    assert mapped[0]["importance"] == "Supporting"


def test_map_claims_preserves_claim_id_and_source_mapping_alongside_importance():
    """Sanity check that adding importance did not disturb the existing
    claimId/sourceUrl/retrievedAt mapping contract (§35.2)."""
    raw_claims = [{"text": "Founded in 1998.", "sourceIndex": 1, "importance": "Load-bearing"}]
    mapped = _map_claims(raw_claims, _TAVILY_RESULTS, _RETRIEVED_AT_BY_INDEX, "run12345678")
    assert mapped[0]["claimId"] == "run12345-0"
    assert mapped[0]["sourceUrl"] == "https://example.org/b"
    assert mapped[0]["retrievedAt"] == 1_700_000_000_000
    assert mapped[0]["importance"] == "Load-bearing"
