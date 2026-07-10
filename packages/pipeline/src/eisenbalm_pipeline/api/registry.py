"""Phase 39 Plan 02 (MEM-01) — GET /registry/coverage-strip.

Server-side join: Convex ``charities:listRecentFeatured`` (last <=8 featured
charities, ordered by ``lastFeaturedAt`` desc) + one Sanity ``groq_query``
over their ``sanityCharityId``s, returning ``focusArea`` (cause) /
``location`` (geo) / ``scoutNotes`` (signal) chip data for the Registry's
coverage-memory strip.

This MUST be a server endpoint — dispatch-control has zero Sanity access
(EDT-05, tripwire-enforced via
``apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts``).
Read-only — no audit row (mirrors ``GET /issues/{run_id}/draft``,
``api/content.py``).

Featured charities lacking a ``sanityCharityId`` (legacy/backfilled rows —
see 39-RESEARCH.md Pitfall 6) render empty/None chips rather than crashing
the request.

Source: docs/API_CONTRACTS.md §39.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request

import eisenbalm_pipeline.lib.convex_client as _cc
import eisenbalm_pipeline.lib.sanity_client as _sc
from eisenbalm_pipeline.api.control import _require_clerk_jwt_control

log = logging.getLogger(__name__)
router = APIRouter()

# Matches the canonical WORKSPACE_ID literal used by scout.py / config_loader.py.
WORKSPACE_ID = "eisenbalm"


@router.get("/registry/coverage-strip")
async def coverage_strip(
    request: Request,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> list[dict]:
    """Read-only — no audit row. Returns <=8 items:
    ``{name, sanityCharityId, lastFeaturedAt, cause, geo, signal}``, ordered
    by ``lastFeaturedAt`` desc (order comes straight from
    ``charities:listRecentFeatured``)."""
    convex_http = getattr(request.app.state, "convex_http", None)
    rows = (
        await _cc.convex_query(
            convex_http,
            "charities:listRecentFeatured",
            {"workspace_id": WORKSPACE_ID, "limit": 8},
        )
        or []
    )

    ids = [r["sanityCharityId"] for r in rows if r.get("sanityCharityId")]

    # groq_query(query, *, params=None) — NO http/positional-client arg; it
    # uses the module-level Sanity client registered at FastAPI lifespan
    # (calibrator.py:70 precedent). Only issued when there's at least one id
    # to look up.
    sanity_rows = (
        await _sc.groq_query(
            '*[_type=="charity" && _id in $ids]{_id, focusArea, location, scoutNotes}',
            params={"ids": ids},
        )
        if ids
        else []
    )
    by_id = {s["_id"]: s for s in sanity_rows}

    result: list[dict] = []
    for r in rows:
        sanity_charity_id = r.get("sanityCharityId")
        # Rows with no sanityCharityId (or no Sanity match) get None chips —
        # never crash (39-RESEARCH.md Pitfall 6).
        s = by_id.get(sanity_charity_id) or {}
        result.append(
            {
                "name": r.get("name"),
                "sanityCharityId": sanity_charity_id,
                "lastFeaturedAt": r.get("lastFeaturedAt"),
                "cause": s.get("focusArea"),
                "geo": s.get("location"),
                "signal": s.get("scoutNotes"),
            }
        )
    return result
