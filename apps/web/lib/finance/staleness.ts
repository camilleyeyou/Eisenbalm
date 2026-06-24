/**
 * Phase 27 — D-13: model_pricing staleness boundary.
 *
 * The finance view renders model_pricing read-only ("Projection pricing (not
 * actual cost)") with a staleness badge when a row's updatedAt is older than
 * 30 days. Pure helper, unit-tested by
 * apps/web/__tests__/model-pricing-staleness.test.ts (Wave 0 scaffold).
 */

/** 30-day staleness threshold in milliseconds. */
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * A model_pricing row is stale when it was last updated MORE than 30 days ago.
 *
 * Boundary is exclusive of the threshold: exactly 30 days old → NOT stale;
 * one ms over → stale; freshly written (updatedAt === now) → NOT stale.
 */
export function isStale(updatedAt: number, now: number): boolean {
  return now - updatedAt > THIRTY_DAYS_MS
}
