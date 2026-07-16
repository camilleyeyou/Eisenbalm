"""Phase 46 Plan 02 (SGE-05) — shared repetition-note counting algorithm.

Extracted VERBATIM from ``api/registry.py::repetition_note`` (Phase 40, D-10,
§40.4) so the Signal Editor (Plan 46-04) can reuse the exact same
"avoid X · avoid Y" logic instead of reinventing it. ``api/registry.py``
now delegates to ``compute_repetition_note`` for its existing
``GET /registry/repetition-note`` endpoint — no behavior change there.

Counts only two categorical dimensions — ``cause`` (Sanity ``focusArea``)
and ``geo`` (Sanity ``location``). The signal chip (free-prose scouting
notes) is deliberately excluded: it is not a categorical value.

Source: docs/API_CONTRACTS.md §40.4; .planning/phases/46-.../46-CONTEXT.md D-15.
"""
from __future__ import annotations

# Phase 40 (D-10, §40.4): a cause/geo value is "over-represented" in the
# last-8 coverage-memory sample once it appears at least this many times.
REPETITION_THRESHOLD = 3

# §40.4 step 6: fixed tie-break order when counts are equal — geo before cause.
_REPETITION_DIMENSION_ORDER = {"geo": 0, "cause": 1}


def compute_repetition_note(sanity_rows: list[dict]) -> dict:
    """Deterministic "avoid X · avoid Y" note (D-10, §40.4) derived from a
    list of Sanity charity rows carrying ``focusArea``/``location``.

    Returns ``{"note": str | None, "avoid": list[dict], "sampleSize": int}``
    where ``sampleSize`` is ``len(sanity_rows)`` — callers whose sample size
    is tracked BEFORE a Sanity join (e.g. the Convex row count in
    ``api/registry.py::repetition_note``) must override ``sampleSize`` on the
    returned dict themselves; this function only knows about the rows it was
    given.
    """
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

    return {"note": note, "avoid": avoid, "sampleSize": len(sanity_rows)}
