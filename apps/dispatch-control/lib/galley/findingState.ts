/**
 * Phase 33 (Pitfall 9) — the ONE shared open-finding predicate.
 *
 * Every surface that shows "open" findings (the page's chip counts, the
 * galley's inline spans + section-end cards, and the Phase 33 decision rail)
 * MUST filter through this helper so a dismissed or accepted finding
 * disappears from all of them at once. Do NOT re-derive `accepted !== true`
 * inline anywhere — that predicate misses `resolution: 'dismissed'`.
 *
 * A finding is open only when it has neither the legacy `accepted` flag nor
 * a §33.1 `resolution` value.
 */
export function isOpenFinding(row: {
  accepted?: boolean
  resolution?: 'accepted' | 'dismissed' | null
}): boolean {
  return row.accepted !== true && row.resolution == null
}
