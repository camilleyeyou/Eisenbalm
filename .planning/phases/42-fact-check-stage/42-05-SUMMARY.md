---
phase: 42-fact-check-stage
plan: 05
subsystem: ui
tags: [derived-state, selectors, fact-check, importance, typescript, vitest]

# Dependency graph
requires:
  - phase: 42-fact-check-stage
    plan: 01
    provides: "claim_checks additive fields (importance/changedSinceCheck/conflict) + the §42 contract this selector logic implements"
provides:
  - "isMustFix(row) — the SHARED importance-aware severity predicate (pending && (importance ?? 'Supporting') === 'Load-bearing' && !sourceUrl)"
  - "deriveFactCheckSummary(rows) — pure selector returning {factCoverage, total, checked, mustFixCount, changedCount, uncheckedCount, conflictsCount, checksNotRunCount, lastVerifiedAt} per DERIVED-STATE-CONTRACT §4"
  - "Corrected deriveTasks claim severity (uses isMustFix instead of sourceUrl-presence-alone) — the 42-RESEARCH REQUIRED correction"
  - "Widened DerivationInputs.claimRows type + WorkspaceStateProvider claimRows mapping carrying claimIndex/claimId/importance/changedSinceCheck/conflict/checkedAt"
affects: [42-06, 42-07, 42-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure derived-selector extension of lib/derivedState.ts (no Convex import, unit-testable) — mirrors the Phase 40 pattern this module already established"
    - "Shared severity predicate (isMustFix) consumed by both deriveTasks and deriveFactCheckSummary so My Tasks, stage badges, and the Stage 3 summary cannot silently disagree (D-16)"
    - "Provider claimRows mapping stays lean by design: severity/summary fields only, NOT claimType/context (those are full-row-only, read by 42-06's Stage 3 screen + Approval SourceIndex directly)"

key-files:
  created: []
  modified:
    - apps/dispatch-control/lib/derivedState.ts
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
    - apps/dispatch-control/__tests__/derivedState.test.ts

key-decisions:
  - "isMustFix and deriveFactCheckSummary transcribe the 42-RESEARCH illustrative sketch verbatim (not reinvented) — the sketch was explicitly flagged as the recommended default, and every predicate (checksNotRunCount, conflictsCount) matches it exactly"
  - "The pre-existing deriveTasks severity test ('a pending claim with no sourceUrl is must-fix') was UPDATED, not left alone — it encoded exactly the sourceUrl-presence-alone bug 42-RESEARCH flagged as a REQUIRED correction; the new test set asserts the corrected importance-aware behavior (Load-bearing-unsourced=must-fix, Incidental-unsourced=review-recommended, legacy-no-importance-unsourced=review-recommended per the D-03 Supporting fallback)"
  - "FactCheckClaimRow/FactCheckSummary are exported types (not just the two named functions in the plan's artifact list) so the test file and future consumers (42-06) can type claim-row fixtures precisely without duplicating the shape"

patterns-established:
  - "Any future fact-check summary/severity consumer imports isMustFix/deriveFactCheckSummary from lib/derivedState.ts rather than re-deriving severity inline — this is now the one place that logic lives"

requirements-completed: [FCT-02]

# Metrics
duration: 10min
completed: 2026-07-15
---

# Phase 42 Plan 05: Derived Selectors + Workspace Provider Summary

**Added `isMustFix`/`deriveFactCheckSummary` pure selectors to `lib/derivedState.ts` and fixed the shipped `deriveTasks` bug where claim severity was computed from `sourceUrl` presence alone instead of the claim's `importance` tier — then widened `WorkspaceStateProvider`'s `claimRows` mapping so My Tasks and the stage badges read the same severity/summary fields the new Stage 3 screen will use.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-15T05:31Z (approx, per first task commit)
- **Completed:** 2026-07-15T05:32:10Z
- **Tasks:** 2 (Task 1 `type="auto" tdd="true"`, Task 2 `type="auto"`)
- **Files modified:** 3

## Accomplishments
- `isMustFix(row)` exported: `status === 'pending' && (importance ?? 'Supporting') === 'Load-bearing' && !sourceUrl` — the ONE severity predicate now shared by `deriveTasks`'s claim loop and `deriveFactCheckSummary`'s `mustFixCount`.
- `deriveFactCheckSummary(rows)` exported: returns `{factCoverage, total, checked, mustFixCount, changedCount, uncheckedCount, conflictsCount, checksNotRunCount, lastVerifiedAt}` — every counter always present (even at zero), per D-08's "blank never means verified" rule.
- **The 42-RESEARCH REQUIRED correction applied:** `deriveTasks`'s claim-severity line changed from `row.sourceUrl ? 'review-recommended' : 'must-fix'` to `isMustFix(row) ? 'must-fix' : 'review-recommended'` — an unsourced Incidental/Supporting claim (or a legacy row with no `importance` at all) is now Review-recommended, not Must-fix.
- `DerivationInputs.claimRows`'s element type widened additively with `claimIndex?`, `claimId?`, `importance?`, `changedSinceCheck?`, `conflict?`, `checkedAt?`.
- `WorkspaceStateProvider.tsx`'s `claimRows` mapping extended to carry all six new fields from the full `claim_checks` rows `claimChecks:listByRunId` already returns — zero new `useQuery` calls. `claimType`/`context` deliberately NOT added (full-row-only, per the plan's SCOPE NOTE — Stage 3 + Approval SourceIndex subscribe to full rows separately).
- `__tests__/derivedState.test.ts` extended with a full `isMustFix`/`deriveFactCheckSummary` describe block (18 new test cases) plus 3 new/updated `deriveTasks` severity cases — including the `allSignedOff`<->`mustFixCount` regression invariant test.

