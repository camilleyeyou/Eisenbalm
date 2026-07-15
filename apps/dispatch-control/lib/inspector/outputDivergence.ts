/**
 * computeOutputDivergence — the Output tab's divergence predicate
 * (docs/API_CONTRACTS.md §44.2 `outputNote`, INS-05, CONTEXT D-11).
 *
 * Bounding rule (D-11, non-negotiable): NEVER assert "unchanged" (or the
 * panel's "current") when there is no positive evidence either way. Silence
 * (no completedAt, no change-audit signal) must render 'unknown', not
 * 'unchanged'.
 *
 * The container (Plan 44-06) supplies these fields from the same
 * `changedSinceCheck` / content-patch-after-completedAt machinery Phases
 * 42/43 already track (`claim_checks.changedSinceCheck`, stamped by
 * `_reset_touched_claims` whenever a block-level revision lands). For
 * artifact types with no such signal available (rec/org/signal today), the
 * container passes nothing — this function correctly returns 'unknown'.
 * This module is pure: it never queries Convex itself.
 */
export interface OutputDivergenceInput {
  completedAt?: number
  changedSinceCheck?: boolean
  lastChangeAt?: number
  hasChangeAudit?: boolean
}

export type OutputDivergence = 'diverged' | 'unchanged' | 'unknown'

export function computeOutputDivergence(input: OutputDivergenceInput): OutputDivergence {
  const { completedAt, changedSinceCheck, lastChangeAt, hasChangeAudit } = input

  if (changedSinceCheck === true) {
    return 'diverged'
  }

  if (lastChangeAt != null && completedAt != null && lastChangeAt > completedAt) {
    return 'diverged'
  }

  if (
    hasChangeAudit === true &&
    completedAt != null &&
    (lastChangeAt == null || lastChangeAt <= completedAt)
  ) {
    return 'unchanged'
  }

  // Default: no positive evidence either way — never assert "unchanged" from silence.
  return 'unknown'
}
