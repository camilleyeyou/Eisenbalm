"""Phase 39 Plan 02 (MEM-01) — GET /registry/coverage-strip.

Covers the server-side join of Convex ``charities:listRecentFeatured``
(last <=8 featured charities) to their Sanity ``focusArea``/``location``/
``scoutNotes`` (cause/geo/signal chip data), and the graceful fallback for
featured charities lacking a ``sanityCharityId`` (legacy/backfilled rows,
Pitfall 6 in 39-RESEARCH.md).

IMPORTANT: ``groq_query``'s real signature is
``groq_query(query, *, params=None)`` — it takes NO ``http``/positional-
client argument (see ``lib/sanity_client.py`` + the ``calibrator.py:70``
precedent). The Sanity mock below is patched with ``autospec=True`` so a
wrong-arity call from the endpoint (e.g. passing an ``http`` client as a
first positional arg) fails loudly with a ``TypeError`` instead of a bare
``AsyncMock`` silently accepting it.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import eisenbalm_pipeline.lib.convex_client as _cc
import eisenbalm_pipeline.lib.sanity_client as _sc

pytestmark = pytest.mark.anyio

# ── Fixtures shared by both tests ──────────────────────────────────────────

_FEATURED_ROWS = [
    {"name": "Charity A", "sanityCharityId": "charity-a", "lastFeaturedAt": 2000},
    {"name": "Charity B", "sanityCharityId": None, "lastFeaturedAt": 1000},
]

_SANITY_ROWS = [
    {
        "_id": "charity-a",
        "focusArea": "Housing",
        "location": "Detroit",
        "scoutNotes": "long note about why this charity was overlooked",
    }
]


def _make_client() -> TestClient:
    from eisenbalm_pipeline.api.registry import router as registry_router

    app = FastAPI()
    app.include_router(registry_router)
    app.state.convex_http = MagicMock()
    return TestClient(app, raise_server_exceptions=True)


# ── Test 1: join shape + ordering + populated chips ────────────────────────


async def test_coverage_strip_joins_cause_geo_signal(monkeypatch):
    """Endpoint joins the last-8 featured charities to their Sanity
    focusArea/location/scoutNotes, preserving listRecentFeatured's
    lastFeaturedAt-desc order, and populates chips for the row that has a
    sanityCharityId."""
    convex_mock = AsyncMock(return_value=_FEATURED_ROWS)
    monkeypatch.setattr(_cc, "convex_query", convex_mock)

    with patch.object(_sc, "groq_query", autospec=True) as groq_mock:
        groq_mock.return_value = _SANITY_ROWS
        client = _make_client()
        resp = client.get("/registry/coverage-strip")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2

    # Order preserved: Charity A (lastFeaturedAt=2000) before Charity B (1000).
    assert data[0]["name"] == "Charity A"
    assert data[1]["name"] == "Charity B"

    # Charity A's chips populated from the Sanity join.
    assert data[0]["cause"] == "Housing"
    assert data[0]["geo"] == "Detroit"
    assert data[0]["signal"].startswith("long note about why")

    # Convex called with limit 8.
    convex_mock.assert_awaited_once()
    call_args = convex_mock.call_args.args
    assert call_args[1] == "charities:listRecentFeatured"
    assert call_args[2]["limit"] == 8

    # At most one groq_query issued with the collected ids.
    groq_mock.assert_awaited_once()


# ── Test 2: missing sanityCharityId — graceful skip, no crash ─────────────


async def test_coverage_strip_skips_missing_sanity_id(monkeypatch):
    """A featured charity lacking sanityCharityId (legacy/backfilled row)
    renders empty/None chips, does not crash the request, and its absent id
    never reaches the groq $ids param."""
    convex_mock = AsyncMock(return_value=_FEATURED_ROWS)
    monkeypatch.setattr(_cc, "convex_query", convex_mock)

    with patch.object(_sc, "groq_query", autospec=True) as groq_mock:
        groq_mock.return_value = _SANITY_ROWS
        client = _make_client()
        resp = client.get("/registry/coverage-strip")

    assert resp.status_code == 200
    data = resp.json()
    charity_b = next(item for item in data if item["name"] == "Charity B")

    assert charity_b["sanityCharityId"] is None
    assert charity_b["cause"] is None
    assert charity_b["geo"] is None
    assert charity_b["signal"] is None

    # The groq_query call's $ids param must only contain charity-a — never
    # None or any placeholder for the sanityCharityId-less row.
    groq_mock.assert_awaited_once()
    _, groq_kwargs = groq_mock.call_args
    assert groq_kwargs["params"]["ids"] == ["charity-a"]
