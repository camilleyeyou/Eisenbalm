---
phase: 09-issue-page-completion
plan: "00"
subsystem: testing
tags: [vitest, source-scan, deliberation, podcast, theme, wcag, security]

requires:
  - phase: 07-game-rendering
    provides: game-sandbox.test.ts source-scan pattern to mirror
  - phase: 10-editorial-design-pass
    provides: issue-page-typography.test.ts codeOnly() comment-strip helper pattern
  - phase: 09-issue-page-completion
    provides: theme-aa-tones.test.ts (Plan 09-01 pre-created)

provides:
  - 9 Vitest source-scan test files covering DEL-01..06, POD-01..03, WCAG AA gate, LOCKED mobile-nav
  - DEL-04 security tripwire (deliberation-no-model-names.test.ts) — always active, 3 tests green
  - theme-aa-tones.test.ts (pre-existing from 09-01) — 8 tests green, documents ember large-text-only constraint
  - podcast-slot.test.ts — 7 tests green (POD-01/03 + transcript structure), 1 skipped (POD-02 label until 09-03)
  - 6 describe.skip suites that feature plans (09-02, 09-03, 09-04) will unskip

affects:
  - 09-01: theme-aa-tones already green (pre-existed from this plan)
  - 09-02: deliberation-subscriptions, deliberation-advocate-scores, deliberation-qa-severity, deliberation-agent-cards to unskip
  - 09-03: agents-route, podcast-slot POD-02 label to unskip
  - 09-04: site-header-nav to unskip

tech-stack:
  added: []
  patterns:
    - "readFileSync inside it() callbacks (not describe body) for describe.skip suites targeting non-existent files"
    - "codeOnly() comment-strip helper in module scope, used in it() callbacks"
    - "POD-02 split pattern: structural assertion un-skipped, label assertion in separate describe.skip"

key-files:
  created:
    - apps/web/__tests__/deliberation-subscriptions.test.ts
    - apps/web/__tests__/deliberation-advocate-scores.test.ts
    - apps/web/__tests__/deliberation-qa-severity.test.ts
    - apps/web/__tests__/deliberation-no-model-names.test.ts
    - apps/web/__tests__/deliberation-agent-cards.test.ts
    - apps/web/__tests__/agents-route.test.ts
    - apps/web/__tests__/site-header-nav.test.ts
    - apps/web/__tests__/podcast-slot.test.ts
  modified: []
  pre-existing:
    - apps/web/__tests__/theme-aa-tones.test.ts (created by Plan 09-01, not modified)

key-decisions:
  - "readFileSync for agents-route.test.ts moved inside each it() callback (not describe body) — describe.skip still executes its body for registration; only it() callbacks are skipped"
  - "theme-aa-tones.test.ts pre-existed from Plan 09-01 with richer assertions (8 tests) — no change needed"
  - "podcast-slot.test.ts splits POD-02 into two describe blocks: structural (un-skipped, passes now) and label (describe.skip, passes after 09-03)"

requirements-completed: [DEL-01, DEL-02, DEL-04, DEL-05, DEL-06, POD-01, POD-02, POD-03]

duration: 5min
completed: 2026-05-21
---

# Phase 09 Plan 00: Validation Test Scaffold Summary

**9 Vitest source-scan test files establishing the Phase 9 Nyquist feedback substrate — DEL-04 + WCAG AA tones green immediately; 6 describe.skip suites provide RED→GREEN gates for Plans 09-02, 09-03, 09-04**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-21T22:23:37Z
- **Completed:** 2026-05-21T22:28:42Z
- **Tasks:** 3 completed
- **Files created:** 8 new test files (theme-aa-tones.test.ts pre-existed from 09-01)

## Accomplishments

- Created all 9 Phase 9 test files exactly as named in the plan's `files_modified` list
- DEL-04 security tripwire (deliberation-no-model-names.test.ts) passes green immediately against the Phase 2 stub
- WCAG AA tones test (theme-aa-tones.test.ts, pre-existing from 09-01) passes 8 tests, documenting the ember large-text-only constraint and the rejected #615B4D regression guard
- podcast-slot.test.ts passes 7/8 tests immediately (POD-01, POD-03, transcript structure); 1 test skipped until Plan 09-03 changes the transcript label
- Full Phase 9 suite: 21 passing, 41 skipped, 0 failing — game-sandbox.test.ts remains green
- Pre-existing Phase 8 Wave 0 sentinels (29 failures) unchanged — out of scope per SCOPE BOUNDARY rule

## Task Commits

1. **Task 1: Four deliberation source-scan test files** - `c816a7d` (test)
2. **Task 2: Agent-cards and podcast-slot test files** - `0e035cc` (test)
3. **Task 3: Agents-route and site-header-nav guard tests** - `8de4a2a` (test)

## Files Created

