// Phase 45 Wave-0 scaffold (45-01). Cases are it.todo until 45-04/45-05 fill
// them.
//
// Covers REV-04 — the end-to-end preview -> comparison card -> apply flow
// (docs/API_CONTRACTS.md §45.2/§45.4). No import of the not-yet-existing
// revisionClient.ts / RevisionFlow component here — that would turn this
// file red before Plan 45-04 lands it.
import { describe, it } from 'vitest'

describe('RevisionFlow (§45.2/§45.4)', () => {
  it.todo('fetches a fresh ifRevisionID immediately before calling apply')

  it.todo('priorProposals accumulates across successive Try another approach clicks (D-05)')

  it.todo('edit-before-applying sends the operator-edited newText through the same apply route (D-11)')

  it.todo('a cost_cap_exceeded 409 from preview disables the direction chips with an explanation (D-14)')

  it.todo('apply success reflects the touched-claims reset and revoked sign-offs in the workspace state')
})
