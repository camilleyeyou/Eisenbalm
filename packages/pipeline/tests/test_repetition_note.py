"""Phase 40 Plan 40-01 (§40.4, ISS-03) — RED scaffold for
GET /registry/repetition-note.

Structurally identical to test_registry_coverage.py: same FastAPI
TestClient bootstrap mounting `registry.router`, same monkeypatch of
``eisenbalm_pipeline.lib.convex_client.convex_query``, same
``patch.object(sanity_client, "groq_query", autospec=True)`` (a wrong-arity
call from the endpoint fails loudly instead of a bare AsyncMock silently
accepting it).

Covers §40.4's deterministic algorithm: REPETITION_THRESHOLD=3, geo/cause
only (signal/scoutNotes excluded), geo-before-cause tie-break, and an
at-most-2 cap on ``avoid``.

RED until Plan 40-03 adds ``GET /registry/repetition-note`` to
``packages/pipeline/src/eisenbalm_pipeline/api/registry.py``.

Run: ``cd packages/pipeline && uv run pytest tests/test_repetition_note.py``
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import eisenbalm_pipeline.lib.convex_client as _cc
import eisenbalm_pipeline.lib.sanity_client as _sc

pytestmark = pytest.mark.anyio


def _make_client() -> TestClient:
    from eisenbalm_pipeline.api.registry import router as registry_router

    app = FastAPI()
    app.include_router(registry_router)
    app.state.convex_http = MagicMock()
    return TestClient(app, raise_server_exceptions=True)


# ── Fixture: 8 featured rows, all with a sanityCharityId ───────────────────

_FEATURED_ROWS_OVER_REPRESENTED = [
    {"name": f"Charity {i}", "sanityCharityId": f"charity-{i}", "lastFeaturedAt": 1000 + i}
    for i in range(8)
]


def _sanity_rows_over_represented() -> list[dict]:
    """3 rows share location="US-SE", 3 rows share focusArea="weather"
    (overlapping on the first 3 ids so both dimensions clear the threshold
    from a single 8-row sample), the rest are distinct singletons."""
    return [
        {"_id": "charity-0", "focusArea": "weather", "location": "US-SE"},
        {"_id": "charity-1", "focusArea": "weather", "location": "US-SE"},
        {"_id": "charity-2", "focusArea": "weather", "location": "US-SE"},
        {"_id": "charity-3", "focusArea": "housing", "location": "US-NE"},
        {"_id": "charity-4", "focusArea": "education", "location": "US-MW"},
        {"_id": "charity-5", "focusArea": "health", "location": "US-W"},
        {"_id": "charity-6", "focusArea": "environment", "location": "EU"},
        {"_id": "charity-7", "focusArea": "arts", "location": "APAC"},
    ]


async def test_repetition_note_over_represented_geo_and_cause(monkeypatch):
    """3+ shared geo AND 3+ shared cause both surface in `avoid`, geo sorts
    before cause, and `note` is the exact 'avoid X · avoid Y' shape."""
    convex_mock = AsyncMock(return_value=_FEATURED_ROWS_OVER_REPRESENTED)
    monkeypatch.setattr(_cc, "convex_query", convex_mock)

    with patch.object(_sc, "groq_query", autospec=True) as groq_mock:
        groq_mock.return_value = _sanity_rows_over_represented()
        client = _make_client()
        resp = client.get("/registry/repetition-note")

    assert resp.status_code == 200
    data = resp.json()

    assert data["sampleSize"] == 8
    assert data["note"] == "avoid US-SE · avoid weather"
    assert len(data["avoid"]) == 2

    geo_item = next(item for item in data["avoid"] if item["dimension"] == "geo")
    cause_item = next(item for item in data["avoid"] if item["dimension"] == "cause")
    assert geo_item["value"] == "US-SE"
    assert geo_item["count"] >= 3
    assert cause_item["value"] == "weather"
    assert cause_item["count"] >= 3

    # geo sorts before cause in the `avoid` list.
    assert data["avoid"][0]["dimension"] == "geo"
    assert data["avoid"][1]["dimension"] == "cause"


async def test_repetition_note_nothing_over_represented(monkeypatch):
    """Every location/focusArea value is distinct (count 1 each) -> note is
    null and avoid is an empty list."""
    convex_mock = AsyncMock(return_value=_FEATURED_ROWS_OVER_REPRESENTED)
    monkeypatch.setattr(_cc, "convex_query", convex_mock)

    distinct_rows = [
        {"_id": f"charity-{i}", "focusArea": f"cause-{i}", "location": f"geo-{i}"}
        for i in range(8)
    ]

    with patch.object(_sc, "groq_query", autospec=True) as groq_mock:
        groq_mock.return_value = distinct_rows
        client = _make_client()
        resp = client.get("/registry/repetition-note")

    assert resp.status_code == 200
    data = resp.json()
    assert data["note"] is None
    assert data["avoid"] == []


async def test_repetition_note_threshold_boundary(monkeypatch):
    """A value appearing exactly twice is excluded (REPETITION_THRESHOLD=3);
    a value appearing exactly three times is included."""
    convex_mock = AsyncMock(return_value=_FEATURED_ROWS_OVER_REPRESENTED)
    monkeypatch.setattr(_cc, "convex_query", convex_mock)

    boundary_rows = [
        {"_id": "charity-0", "focusArea": None, "location": "twice-geo"},
        {"_id": "charity-1", "focusArea": None, "location": "twice-geo"},
        {"_id": "charity-2", "focusArea": None, "location": "thrice-geo"},
        {"_id": "charity-3", "focusArea": None, "location": "thrice-geo"},
        {"_id": "charity-4", "focusArea": None, "location": "thrice-geo"},
        {"_id": "charity-5", "focusArea": None, "location": "solo-a"},
        {"_id": "charity-6", "focusArea": None, "location": "solo-b"},
        {"_id": "charity-7", "focusArea": None, "location": "solo-c"},
    ]

    with patch.object(_sc, "groq_query", autospec=True) as groq_mock:
        groq_mock.return_value = boundary_rows
        client = _make_client()
        resp = client.get("/registry/repetition-note")

    assert resp.status_code == 200
    data = resp.json()
    values = {item["value"] for item in data["avoid"]}
    assert "twice-geo" not in values
    assert "thrice-geo" in values


async def test_repetition_note_excludes_signal(monkeypatch):
    """scoutNotes (signal) is never counted, even when identical across all
    8 rows — only cause/geo are categorical dimensions."""
    convex_mock = AsyncMock(return_value=_FEATURED_ROWS_OVER_REPRESENTED)
    monkeypatch.setattr(_cc, "convex_query", convex_mock)

    identical_signal_rows = [
        {
            "_id": f"charity-{i}",
            "focusArea": f"cause-{i}",
            "location": f"geo-{i}",
            "scoutNotes": "the exact same overlooked-story note every time",
        }
        for i in range(8)
    ]

    with patch.object(_sc, "groq_query", autospec=True) as groq_mock:
        groq_mock.return_value = identical_signal_rows
        client = _make_client()
        resp = client.get("/registry/repetition-note")

    assert resp.status_code == 200
    data = resp.json()
    assert data["note"] is None
    assert data["avoid"] == []
    for item in data["avoid"]:
        assert item["dimension"] in ("geo", "cause")


async def test_repetition_note_at_most_two(monkeypatch):
    """When three or more dimension/value pairs exceed the threshold, at
    most 2 appear in `avoid`, and `note` has at most two 'avoid X' clauses."""
    convex_mock = AsyncMock(return_value=_FEATURED_ROWS_OVER_REPRESENTED)
    monkeypatch.setattr(_cc, "convex_query", convex_mock)

    # 8 rows is only enough room for 2 distinct 3+ groups per dimension across
    # 2 dimensions (geo, cause) -> 4 candidate groups total, well over 2.
    many_over_rows = [
        {"_id": "charity-0", "focusArea": "weather", "location": "US-SE"},
        {"_id": "charity-1", "focusArea": "weather", "location": "US-SE"},
        {"_id": "charity-2", "focusArea": "weather", "location": "US-SE"},
        {"_id": "charity-3", "focusArea": "housing", "location": "US-NE"},
        {"_id": "charity-4", "focusArea": "housing", "location": "US-NE"},
        {"_id": "charity-5", "focusArea": "housing", "location": "US-NE"},
        {"_id": "charity-6", "focusArea": "education", "location": "APAC"},
        {"_id": "charity-7", "focusArea": "education", "location": "APAC"},
    ]

    with patch.object(_sc, "groq_query", autospec=True) as groq_mock:
        groq_mock.return_value = many_over_rows
        client = _make_client()
        resp = client.get("/registry/repetition-note")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["avoid"]) <= 2
    assert data["note"].count("avoid ") <= 2


async def test_repetition_note_degrades_on_sanity_failure(monkeypatch):
    """A Sanity groq_query failure (e.g. 401 from a bad SANITY_API_TOKEN)
    degrades to a neutral note instead of a 500 — sampleSize is preserved
    from the Convex row count, captured BEFORE the Sanity join."""
    convex_mock = AsyncMock(return_value=_FEATURED_ROWS_OVER_REPRESENTED)
    monkeypatch.setattr(_cc, "convex_query", convex_mock)

    _req = httpx.Request("GET", "https://x.api.sanity.io/v1/data/query/x")
    _err = httpx.HTTPStatusError(
        "401 Unauthorized", request=_req, response=httpx.Response(401, request=_req)
    )

    with patch.object(_sc, "groq_query", autospec=True) as groq_mock:
        groq_mock.side_effect = _err
        client = _make_client()
        resp = client.get("/registry/repetition-note")

    assert resp.status_code == 200
    data = resp.json()
    assert data["note"] is None
    assert data["avoid"] == []
    assert data["sampleSize"] == 8
