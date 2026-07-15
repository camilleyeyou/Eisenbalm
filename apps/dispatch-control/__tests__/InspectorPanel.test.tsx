// Phase 44 Wave-0 scaffold (44-01). Cases are it.todo until 44-05 fills them.
//
// Covers INS-02/INS-04/INS-06 — the 7-tab panel shell (docs/API_CONTRACTS.md
// §44.2/§44.7/§44.9). No import of the not-yet-existing
// components/inspector/InspectorPanel.tsx here — that would turn this file
// red before Plan 44-05 lands it.
import { describe, it } from 'vitest'

describe('InspectorPanel (§44.2/§44.7/§44.9)', () => {
  it.todo('default active tab is Summary; Technical is never the default')

  it.todo(
    "every non-Technical tab leads with human-readable content; raw JSON sits behind a 'Show raw JSON' toggle",
  )

  it.todo(
    "Instructions tab renders 'not externalized — code-defined' for origin_story/problem/founder_bio/case_study/qa",
  )

  it.todo(
    'Instructions tab renders the shared rules referenced (VOICE_CONSTRAINTS + STRUCTURE_CONTRACT) for a non-externalized narrative writer, and the rubric shared rule for qa — never a bare one-liner',
  )

  it.todo(
    'Instructions tab renders REAL active-version content + version number when instructionsExternalized === true (externalized agent), never a blank tab',
  )

  it.todo("Diagnostics 'model' renders 'not recorded' with a label+icon, never blank")

  it.todo("footer 'Restart from this step' is disabled with an explanatory title for all artifact types")

  it.todo("footer 'Ask agent to revise' is disabled (reserved, Phase 45)")

  it.todo('live footer actions deep-link using the promptKey namespace (editor_gate1, not editor_gate_1)')
})