## Task Commits

Each task was committed atomically:

1. **Task 1: isMustFix + deriveFactCheckSummary + corrected deriveTasks severity + widened claimRows type** - `d2aa5f5` (feat)
2. **Task 2: Extend WorkspaceStateProvider claimRows mapping to carry the new severity/summary fields** - `c70053e` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP update, committed separately per the final-commit step)

## Files Created/Modified
- `apps/dispatch-control/lib/derivedState.ts` - Widened `DerivationInputs.claimRows` type; added `isMustFix`, `FactCheckClaimRow`, `FactCheckSummary`, `deriveFactCheckSummary`; corrected `deriveTasks`'s claim-severity line
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` - `claimRows` mapping extended with `claimIndex`/`claimId`/`importance`/`changedSinceCheck`/`conflict`/`checkedAt`
- `apps/dispatch-control/__tests__/derivedState.test.ts` - New `isMustFix + deriveFactCheckSummary` describe block; updated/added `deriveTasks` severity tests reflecting the importance-aware correction

## Decisions Made
- Transcribed the 42-RESEARCH `deriveFactCheckSummary` sketch verbatim rather than inventing alternate predicates — it was explicitly the recommended default and matches the plan's `<behavior>` spec formula-for-formula (including `checksNotRunCount = pending && !sourceUrl && !changedSinceCheck` and `factCoverage` using `rows.length` as the denominator, not a filtered/removed-excluded count).
- Deliberately updated (rather than preserved) the pre-existing `deriveTasks` test that asserted "no sourceUrl => must-fix" — that assertion encoded exactly the bug this plan exists to fix; leaving it unchanged would have left a green test locking in the wrong behavior. Replaced with three tests covering Load-bearing-unsourced (must-fix), Incidental-unsourced (review-recommended), and legacy-no-importance-unsourced (review-recommended, D-03 fallback).
- Exported `FactCheckClaimRow`/`FactCheckSummary` types (beyond the two functions named in the plan's `exports` list) since the test file needs a precise fixture type and 42-06's Stage 3 screen will need the same shape — avoids a duplicate inline type definition downstream.

## Deviations from Plan

None — plan executed exactly as written. One clarification: the plan's task 1 lists `exports: ["deriveFactCheckSummary", "isMustFix"]` for the artifact; two additional type exports (`FactCheckClaimRow`, `FactCheckSummary`, `ClaimImportance`) were added alongside them since the functions' signatures require named types for callers/tests to reference — this is additive, not a scope change, and doesn't affect either named export's presence or behavior.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The selector layer for FCT-02 is complete: `isMustFix` and `deriveFactCheckSummary` are the shared, pure severity/summary functions Plan 42-06's Stage 3 screen must import (not re-derive) for its own summary line and claim-detail severity chip.
- `WorkspaceStateProvider`'s `claimRows` now carries every field My Tasks/stage badges need to agree with the Stage 3 screen; the screen itself will still subscribe to full `claim_checks` rows directly for `claimType`/`context` (per the SCOPE NOTE), so no further provider changes are needed for 42-06/42-07.
- No blockers.

---
*Phase: 42-fact-check-stage*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 3 modified files confirmed present on disk with expected content (grep-verified against every acceptance criterion in the plan). Both task commits (`d2aa5f5`, `c70053e`) confirmed present in `git log --oneline --all`. Full test suite (84 files, 687 tests) green including the extended `derivedState.test.ts` (45 tests). `pnpm --filter dispatch-control build` exits 0.
