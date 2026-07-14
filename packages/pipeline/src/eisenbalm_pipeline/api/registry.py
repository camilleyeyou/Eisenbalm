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

# Phase 40 (D-10, §40.4): a cause/geo value is "over-represented" in the
# last-8 coverage-memory sample once it appears at least this many times.
REPETITION_THRESHOLD = 3

# §40.4 step 6: fixed tie-break order when counts are equal — geo before cause.
_REPETITION_DIMENSION_ORDER = {"geo": 0, "cause": 1}


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


@router.get("/registry/repetition-note")
async def repetition_note(
    request: Request,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Read-only — no audit row. Deterministic "avoid X · avoid Y" note (D-10,
    §40.4) derived from the last <=8 featured charities' cause/geo values.

    No LLM call, no run required — this must render BEFORE a run exists. It
    is the Calibrator's *rule* applied outside a run; ``agents/calibrator.py``
    is unchanged by this endpoint.

    Counts only two categorical dimensions — ``cause`` (Sanity ``focusArea``)
    and ``geo`` (Sanity ``location``). The signal chip (free-prose scouting
    notes) is deliberately excluded: it is not a categorical value.
    """
    convex_http = getattr(request.app.state, "convex_http", None)
    rows = (
        await _cc.convex_query(
            convex_http,
            "charities:listRecentFeatured",
            {"workspace_id": WORKSPACE_ID, "limit": 8},
        )
        or []
    )
    sample_size = len(rows)

    ids = [r["sanityCharityId"] for r in rows if r.get("sanityCharityId")]

    # groq_query(query, *, params=None) — NO http/positional-client arg (same
    # calling convention as coverage_strip above). Only cause/geo fields are
    # requested — the signal field is never counted.
    sanity_rows = (
        await _sc.groq_query(
            '*[_type=="charity" && _id in $ids]{_id, focusArea, location}',
            params={"ids": ids},
        )
        if ids
        else []
    )

    # dimension -> lowercased value -> [count, first-seen display casing]
    counters: dict[str, dict[str, list]] = {"geo": {}, "cause": {}}
    for s in sanity_rows:
        for dimension, field in (("cause", "focusArea"), ("geo", "location")):
            raw = s.get(field)
            if not raw:
                continue
            display_value = raw.strip()
            if not display_value:
                continue
            key = display_value.lower()
            entry = counters[dimension].get(key)
            if entry is None:
                counters[dimension][key] = [1, display_value]
            else:
                entry[0] += 1

    over_represented: list[tuple[str, str, int]] = [
        (dimension, display_value, count)
        for dimension, values in counters.items()
        for count, display_value in values.values()
        if count >= REPETITION_THRESHOLD
    ]

    # Sort by count DESC, then geo-before-cause, then value ascending; take
    # at most 2 (the UI-SPEC's "avoid X · avoid Y" shape).
    over_represented.sort(
        key=lambda item: (
            -item[2],
            _REPETITION_DIMENSION_ORDER[item[0]],
            item[1],
        )
    )
    top = over_represented[:2]

    avoid = [{"dimension": d, "value": v, "count": c} for (d, v, c) in top]
    note = " · ".join(f"avoid {item['value']}" for item in avoid) or None

    return {"note": note, "avoid": avoid, "sampleSize": sample_size}
