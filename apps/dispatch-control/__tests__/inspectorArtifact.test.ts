// Phase 44 Wave-0 scaffold (44-01). Cases are it.todo until 44-03 fills them.
//
// Covers INS-01 — the pure artifact->step resolver (lib/inspectorArtifact.ts,
// docs/API_CONTRACTS.md §44.1/§44.3). No import of the not-yet-existing
// resolver module here — that would turn this file red before Plan 44-03
// lands it. Every case below enumerates a behavior 44-VALIDATION.md's
// Per-Task Verification Map assigns to this file.
import { describe, it } from 'vitest'

describe('inspectorArtifact resolver (§44.3)', () => {
  it.todo(
    "founder locator 'founderBio' resolves to agentKey 'founder_bio' with promptKey null (not externalized)",
  )

  it.todo("founder locator 'game' resolves to agentKey 'game' with promptKey 'game'")

  it.todo("bonus resolves to agentKey 'bonus'; with bonusType 'jingle' promptKey is 'bonus_jingle'")

  it.todo("editor_gate_1 run key maps to promptKey 'editor_gate1' (the one hard alias)")

  it.todo("claim resolves to agentKey 'researcher' (claim_checks has no agent field)")

  it.todo("rec resolves to 'editor_final'; qa resolves to 'qa' (promptKey null)")

  it.todo('signal/org degrade with degraded=true when the run has no such step')

  it.todo(
    "encodeArtifactKey/parseArtifactKey round-trip, including empty locator and a locator containing ':'",
  )
})
