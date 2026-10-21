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
/** Quick 261021-7aw: 'agent-*' rows are the pipeline self-fix change log (always closed). */
export type FindingResolution = 'accepted' | 'dismissed' | 'agent-applied' | 'agent-skipped'

export function isOpenFinding(row: {
  accepted?: boolean
  resolution?: FindingResolution | null
}): boolean {
  return row.accepted !== true && row.resolution == null
}
