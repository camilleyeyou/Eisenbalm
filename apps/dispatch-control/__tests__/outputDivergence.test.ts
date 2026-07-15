// Phase 44 Wave-0 scaffold (44-01). Cases are it.todo until 44-04 fills them.
//
// Covers INS-05 — the Output tab divergence note (docs/API_CONTRACTS.md
// §44.2 outputNote field; predicate detailed in 44-RESEARCH.md). No import
// of the not-yet-existing divergence module here — that would turn this
// file red before Plan 44-04 lands it.
import { describe, it } from 'vitest'

describe('output divergence (§44.2 outputNote — never a false "current")', () => {
  it.todo("returns 'diverged' when a content change landed after the run's completedAt")

  it.todo("returns 'unknown' (never 'unchanged'/'current') when there is no positive evidence either way")

  it.todo("returns 'unchanged' only with positive evidence of no change after completedAt")
})
