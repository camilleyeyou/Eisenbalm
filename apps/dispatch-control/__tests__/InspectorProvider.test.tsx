// Phase 44 Wave-0 scaffold (44-01). Cases are it.todo until 44-06 fills them.
//
// Covers INS-01 — the one-instance/openInspector context contract
// (docs/API_CONTRACTS.md §44.6). No import of the not-yet-existing
// inspector context/provider module here — that would turn this file red
// before Plan 44-06 lands it.
import { describe, it } from 'vitest'

describe('InspectorProvider / openInspector (§44.6)', () => {
  it.todo('openInspector(key) sets the active artifact key; closeInspector clears it')

  it.todo('exactly one panel instance renders regardless of how many entry points call openInspector')
})
