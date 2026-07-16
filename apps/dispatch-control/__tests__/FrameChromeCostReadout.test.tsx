// Phase 45 Wave-0 scaffold (45-01). Cases are it.todo until 45-06 fills them.
//
// Covers REV-05 — the workspace header cost-vs-budget readout
// (docs/API_CONTRACTS.md §45.5, D-15). No import of the not-yet-existing
// deriveRunCostUsd wiring in layout.tsx / WorkspaceStateProvider.tsx here —
// that would turn this file red before Plan 45-06 lands it.
import { describe, it } from 'vitest'

describe('FrameChrome cost-vs-budget readout (§45.5)', () => {
  it.todo('loading state renders a refresh affordance, never a stale or fabricated zero (never-blank honesty)')

  it.todo('renders "$spent / $cap" once both values are known')

  it.todo('renders next to the existing "{tasks.length} open · ~{workMinutes} min" line')
})
