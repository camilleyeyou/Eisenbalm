---
phase: 43-my-tasks-decision-log
plan: 04
subsystem: ui
tags: [typescript, vitest, my-tasks, audit-log, derived-state]

# Dependency graph
requires:
  - phase: 43-03
    provides: DerivedTask.openedAt (TSK-02) — the timestamp this plan's predicate compares reroll signals against
provides:
  - "lib/taskSupersession.ts: computeSessionStates(current, prevSnapshot, rerolls, now, taskSection) -> DisplayTask[]"
  - "DisplayTask + RerollSignal types (screen-local wrapper, never merged into derivedState.ts)"
  - "pure audit_log run.section_rerolled cross-reference predicate for TSK-05 (superseded vs resolved vs active)"
affects: [43-05-my-tasks-screen-nav-handoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "screen-local wrapper types (DisplayTask) layered over a closed backend-facing union (TaskSeverity) instead of extending the union"
    - "pure predicate modules take `now`/clock values as an injected parameter rather than calling Date.now() internally, to stay unit-testable"

key-files:
  created:
    - apps/dispatch-control/lib/taskSupersession.ts
    - apps/dispatch-control/__tests__/taskSupersession.test.ts
  modified: []

key-decisions:
  - "Resolved entries have their `openedAt` overwritten to the injected `now` rather than adding a new `resolvedAt` field — lets the existing `formatTaskAge` helper (derivedState.ts) render \"just now\" for free on the next render without this module owning any age-label string logic."
  - "Superseded takes precedence over resolved for a vanished task: if a task disappeared from the current projection AND its section has a newer `run.section_rerolled` row, it renders superseded (linked to the new step), never merely resolved — matches the §43.6 spec verbatim."
  - "Section matching is direct-string-equality-OR-vocab-bridge (qaSectionToGalleyId), not vocab-bridge-only, since QA-finding sections are already snake_case and equal agentKey directly; the bridge only applies to claim sections (camelCase)."

requirements-completed: [TSK-05]

# Metrics
duration: 5min
completed: 2026-07-15
---

# Phase 43 Plan 04: Superseded/Resolved Session Logic Summary

**Pure `computeSessionStates` predicate cross-references `audit_log` `run.section_rerolled` rows against each task's `openedAt` to discriminate active/superseded/resolved, keeping the distinction entirely off the closed `TaskSeverity` union.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-15T16:32:58Z
- **Completed:** 2026-07-15T16:37:41Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2 (both new)

## Accomplishments
- Built `lib/taskSupersession.ts` — a pure, Convex-free, Date.now()-free module exporting `DisplayTask`, `RerollSignal`, and `computeSessionStates`
- Implements the audit-log cross-reference RESEARCH Pitfall 2 requires: a task's underlying `qaCorrections`/`claim_checks` row does NOT vanish when its section is rerolled, so the predicate compares each matching `run.section_rerolled` row's `timestamp` against the task's `openedAt` rather than relying on vanish-diffing alone
- Bridges the QA-finding (snake_case, e.g. `origin_story`) vs claim (camelCase, e.g. `originStory`) section vocabulary mismatch via the existing `qaSectionToGalleyId` helper when matching a task's section to a reroll's `agentKey`
- 8 unit tests cover: active (no reroll), superseded via direct-vocab match, superseded via claim-vocab-bridge match, non-supersession when the reroll predates the task, resolved (vanished, no reroll), resolved-entries'-`openedAt`-stamped-to-`now`, superseded-precedence-over-resolved, and the all-active baseline (no rerolls, no prev snapshot)
- Proved (via grep, per the plan's acceptance criteria) that `TaskSeverity`/`SEVERITY_MINUTES`/`SEVERITY_ORDER` are not extended — the only occurrence of those identifiers in the new file is a doc comment explaining they are intentionally untouched

## Task Commits

Each task was committed atomically (TDD RED -> GREEN):

1. **Task 1: RED unit tests for computeSessionStates** - `4527b1b` (test)
2. **Task 2: Implement lib/taskSupersession.ts** - `a7ceea5` (feat)

**Plan metadata:** (this commit) `docs(43-04): complete superseded-resolved-session-logic plan`

## Files Created/Modified
- `apps/dispatch-control/lib/taskSupersession.ts` - `DisplayTask`/`RerollSignal` types + `computeSessionStates` pure predicate
- `apps/dispatch-control/__tests__/taskSupersession.test.ts` - 8 unit tests (node env, no Convex)

## Decisions Made
- Resolved entries' `openedAt` is overwritten to the injected `now` (see key-decisions above) instead of introducing a new `resolvedAt` field — reuses `formatTaskAge` for the "resolved just now" label with zero new surface area.
- Superseded precedence over resolved for vanished tasks, matching §43.6 exactly.
- Section matching tries a direct string match first, then the `qaSectionToGalleyId` vocab bridge — not bridge-only — since QA-finding sections are already in `agentKey` form.

## Deviations from Plan

None — plan executed exactly as written (2 tasks, TDD RED->GREEN, no architectural changes, no new dependencies).

### Auto-fixed Issues (non-blocking, test-file-local)

**1. [Rule 3 - Blocking] Adjusted RED test's array-index assertions for `noUncheckedIndexedAccess`**
- **Found during:** Task 2 (typecheck verification)
- **Issue:** `tsconfig.base.json` has `noUncheckedIndexedAccess: true`, so `result[0].sessionState` typed `result[0]` as possibly `undefined`, producing `TS2532` errors that would have blocked `pnpm --filter dispatch-control typecheck` on this plan's own new file.
- **Fix:** Changed all `result[0].x` assertions in `taskSupersession.test.ts` to `result[0]?.x`, matching the existing codebase pattern (e.g. `factCheckFilters.test.ts`).
- **Files modified:** `apps/dispatch-control/__tests__/taskSupersession.test.ts`
- **Verification:** `npx tsc --noEmit -p apps/dispatch-control/tsconfig.json 2>&1 | grep taskSupersession` returns no output — this plan's two files introduce zero typecheck errors.
- **Committed in:** `a7ceea5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking, test-file-local)
**Impact on plan:** No scope creep — a one-line style fix confined to the new test file, applying an existing codebase convention.

## Issues Encountered

`pnpm --filter dispatch-control typecheck` exits non-zero overall — but this is a **pre-existing, repo-wide baseline failure unrelated to this plan**, first documented under 43-03's `deferred-items.md` entry (3 files) and now confirmed (via `git stash` diff) to be an identical, byte-for-byte error set across ~28 files (`error TS` count: 210) with or without this plan's changes. `lib/taskSupersession.ts` and `__tests__/taskSupersession.test.ts` do not appear anywhere in the typecheck error output. Logged an additional entry under `.planning/phases/43-my-tasks-decision-log/deferred-items.md` (`## 43-04`) rather than attempting to fix ~28 unrelated files, per the executor's scope-boundary rule. The plan's actual gating verification — `pnpm --filter dispatch-control test -- __tests__/taskSupersession.test.ts` — is green (8/8).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`computeSessionStates` is ready for 43-05 (My Tasks screen + nav handoff) to consume: the screen owns fetching `run.section_rerolled` audit rows (client-filtered `auditLog.listForWorkspace`, no new query needed), parsing them into `RerollSignal[]`, maintaining `prevSnapshot` across renders (e.g. a ref), and supplying a `taskSection(task)` resolver (this plan's tests confirm `DerivedTask.where` already carries the right raw section identity for that resolver). No backend/pipeline change was made or is needed — the predicate is entirely client-side per §43.6.

---
*Phase: 43-my-tasks-decision-log*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/lib/taskSupersession.ts
- FOUND: apps/dispatch-control/__tests__/taskSupersession.test.ts
- FOUND: 4527b1b (test commit)
- FOUND: a7ceea5 (feat commit)
