"""Phase 46 Plan 02 (SGE-05) — unit tests for
``lib.registry_repetition.compute_repetition_note``.

The counting algorithm here is extracted VERBATIM from the shipped Phase 40
``GET /registry/repetition-note`` endpoint (``api/registry.py``) — these
tests reuse the exact fixture shapes from ``tests/test_repetition_note.py``
(the ``_FEATURED_ROWS_OVER_REPRESENTED`` / ``_sanity_rows_over_represented``
precedent) so both the new unit-level helper and the existing endpoint-level
integration test assert on the same behavior.

Source: docs/API_CONTRACTS.md §40.4; 46-02-...-PLAN.md Task 1 <behavior>.
"""
from __future__ import annotations

from eisenbalm_pipeline.lib.registry_repetition import compute_repetition_note


def test_compute_repetition_note_empty_input() -> None:
    """No rows -> note is None, avoid is empty, sampleSize is 0."""
    result = compute_repetition_note([])
    assert result == {"note": None, "avoid": [], "sampleSize": 0}


def test_compute_repetition_note_over_represented_geo_and_cause() -> None:
    """3 rows sharing focusArea='weather' + location='US-SE' -> note is
    'avoid US-SE · avoid weather' (geo before cause) and avoid has 2 entries
    with dimension/value/count."""
    sanity_rows = [
        {"_id": "charity-0", "focusArea": "weather", "location": "US-SE"},
        {"_id": "charity-1", "focusArea": "weather", "location": "US-SE"},
        {"_id": "charity-2", "focusArea": "weather", "location": "US-SE"},
        {"_id": "charity-3", "focusArea": "housing", "location": "US-NE"},
        {"_id": "charity-4", "focusArea": "education", "location": "US-MW"},
        {"_id": "charity-5", "focusArea": "health", "location": "US-W"},
        {"_id": "charity-6", "focusArea": "environment", "location": "EU"},
        {"_id": "charity-7", "focusArea": "arts", "location": "APAC"},
    ]

    result = compute_repetition_note(sanity_rows)

    assert result["sampleSize"] == 8
    assert result["note"] == "avoid US-SE · avoid weather"
    assert len(result["avoid"]) == 2

    geo_item = next(item for item in result["avoid"] if item["dimension"] == "geo")
    cause_item = next(item for item in result["avoid"] if item["dimension"] == "cause")
    assert geo_item == {"dimension": "geo", "value": "US-SE", "count": 3}
    assert cause_item == {"dimension": "cause", "value": "weather", "count": 3}

    # geo sorts before cause in the `avoid` list.
    assert result["avoid"][0]["dimension"] == "geo"
    assert result["avoid"][1]["dimension"] == "cause"


def test_compute_repetition_note_below_threshold_is_none() -> None:
    """Values appearing exactly twice (< REPETITION_THRESHOLD=3) never
    surface -> note is None."""
    sanity_rows = [
        {"_id": "charity-0", "focusArea": None, "location": "twice-geo"},
        {"_id": "charity-1", "focusArea": None, "location": "twice-geo"},
        {"_id": "charity-2", "focusArea": None, "location": "solo-a"},
    ]

    result = compute_repetition_note(sanity_rows)

    assert result["note"] is None
    assert result["avoid"] == []
    assert result["sampleSize"] == 3


def test_compute_repetition_note_ties_break_geo_before_cause_then_value_asc() -> None:
    """When two dimension/value groups tie on count, geo sorts before cause;
    within the same dimension, value sorts ascending. Result capped at 2
    entries even when more groups clear the threshold."""
    sanity_rows = [
        # cause "education" x3 (APAC geo x3, tied count with the two below)
        {"_id": "c0", "focusArea": "education", "location": "APAC"},
        {"_id": "c1", "focusArea": "education", "location": "APAC"},
        {"_id": "c2", "focusArea": "education", "location": "APAC"},
        # cause "housing" x3 (US-NE geo x3, tied count)
        {"_id": "c3", "focusArea": "housing", "location": "US-NE"},
        {"_id": "c4", "focusArea": "housing", "location": "US-NE"},
        {"_id": "c5", "focusArea": "housing", "location": "US-NE"},
    ]

    result = compute_repetition_note(sanity_rows)

    # 4 candidate groups (2 geo + 2 cause) all tied at count=3; capped at 2.
    assert len(result["avoid"]) == 2
    # geo-before-cause tie-break: both surfaced entries must be geo.
    assert all(item["dimension"] == "geo" for item in result["avoid"])
    # Within geo, value ascending: "APAC" < "US-NE".
    assert result["avoid"][0]["value"] == "APAC"
    assert result["avoid"][1]["value"] == "US-NE"
    assert result["note"] == "avoid APAC · avoid US-NE"
