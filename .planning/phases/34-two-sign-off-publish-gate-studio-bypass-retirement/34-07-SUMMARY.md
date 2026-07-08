---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
plan: 07
subsystem: testing
tags: [vitest, react-testing-library, convex, decision-rail, sign-off]

# Dependency graph
requires:
  - phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
    provides: "Plan 34-06's DecisionRail.tsx useQuery(api.signOffs.activeByRunId) subscription + Sign-offs UI section"
provides:
  - "Repaired Convex API mock (signOffs entry) + @/lib/signOffClient mock in DecisionRail.test.tsx"
  - "5 new regression tests covering the two-sign-off publish gate operator surface"
affects: [34-08, dispatch-control-test-suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "mockQueries() QueryState now defaults signOffs:activeByRunId to both-active so pre-existing blocker-free Publish assertions stay green under the new both-greens gate"

key-files:
  created: []
  modified:
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx

key-decisions:
  - "Test-side fix only, per plan constraint — zero production source files touched (confirmed via git diff across both task commits)"
  - "mockQueries default for signOffs is BOTH active (not empty) so the 3 pre-existing zero-blocker Publish tests (which predate the 34-06 both-greens gate) don't regress"

patterns-established:
  - "New Convex query mocks follow the existing sentinel-string switch pattern in mockQueries(); QueryState interface grows one optional field per new subscription"

requirements-completed: [PUB-01]

# Metrics
duration: 8min
completed: 2026-07-08
---

# Phase 34 Plan 07: DecisionRail Sign-off Test Coverage Summary

**Repaired the DecisionRail Convex API mock (added `signOffs.activeByRunId`) and `@/lib/signOffClient` mock so all 16 pre-existing tests render again, then added 5 new tests covering the Phase 34 two-sign-off publish gate UI.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-08T08:41:32-07:00
- **Completed:** 2026-07-08T08:49:25-07:00
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments
- Fixed the client-side test-suite regression that Plan 34-06 introduced: all 16 pre-existing `DecisionRail.test.tsx` tests were crashing at render with `TypeError: Cannot read properties of undefined (reading 'activeByRunId')` — now green
- Added regression coverage for the Sign-offs UI (PUB-01): both controls render unsigned, click invokes `recordSignOff(token, runId, kind)`, the affirmative "signed Nm ago" state renders per-kind and is never blank, Publish stays gated until both sign-offs are green (even with zero blockers), and the Facts-cleared control is disabled while an open error-severity blocker exists (D-01)
- Zero production source files modified — confirmed by `git diff --name-only` across both task commits showing only the test file

## Task Commits

Each task was committed atomically:

1. **Task 1: Repair the Convex API + signOffClient mocks so the 16 existing tests render again** - `6498876` (test)
2. **Task 2: Add a Sign-offs describe block covering render, record, affirmative state, and the both-greens Publish gate** - `cb9b14c` (test)

_No plan metadata commit was created separately for this SUMMARY — it is captured in the final state-update commit._

## Files Created/Modified
- `apps/dispatch-control/__tests__/DecisionRail.test.tsx` - Added `signOffs` entry to the `@convex/_generated/api` mock, a `@/lib/signOffClient` mock (typed `SignOffApiError` + `recordSignOff` vi.fn), a `signOffs:activeByRunId` case in `mockQueries` (defaulting to both sign-offs active), and a new `describe('DecisionRail sign-offs (Phase 34, D-01/D-05/D-06)', …)` block with 5 tests

## Decisions Made
- Kept the mock repair strictly additive (no renamed/deleted tests) and did not touch the `Loading…` test's inline `useQuery` override, matching the plan's explicit guardrail
- Confirmed test-only scope satisfies the plan's constraint not to modify `DecisionRail.tsx`, `signOffClient.ts`, or any other production code

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `pnpm --filter dispatch-control test` exits 0: 44 test files passed / 1 skipped, 376 tests passed (2 todo)
- `pnpm --filter dispatch-control build` exits 0: strict type-check clean, all 21 routes build
- The 34-VERIFICATION.md gap (client-side test-suite regression + zero Sign-offs UI coverage) is closed; no blockers for Phase 34 sign-off/closure

---
*Phase: 34-two-sign-off-publish-gate-studio-bypass-retirement*
*Completed: 2026-07-08*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/__tests__/DecisionRail.test.tsx
- FOUND: .planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-07-SUMMARY.md
- FOUND: 6498876 (Task 1 commit)
- FOUND: cb9b14c (Task 2 commit)
