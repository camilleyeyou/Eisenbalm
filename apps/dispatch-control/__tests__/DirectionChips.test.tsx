// Phase 45 Wave-0 scaffold (45-01). Cases are it.todo until 45-04 fills them.
//
// Covers REV-02 — the 7 fixed-copy direction chips (docs/API_CONTRACTS.md
// §45.1). No import of the not-yet-existing
// components/revision/DirectionChips.tsx here — that would turn this file
// red before Plan 45-04 lands it.
import { describe, it } from 'vitest'

describe('DirectionChips (§45.1)', () => {
  it.todo(
    'renders exactly 7 fixed-copy chips: Make clearer / Make more specific / Tighten / Match the brief / Reduce repetition / Try another approach / Custom',
  )

  it.todo('never renders a bare "Regenerate" label (REV-02)')

  it.todo('Custom chip reveals a free-text input that is sent verbatim as customDirection')

  it.todo('every chip renders disabled-with-title when the cost guard has 409ed (D-14)')
})