- `apps/web/__tests__/deliberation-subscriptions.test.ts` — DEL-01/DEL-05 useQuery+skip sentinel (describe.skip, UNSKIP in 09-02)
- `apps/web/__tests__/deliberation-advocate-scores.test.ts` — DEL-02 score from advocate-argument payload, not agentVotes (describe.skip, UNSKIP in 09-02)
- `apps/web/__tests__/deliberation-qa-severity.test.ts` — DEL-02 severity→token map, no legacy minor/moderate/major (describe.skip, UNSKIP in 09-02)
- `apps/web/__tests__/deliberation-no-model-names.test.ts` — DEL-04 security tripwire, always active, 3 tests green now
- `apps/web/__tests__/deliberation-agent-cards.test.ts` — DEL-06 chip href+displayName+role (describe.skip, UNSKIP in 09-02)
- `apps/web/__tests__/agents-route.test.ts` — DEL-06 route query/notFound/no-model (describe.skip, UNSKIP in 09-03; readFileSync inside each it())
- `apps/web/__tests__/site-header-nav.test.ts` — LOCKED mobile-nav disclosure (describe.skip, UNSKIP in 09-04)
- `apps/web/__tests__/podcast-slot.test.ts` — POD-01/03 green now; POD-02 label in separate describe.skip until 09-03

## Decisions Made

- **readFileSync placement for non-existent files:** Moved readFileSync calls inside individual `it()` callbacks rather than at the `describe.skip` body level. Vitest executes `describe.skip` bodies during collection (to register `it` blocks), so a `readFileSync` at the describe body level throws even inside `describe.skip` when the file is absent. Moving to `it()` callbacks means it only runs when the test actually executes — which describe.skip prevents.
- **theme-aa-tones.test.ts pre-existed:** Plan 09-01 created this file with 8 assertions (richer than the plan's specification). No modification needed; it satisfies all plan requirements.
- **podcast-slot.test.ts split:** POD-02 has two sub-requirements: (1) transcript disclosure structure exists (passes now — `<details>` present) and (2) transcript label reads "Read full deliberation transcript" (fails now — current label is "Read the deliberation transcript"). The split pattern keeps the un-skipped describe passing today while providing a clear RED gate for Plan 09-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] readFileSync placement in agents-route.test.ts**
- **Found during:** Task 3 verification (full test suite run)
- **Issue:** `const source = readFileSync(PATH, 'utf-8')` was inside the `describe.skip` body but outside `it()` callbacks. Vitest evaluates `describe.skip` bodies during test collection (to discover `it` blocks) — so a readFileSync call for a non-existent file throws `ENOENT` at collection time even with `describe.skip`.
- **Fix:** Moved `readFileSync(PATH, 'utf-8')` inside each individual `it()` callback. Moved `codeOnly()` helper to module scope (above the describe). `const PATH = resolve(...)` kept in the describe body (safe — no I/O).
- **Files modified:** `apps/web/__tests__/agents-route.test.ts`
- **Verification:** `npm run test:unit -- __tests__/agents-route.test.ts` exits 0 with 4 skipped
- **Committed in:** `8de4a2a` (Task 3 commit)

**2. [Rule 1 - Pre-existing] theme-aa-tones.test.ts already created by Plan 09-01**
- **Found during:** Task 2 (creating theme-aa-tones.test.ts)
- **Issue:** File already existed with 8 passing assertions (created by Plan 09-01's feat(09-01) commit). Write tool required a Read before write.
- **Fix:** Accepted the pre-existing file as-is. It satisfies all plan requirements with richer assertions than specified. Not modified.
- **Files modified:** none
- **Verification:** `npm run test:unit -- __tests__/theme-aa-tones.test.ts` exits 0 with 8 passed

---

**Total deviations:** 2 (1 readFileSync placement bug, 1 pre-existing file from 09-01)
**Impact on plan:** Both resolutions align with plan intent. No scope creep. All 9 files satisfy their specified requirements.

## Issues Encountered

- Vitest `describe.skip` behavior: the describe callback body still runs during collection; only `it()` callbacks are skipped. This is well-defined Vitest behavior but easy to miss. The plan's guidance to put "readFileSync inside the skip callback" is correct in intent but must be implemented at the `it()` level for files that don't yet exist.

## Known Stubs

None — this plan creates test files only. No source files were modified that could introduce stubs.

## Next Phase Readiness

- All 9 Phase 9 test files in place as the Nyquist feedback substrate
- Plans 09-02 (DeliberationSlot), 09-03 (agents route + podcast restyle), 09-04 (SiteHeader mobile-nav) can now drive their describe.skip suites green
- DEL-04 tripwire (deliberation-no-model-names.test.ts) active — will catch any model-name leak in the Phase 9 DeliberationSlot rewrite
- WCAG AA tones test active — will catch any palette regression in Phase 9 design work

---
*Phase: 09-issue-page-completion*
*Completed: 2026-05-21*
