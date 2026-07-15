// Phase 44 Plan 44-04. Covers INS-05 — the Output tab divergence note
// (docs/API_CONTRACTS.md §44.2 outputNote field; predicate detailed in
// 44-RESEARCH.md, CONTEXT D-11).
import { describe, expect, it } from 'vitest'
import { computeOutputDivergence } from '../lib/inspector/outputDivergence'

describe('output divergence (§44.2 outputNote — never a false "current")', () => {
  it("returns 'diverged' when a content change landed after the run's completedAt", () => {
    const result = computeOutputDivergence({
      completedAt: 1000,
      lastChangeAt: 2000,
      hasChangeAudit: true,
    })
    expect(result).toBe('diverged')
  })

  it("returns 'diverged' when changedSinceCheck is explicitly true, regardless of timestamps", () => {
    expect(computeOutputDivergence({ changedSinceCheck: true })).toBe('diverged')
  })

  it("returns 'unknown' (never 'unchanged'/'current') when there is no positive evidence either way", () => {
    expect(computeOutputDivergence({})).toBe('unknown')
    // completedAt alone, with no change-audit signal at all, is not evidence.
    expect(computeOutputDivergence({ completedAt: 1000 })).toBe('unknown')
    // A change-audit signal with nothing to anchor it against is not evidence.
    expect(computeOutputDivergence({ hasChangeAudit: true })).toBe('unknown')
  })

  it("returns 'unchanged' only with positive evidence of no change after completedAt", () => {
    const noChangeEver = computeOutputDivergence({
      completedAt: 1000,
      hasChangeAudit: true,
    })
    expect(noChangeEver).toBe('unchanged')

    const changeBeforeCompletion = computeOutputDivergence({
      completedAt: 2000,
      hasChangeAudit: true,
      lastChangeAt: 500,
    })
    expect(changeBeforeCompletion).toBe('unchanged')
  })

  it("rec/org/signal artifacts with no divergence signal available render 'unknown', never 'unchanged'", () => {
    // The container (Plan 44-06) passes an empty input for artifact types
    // with no changedSinceCheck-equivalent signal today (rec/org/signal) —
    // this must degrade to 'unknown', never default to 'unchanged'.
    expect(computeOutputDivergence({})).toBe('unknown')
  })
})
