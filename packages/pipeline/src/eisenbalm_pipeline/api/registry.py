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
from eisenbalm_pipeline.lib.registry_repetition import compute_repetition_note

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
    try:
        rows = (
            await _cc.convex_query(
                convex_http,
                "charities:listRecentFeatured",
                {"workspace_id": WORKSPACE_ID, "limit": 8},
            )
            or []
        )
    except Exception:  # noqa: BLE001
        log.warning(
            "coverage-strip Convex query failed — degrading to empty result.",
            exc_info=True,
        )
        rows = []

    ids = [r["sanityCharityId"] for r in rows if r.get("sanityCharityId")]

    # groq_query(query, *, params=None) — NO http/positional-client arg; it
    # uses the module-level Sanity client registered at FastAPI lifespan
    # (calibrator.py:70 precedent). Only issued when there's at least one id
    # to look up.
    try:
        sanity_rows = (
            await _sc.groq_query(
                '*[_type=="charity" && _id in $ids]{_id, focusArea, location, scoutNotes}',
                params={"ids": ids},
            )
            if ids
            else []
        )
    except Exception:  # noqa: BLE001
        log.warning(
            "coverage-strip Sanity groq_query failed — degrading to empty chips.",
            exc_info=True,
        )
        sanity_rows = []
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
    try:
        rows = (
            await _cc.convex_query(
                convex_http,
                "charities:listRecentFeatured",
                {"workspace_id": WORKSPACE_ID, "limit": 8},
            )
            or []
        )
    except Exception:  # noqa: BLE001
        log.warning(
            "repetition-note Convex query failed — degrading to empty result.",
            exc_info=True,
        )
        rows = []
    sample_size = len(rows)

    ids = [r["sanityCharityId"] for r in rows if r.get("sanityCharityId")]

    # groq_query(query, *, params=None) — NO http/positional-client arg (same
    # calling convention as coverage_strip above). Only cause/geo fields are
    # requested — the signal field is never counted.
    try:
        sanity_rows = (
            await _sc.groq_query(
                '*[_type=="charity" && _id in $ids]{_id, focusArea, location}',
                params={"ids": ids},
            )
            if ids
            else []
        )
    except Exception:  # noqa: BLE001
        log.warning(
            "repetition-note Sanity groq_query failed — degrading to neutral "
            "note (sampleSize=%d preserved from Convex).",
            sample_size,
            exc_info=True,
        )
        sanity_rows = []

    # Phase 46 Plan 02 (SGE-05): the counting algorithm now lives in
    # lib/registry_repetition.compute_repetition_note — the Signal Editor
    # (Plan 46-04) reuses it directly rather than reinventing it here.
    # sampleSize is overridden with the Convex row count (`len(rows)`,
    # captured BEFORE the Sanity join) to keep this endpoint's historical
    # contract byte-stable — the helper's own sampleSize is len(sanity_rows).
    return {**compute_repetition_note(sanity_rows), "sampleSize": sample_size}
