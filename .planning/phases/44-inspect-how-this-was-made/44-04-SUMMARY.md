---
phase: 44-inspect-how-this-was-made
plan: 04
subsystem: ui
tags: [typescript, inspector, diagnostics, truncation-honesty, dispatch-control]

# Dependency graph
requires:
  - phase: 44-01
    provides: "docs/API_CONTRACTS.md §44 (InspectorArtifact contract, incl. §44.4's redefined diff spec) and the Wave-0 missingInputsDiff.test.ts / outputDivergence.test.ts it.todo scaffolds this plan fills in"
  - phase: 44-02
    provides: "agent_run_payloads.inputKeys — the additive-optional, untruncated top-level input key list this diff prefers when present"
provides:
  - "lib/inspector/declaredStateInputs.ts — DECLARED_STATE_INPUTS, a verbatim TS port of agent_wrapper.py::_INPUT_KEYS (the coarse DispatchState vocabulary, NOT VARIABLE_REGISTRY's fine-grained tokens)"
  - "lib/inspector/missingInputsDiff.ts — computeMissingInputs(), the redefined, truncation-honest headline diagnostic (INS-03)"
  - "lib/inspector/outputDivergence.ts — computeOutputDivergence(), the 'diverged'/'unchanged'/'unknown' predicate that never falsely asserts 'unchanged' (INS-05)"
  - "13 live vitest assertions replacing the Wave-0 it.todo scaffolds in both test files"
affects: [44-05-seven-tab-inspector-panel, 44-06-inspector-provider-container-mount, 44-09-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Diff against the same coarse vocabulary the payload actually captures (DECLARED_STATE_INPUTS), never against a fine-grained prompt-substitution registry that speaks a different abstraction layer"
    - "Truncation-honest degradation: prefer an untruncated companion signal when present; when absent, flag every uncertain result explicitly (truncated: true / approximate: true) rather than silently guessing"
    - "Positive-evidence-only predicates: default to 'unknown' on silence, reserve a definitive claim ('unchanged'/'missing') for cases with confirmed evidence"

key-files:
  created:
    - apps/dispatch-control/lib/inspector/declaredStateInputs.ts
    - apps/dispatch-control/lib/inspector/missingInputsDiff.ts
    - apps/dispatch-control/lib/inspector/outputDivergence.ts
  modified:
    - apps/dispatch-control/__tests__/missingInputsDiff.test.ts
    - apps/dispatch-control/__tests__/outputDivergence.test.ts

key-decisions:
  - "The missing-inputs diff is computed against DECLARED_STATE_INPUTS (ported from _INPUT_KEYS) exclusively — VARIABLE_REGISTRY is never imported into missingInputsDiff.ts, and no literal 'VARIABLE_REGISTRY' substring appears in that file's comments either, satisfying the plan's grep-based acceptance check verbatim"
  - "Truncated/absent snapshots fold uncertain keys into the `missing` array with a per-entry `truncated: true` flag (rather than a separate `uncertain` structure) — the plan's <action> explicitly offered either shape; folding keeps the panel consumer (44-05/44-06) working against one array with a distinguishing flag instead of two arrays to merge"
  - "When inputKeys is absent and inputSnapshot has no truncation marker at all (a legacy row that fit under 2000 chars whole), the parsed key set is treated as exact and a definitive (non-truncated) missing claim is allowed — only the presence of the '...[truncated]' marker triggers the approximate/truncated degradation, matching the hard rule's precise scope (truncation, not merely 'no inputKeys')"

patterns-established:
  - "lib/inspector/ as the home for pure, Convex-free diagnostic modules the 44-06 panel container assembles InspectorArtifact fields from"

requirements-completed: [INS-03, INS-05]

# Metrics
duration: ~9min
completed: 2026-07-15
---

# Phase 44 Plan 04: Missing-Inputs Diff and Output Divergence Summary

**Redefined missing-inputs diff (`computeMissingInputs`) diffs the ported `DECLARED_STATE_INPUTS` DispatchState vocabulary instead of the broken `VARIABLE_REGISTRY` token registry, and never asserts a definitive "missing" when a ~2000-char truncated snapshot could have hidden the key; paired with `computeOutputDivergence`, which never falsely claims "unchanged" without positive evidence.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-15T20:00:32Z
- **Completed:** 2026-07-15T20:09:52Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 filled from Wave-0 scaffolds)

## Accomplishments

