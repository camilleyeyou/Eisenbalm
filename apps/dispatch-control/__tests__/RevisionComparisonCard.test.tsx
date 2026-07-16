// Phase 45 Wave-0 scaffold (45-01). Cases are it.todo until 45-04 fills them.
//
// Covers REV-03 — the comparison card shown before anything applies
// (docs/API_CONTRACTS.md §45.3, DERIVED-STATE-CONTRACT §9). No import of the
// not-yet-existing components/revision/RevisionComparisonCard.tsx here —
// that would turn this file red before Plan 45-04 lands it.
import { describe, it } from 'vitest'

describe('RevisionComparisonCard (§45.3)', () => {
  it.todo('shows the original (strikethrough) passage alongside the proposed replacement')

  it.todo('renders the "What changed" line from whatChanged')

  it.todo('renders the claim delta (added/removed/altered) as advisory narrative, never enforced state')

  it.todo('Apply / Edit before applying / Try another approach / Discard are all present')
})
