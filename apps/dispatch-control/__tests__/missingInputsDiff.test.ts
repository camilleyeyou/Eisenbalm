// Phase 44 Wave-0 scaffold (44-01). Cases are it.todo until 44-04 fills them.
//
// Covers INS-03 — the redefined missing-inputs diff (docs/API_CONTRACTS.md
// §44.4/§44.5), the headline diagnostic. No import of the not-yet-existing
// lib/inspector/declaredStateInputs.ts or the diff module here — that would
// turn this file red before Plan 44-04 lands it.
import { describe, it } from 'vitest'

describe('missing-inputs diff (§44.4 — declared state inputs, redefined)', () => {
  it.todo('missing = DECLARED_STATE_INPUTS[agentKey] − supplied keys')

  it.todo(
    'uses untruncated inputKeys when present — a supplied-but-truncated-away key is NEVER reported missing',
  )

  it.todo(
    "falls back to parsing inputSnapshot when inputKeys absent AND emits an 'approximate — snapshot truncated' note",
  )

  it.todo(
    "a declared key absent from a >2000-char truncated snapshot (no inputKeys) renders 'not captured (truncated)', never definitive 'missing'",
  )

  it.todo('degrades honestly when DECLARED_STATE_INPUTS[agentKey] is empty/unknown')
})