- `DECLARED_STATE_INPUTS` ported verbatim from `agent_wrapper.py::_INPUT_KEYS` (all 18 agent keys), with a header comment citing the Python source as the authority so the two never silently drift
- `computeMissingInputs()` implements the full §44.4 fallback chain: exact diff when `inputKeys` is present (always wins, even against a truncated snapshot) → exact diff when `inputSnapshot` parses cleanly with no truncation marker → truncated-honest degradation (`approximate: true`, every uncertain key flagged `truncated: true`, never a plain "missing") when the marker is present → full degradation when neither signal exists at all → honest "not catalogued" degradation for an unknown `agentKey`, never a throw
- `computeOutputDivergence()` implements the exact D-11 predicate: `changedSinceCheck === true` or a `lastChangeAt` after `completedAt` → `'diverged'`; `hasChangeAudit === true` with no later change → `'unchanged'`; everything else (including total silence, i.e. the rec/org/signal artifact types with no signal available today) → `'unknown'`, never a default `'unchanged'`
- Both Wave-0 `it.todo` scaffolds converted to 13 live, passing vitest assertions (8 for the missing-inputs diff including the load-bearing >2000-char truncation case, 5 for output divergence including the rec-artifact "no signal → unknown" case)
- Full `pnpm --filter dispatch-control test` (94 files, 812 tests) and `pnpm --filter dispatch-control build` (type-checked) both pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Port DECLARED_STATE_INPUTS + build the truncation-honest missing diff** - `ee2f20b` (feat)
2. **Task 2: Build the output-divergence predicate + fill its test** - `f38441d` (feat)

## Files Created/Modified

- `apps/dispatch-control/lib/inspector/declaredStateInputs.ts` - `DECLARED_STATE_INPUTS: Record<string, string[]>`, verbatim port of `_INPUT_KEYS`
- `apps/dispatch-control/lib/inspector/missingInputsDiff.ts` - `computeMissingInputs(agentKey, inputKeys, inputSnapshot)`, the redefined truncation-honest diff; imports only `VARIABLE_DESCRIPTIONS` (for the human gloss), never the token registry
- `apps/dispatch-control/lib/inspector/outputDivergence.ts` - `computeOutputDivergence(input)`, the pure `'diverged'|'unchanged'|'unknown'` predicate
- `apps/dispatch-control/__tests__/missingInputsDiff.test.ts` - 8 live assertions replacing the 5 Wave-0 `it.todo` cases
- `apps/dispatch-control/__tests__/outputDivergence.test.ts` - 5 live assertions replacing the 3 Wave-0 `it.todo` cases

## Decisions Made

- **Marker-stripping before parse attempt.** `parseSuppliedKeys()` strips a trailing `"...[truncated]"` marker before calling `JSON.parse`, on the chance the cut landed exactly on a complete JSON object; realistic truncated snapshots (cut mid-value) still fail to parse and fall back to `[]` honestly, which is itself safe under the hard rule since every declared key is then flagged `truncated: true` rather than silently reported missing.
- **Folded `truncated` flag vs a separate `uncertain` array.** The plan's `<action>` explicitly permitted either shape; folding into `missing` with a per-entry `truncated?: boolean` flag was chosen so the panel (44-05/44-06) consumes one array and branches on the flag, rather than merging two arrays.
- **Untruncated-but-`inputKeys`-absent snapshots get an exact diff.** A legacy `inputSnapshot` that never needed truncation (no marker present) is treated as a complete, trustworthy key set — `approximate: false` and a definitive missing claim is allowed. Only the literal `"...[truncated]"` marker triggers the approximate degradation, precisely matching the hard rule's scope (truncation risk, not merely "no `inputKeys` field").

## Deviations from Plan

None - plan executed exactly as written. The `<action>` text's either/or on truncated-key representation (separate `uncertain` structure vs folded `truncated` flag) was resolved per "Decisions Made" above, within the discretion the plan itself granted.

## Issues Encountered

None. One thing verified before writing tests: the plan's Test 3 language ("whose parseable prefix does NOT contain `winning_charity`") was read against the plan's own literal parse instruction (`try { Object.keys(JSON.parse(...)) } catch { [] }`) — for any realistic truncated JSON string (cut mid-value, `"...[truncated]"` appended), `JSON.parse` throws and returns `[]`, which trivially satisfies "prefix does not contain winning_charity" while also being the safest possible behavior (every declared key becomes uncertain, never falsely confirmed present or absent).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/inspector/missingInputsDiff.ts` and `lib/inspector/outputDivergence.ts` are ready for Plan 44-05 (the 7-tab panel) to render the Inputs tab's `missing` field and the Output tab's `outputNote`, and for Plan 44-06 (the panel container) to supply real `(runId, agentKey)` Convex query results plus the `changedSinceCheck`/timestamp fields these pure functions expect.
- No blockers. `pnpm --filter dispatch-control test` (94 files / 812 tests passing, 13 todo remaining in `InspectorPanel.test.tsx`/`InspectorProvider.test.tsx` — in scope for 44-05/44-06) and `pnpm --filter dispatch-control build` both green.

---
*Phase: 44-inspect-how-this-was-made*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/lib/inspector/declaredStateInputs.ts
- FOUND: apps/dispatch-control/lib/inspector/missingInputsDiff.ts
- FOUND: apps/dispatch-control/lib/inspector/outputDivergence.ts
- FOUND: apps/dispatch-control/__tests__/missingInputsDiff.test.ts
- FOUND: apps/dispatch-control/__tests__/outputDivergence.test.ts
- FOUND: ee2f20b (Task 1 commit)
- FOUND: f38441d (Task 2 commit)
