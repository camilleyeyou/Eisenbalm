/**
 * Phase 37 (MON-03, D-05/D-07) — deterministic QA-derived strength score.
 *
 * A per-section 0-100 "strength" is computed entirely from OPEN
 * `qaCorrections` findings (Phase 33's `isOpenFinding` predicate — a
 * dismissed or accepted finding never lowers the score). No LLM scoring,
 * no new pipeline call: this is a pure client-side reduction over rows
 * already subscribed via `qaCorrections.byRunId`.
 *
 * Start at 100, subtract a severity-weighted penalty per open finding,
 * floor at 0 (never negative). `flagCounts` mirrors the same open-finding
 * filter to produce the per-severity chip counts shown alongside the bar.
 */
import { isOpenFinding } from '@/lib/galley/findingState'

export type QaFindingRow = {
  severity: 'info' | 'warning' | 'error'
  accepted?: boolean
  resolution?: 'accepted' | 'dismissed' | null
}

/** Severity-weighted point deduction per OPEN finding (Claude's discretion, D-05). */
export const PENALTY = {
  error: 25,
  warning: 8,
  info: 2,
} as const

/**
 * Compute the 0-100 strength score for a set of qaCorrections rows
 * (already filtered to one section). Only OPEN findings (per
 * `isOpenFinding`) subtract points; floor at 0.
 */
export function strengthScore(rows: QaFindingRow[]): number {
  const openPenalty = rows
    .filter(isOpenFinding)
    .reduce((sum, row) => sum + PENALTY[row.severity], 0)
  return Math.max(0, 100 - openPenalty)
}

/**
 * Count OPEN findings by severity for a set of qaCorrections rows
 * (already filtered to one section).
 */
export function flagCounts(
  rows: QaFindingRow[],
): { info: number; warning: number; error: number } {
  const counts = { info: 0, warning: 0, error: 0 }
  for (const row of rows.filter(isOpenFinding)) {
    counts[row.severity] += 1
  }
  return counts
}

/** Color band for a strength score: green >= 80, amber 50-79, red < 50. */
export function bandFor(score: number): 'green' | 'amber' | 'red' {
  if (score >= 80) return 'green'
  if (score >= 50) return 'amber'
  return 'red'
}
