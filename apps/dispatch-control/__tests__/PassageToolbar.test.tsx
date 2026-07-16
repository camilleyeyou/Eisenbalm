// Phase 45 Wave-0 scaffold (45-01). Cases are it.todo until 45-05 fills them.
//
// Covers REV-01 — the shared galley selection toolbar (docs/API_CONTRACTS.md
// §45.6). No import of the not-yet-existing
// components/galley/PassageToolbar.tsx here — that would turn this file red
// before Plan 45-05 lands it.
import { describe, it } from 'vitest'

describe('PassageToolbar (§45.6)', () => {
  it.todo('renders all six actions on a passage selection')

  it.todo(
    'Compare with previous and Restore previous render reserved-with-title (D-17, no shipped content-version endpoint)',
  )

  it.todo('Ask agent to revise fires onRevise with the selected passage')

  it.todo('Edit text routes to the existing BlockEditor flow')

  it.todo('Related facts & sources renders the shared ClaimProvenanceCard')

  it.todo('Inspect how this was made calls the Phase 44 onInspect prop')
})
