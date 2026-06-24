---
phase: 28-prompt-console
plan: 02
subsystem: ui
tags: [react, nextjs, dispatch-control, prompt-console, variable-tooling, unsaved-guard]

# Dependency graph
requires:
  - phase: 28-prompt-console (Plan 01)
    provides: AgentPromptEditorView view-first pane, draft/editing state, agentKey-switch reset effect, descriptionFor map
  - phase: 24-prompt-editor-versioning
    provides: VARIABLE_REGISTRY, findUnknownVariables save gate, PromptEditor, TestRunPanel
provides:
  - VARIABLE_DESCRIPTIONS + VARIABLE_SAMPLES variable-name-keyed maps (additive, DRY)
  - descriptionForVariable + findUnusedVariables helpers
  - AssembledPreview component + assembleWithSamples client-side substitution
  - VariableChips click-to-insert chips with description tooltips + unused hint
  - In-app unsaved-changes guard (window.confirm + visible pill) on view-toggle and agentKey switch
affects: [28-prompt-console Plan 03+ authoring loop, prompt-console list filter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Variable-name-keyed console-side maps next to agentKey-keyed VARIABLE_REGISTRY (D-13/D-14, DRY, no shape change)"
    - "split/join replace-all client-side substitution emulating str.replace (D-14, never str.format)"
    - "In-app window.confirm unsaved guard with prev-key ref + dirtyRef (PRC-03, no native beforeunload, D-11)"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/prompts/_components/AssembledPreview.tsx
    - apps/dispatch-control/app/(dashboard)/prompts/_components/VariableChips.tsx
    - apps/dispatch-control/__tests__/variableMaps.test.ts
    - apps/dispatch-control/__tests__/assembledPreview.test.ts
  modified:
    - apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts
    - apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx

key-decisions:
  - "agentKey-switch confirm fires but the reset proceeds regardless of the operator's choice (route already navigated); the requirement is the heads-up CONFIRM fires"
  - "Chip insertion is append-at-end (setDraft(d => d + token)); CodeMirror cursor insertion left as optional polish per plan"

patterns-established:
  - "Console-side variable maps keyed by variable NAME, additive next to the agentKey-keyed registry"
  - "Advisory-only unused-variable hint (complement of the unknown-var save gate, never a gate)"

requirements-completed: [PRC-03, PRC-05, PRC-06, PRC-07]

# Metrics
duration: 7min
completed: 2026-06-24
---

# Phase 28 Plan 02: Variable Tooling + Unsaved Guard Summary

**Click-to-insert variable chips with description tooltips, an instant client-side assembled-with-sample-values preview, a passive unused-variable hint, and an in-app window.confirm unsaved-changes guard — all additive over the unchanged VARIABLE_REGISTRY shape.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-24T12:30:51Z
- **Completed:** 2026-06-24T12:37:48Z
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments
- Additive `VARIABLE_DESCRIPTIONS` + `VARIABLE_SAMPLES` maps keyed by variable name, covering every distinct token across `VARIABLE_REGISTRY` values, plus `descriptionForVariable` + `findUnusedVariables` helpers — `VARIABLE_REGISTRY`'s `Record<agentKey, string[]>` shape untouched (PRC-05/06/07 data layer).
- `AssembledPreview` component with `assembleWithSamples` doing canonical split/join replace-all substitution (no `str.format`, no server call); absent samples leave the placeholder intact (PRC-06, D-14).
- `VariableChips` component: per-variable click-to-insert buttons with accessible `title` + `aria-label` tooltips, dashed/muted styling for unused variables, and a one-line "Allowed but not used" advisory note — no save gating added (PRC-05/07).
- Wired chips above `PromptEditor` and the assembled preview below `TestRunPanel`; added the PRC-03 in-app unsaved guard (visible "unsaved changes" pill + `window.confirm` on Done/View toggle and on agentKey switch via a prev-key ref); NO `beforeunload` (D-11).

## Task Commits

Each task was committed atomically:

1. **Task 1: Variable description + sample maps + assembled preview** - `fda01f7` (feat)
2. **Task 2: Variable chips (click-to-insert + tooltips + unused hint)** - `0e068d2` (feat)
3. **Task 3: Wire chips + assembled preview + in-app unsaved guard** - `4bf42ab` (feat)

## Files Created/Modified
- `VariableRegistry.ts` - Appended `VARIABLE_DESCRIPTIONS`, `VARIABLE_SAMPLES`, `descriptionForVariable`, `findUnusedVariables` (additive; registry shape + `findUnknownVariables` unchanged)
- `AssembledPreview.tsx` - New collapsible read-only assembled-with-samples preview + exported `assembleWithSamples`
- `VariableChips.tsx` - New click-to-insert chip row with tooltips + passive unused hint
- `AgentPromptEditorView.tsx` - Renders chips + assembled preview in the editing branch; in-app unsaved guard (dirty pill + confirm on view-toggle & agentKey switch)
- `__tests__/variableMaps.test.ts` - Coverage of every used variable name in both maps + `findUnusedVariables` complement
- `__tests__/assembledPreview.test.ts` - Substitution correctness (replace-all, sample present, raw placeholder gone, literal brace intact)

## Decisions Made
- **agentKey-switch confirm semantics:** The reset effect only re-runs on `[agentKey]` and the route has already navigated by then, so the confirm fires as a heads-up but the draft reset proceeds regardless of the operator's choice. This satisfies the plan's stated requirement ("the requirement is the CONFIRM fires") and matches the Task 3 action note.
- **Chip insertion:** append-at-end (`setDraft(d => d + token)`) per the plan's "append-at-end insertion is acceptable"; CodeMirror cursor insertion intentionally left as optional polish.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- A Task 2 acceptance grep (`findUnknownVariables` should NOT appear) initially matched a comment that mentioned the token by name. Rephrased the comment to "unknown-variable save-disable logic" so the grep correctly returns no match — no logic change.
- IDE lint warnings flagged existing `min-h-[44px]` / `max-h-[32rem]` as canonicalizable; these are on pre-existing lines and the plan explicitly specifies `min-h-[44px]`, so they were left as-is (out of scope).

## User Setup Required
None - no external service configuration required. Pure dispatch-control frontend; the assembled preview makes no server call.

## Next Phase Readiness
- Variable tooling + unsaved guard are in place for the editor pane. Plan 03 (the authoring loop: draft-vs-active test-run with cost + voice-rubric score) can build on the same editing branch.
- Strict `pnpm --filter dispatch-control build` passes; full dispatch-control vitest 23 files / 120 passing.

## Self-Check: PASSED

---
*Phase: 28-prompt-console*
*Completed: 2026-06-24*
