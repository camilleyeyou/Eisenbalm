---
phase: 40-issue-entity-issues-home
plan: 01
subsystem: testing
tags: [convex-test, vitest, pytest, contract-first, tdd, fastapi]

# Dependency graph
requires:
  - phase: 39-registry-coverage-memory-strip
    provides: "GET /registry/coverage-strip pattern this plan's contract + pytest scaffold mirror (same Convex+Sanity join, same auth guard)"
  - phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
    provides: "sign_offs table + activeByRunId — the factDone/voiceDone inputs deriveIssueStatus consumes"
provides:
  - "docs/API_CONTRACTS.md §40 — binding contract for the issues Convex table, convex/issues.ts, pipelineRuns issue-keyed queries, GET /registry/repetition-note, and the derivedState/issueRouteResolver selector modules"
  - "Seven RED test files (six dashboard vitest + one pipeline pytest) that Plans 40-02..40-07 turn GREEN"
  - "vitest.config.ts edge-runtime entry for __tests__/issues.test.ts"
affects: [40-02, 40-03, 40-04, 40-05, 40-06, 40-07, 40-08, 40-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first: docs/API_CONTRACTS.md §40 written before any schema/module/endpoint code (mirrors §31-§39)"
    - "Wave-0 RED scaffolding: test files reference not-yet-existing modules/components/endpoints so every downstream task has a real automated verify command on disk"

key-files:
  created:
    - docs/API_CONTRACTS.md (§40 appended)
    - apps/dispatch-control/__tests__/issues.test.ts
    - apps/dispatch-control/__tests__/derivedState.test.ts
    - apps/dispatch-control/__tests__/issueRouteResolver.test.ts
    - apps/dispatch-control/__tests__/IssueCard.test.tsx
    - apps/dispatch-control/__tests__/ScheduledSlotCard.test.tsx
    - apps/dispatch-control/__tests__/HoldDialog.test.tsx
    - packages/pipeline/tests/test_repetition_note.py
  modified:
    - apps/dispatch-control/vitest.config.ts

key-decisions:
  - "Component test fixtures were aligned to the exact prop contracts already fixed in Plans 40-05 (IssueCard, ScheduledSlotCard) and 40-07 (HoldDialog), which existed on disk at execution time — reading them first avoided writing a RED spec that would need rewriting when those plans execute."
  - "IssueCard/ScheduledSlotCard/HoldDialog test assertions use container.textContent / getByText(regex) rather than brittle exact-node matches, so they tolerate reasonable markup choices in the not-yet-written components."
  - "deriveTasks test assertions match on task.title substrings (not task.id) since §40.6 does not fix an id format, but Plan 40-04 does fix the title format (\"Check claim: {claimText}\") — using the documented field avoids over-specifying an undocumented one."

patterns-established:
  - "Wave-0 RED verification: every new test file was individually run to confirm it fails for a module-not-found / endpoint-404 reason, not an environment misconfiguration, before committing."

requirements-completed: [ISS-01, ISS-02, ISS-03, ISS-04, ISS-05, ISS-06]

# Metrics
duration: 15min
completed: 2026-07-14
---

# Phase 40 Plan 01: Contract + Test Scaffolding Summary

**§40 issue-entity contract appended to docs/API_CONTRACTS.md, plus seven RED test files (six dashboard vitest + one pipeline pytest) covering the issues Convex table, the derived-state selector, the route resolver, and three presentational components — all verified failing for module-not-found/404 reasons, zero implementation code written.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-14
- **Tasks:** 3
- **Files modified:** 8 (1 doc, 6 new dashboard test files + 1 config edit, 1 new pipeline test file)

## Accomplishments

- Wrote `docs/API_CONTRACTS.md` §40 (nine subsections, §40.1–§40.9) fixing the `issues` Convex table shape, `convex/issues.ts` function signatures (`byIssueNumber`, `listForWorkspace`, `ensureByNumber`, `hold`, `reopen`, `markPublished`), the two new `pipelineRuns` issue-keyed queries, the `GET /registry/repetition-note` algorithm (`REPETITION_THRESHOLD = 3`, geo/cause-only, geo-before-cause sort, at-most-2 cap), the `lib/derivedState.ts` and `lib/issueRouteResolver.ts` pure-function contracts, the issue-keyed console route tree, and the `NAV_GROUPS` restructure — with an explicit naming-trap paragraph distinguishing the pipeline's runId-keyed `/issues/{run_id}/...` endpoints from the new issueNumber-keyed console `/issues/[issueNumber]` tree.
- Added the `__tests__/issues.test.ts` → `edge-runtime` entry to `vitest.config.ts`.
- Wrote 6 RED dashboard test files (`issues.test.ts` convex-test, `derivedState.test.ts`, `issueRouteResolver.test.ts` — all node/edge env; `IssueCard.test.tsx`, `ScheduledSlotCard.test.tsx`, `HoldDialog.test.tsx` — jsdom) and 1 RED pipeline pytest file (`test_repetition_note.py`), each individually run and confirmed to fail for a not-yet-implemented reason (module-not-found, "Could not find module for: issues", or HTTP 404) rather than an environment/config error.
- Confirmed zero implementation code exists after this plan: no `convex/issues.ts`, no `lib/derivedState.ts`, no `lib/issueRouteResolver.ts`, no `app/(dashboard)/issues/` route tree, no `/registry/repetition-note` handler.
- Confirmed no regression to the existing `test_registry_coverage.py` (still 2/2 passing) and that `__tests__/nav.test.ts` was left byte-unchanged (Plan 40-08 owns its update).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write docs/API_CONTRACTS.md §40 (contract-first)** - `9099c9b` (docs)
2. **Task 2: Wave 0 dashboard test scaffolds + vitest edge-runtime entry** - `f4b8574` (test)
3. **Task 3: Wave 0 pipeline repetition-note test scaffold** - `13434a8` (test)

_No plan-metadata commit yet — STATE.md/ROADMAP.md/REQUIREMENTS.md updates land in this same summary-creation pass, see final commit below._

## Files Created/Modified

- `docs/API_CONTRACTS.md` - Appended §40 (nine subsections) as the single binding authority for Plans 40-02..40-09
- `apps/dispatch-control/vitest.config.ts` - Added `['__tests__/issues.test.ts', 'edge-runtime']` to `environmentMatchGlobs`
- `apps/dispatch-control/__tests__/issues.test.ts` - 8 convex-test cases: ensureByNumber idempotency, the D-04 held-issue no-op guard, hold's required-reason rejection + audit_log write, reopen, the no-identity Unauthorized case, markPublished
- `apps/dispatch-control/__tests__/derivedState.test.ts` - deriveIssueStatus precedence (incl. ISS-06 `'unknown'` on unloaded inputs), deriveStageStates (incl. the exact test name `completed run with zero checked claims is NOT clean`), deriveTasks, estimateWorkMinutes/SEVERITY_MINUTES
- `apps/dispatch-control/__tests__/issueRouteResolver.test.ts` - parseIssueNumber strict parsing, href builders, legacyRedirectTarget's never-run-keyed guarantee
- `apps/dispatch-control/__tests__/IssueCard.test.tsx` - 5-stage-segment rendering, all seven ISS-01 readouts, the ISS-06 error/loading states (aligned to the exact prop shape fixed in 40-05-PLAN.md)
- `apps/dispatch-control/__tests__/ScheduledSlotCard.test.tsx` - `Start #{n} early`, repetition-note rendering (present/absent), `triggerRun` call assertion (aligned to 40-05-PLAN.md's prop shape)
- `apps/dispatch-control/__tests__/HoldDialog.test.tsx` - placeholder copy, default-checked stop-run checkbox, required-reason validation, `onHold`/`onCancel` callback contract (aligned to 40-07-PLAN.md's prop shape)
- `packages/pipeline/tests/test_repetition_note.py` - 5 pytest cases mirroring `test_registry_coverage.py`'s TestClient/autospec pattern: over-represented geo+cause, nothing over-represented, the threshold boundary (2 excluded / 3 included), signal exclusion, the at-most-2 cap

## Decisions Made

- Read the already-written downstream plans (40-02, 40-04, 40-05, 40-07) before drafting the three component test files and the `issues.test.ts` convex-test cases, so the RED specs target the exact prop/function contracts those plans will implement — avoiding a rewrite cycle later. This is standard "read the whole phase before executing Wave 0" practice, not a deviation from 40-01's own plan text (which left prop shapes at "Claude's discretion" implicitly, since §40 itself doesn't fix component prop interfaces).
- Used `container.textContent` / regex `getByText` assertions instead of exact single-text-node matches in the three `.tsx` specs, to stay robust to reasonable markup choices in components that don't exist yet.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' `<action>` and `<verify>` blocks were followed; no auto-fixes, no architectural questions, no scope changes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 40-02 (`convex/issues.ts` + schema + pipelineRuns queries) can proceed immediately: §40.1/§40.2/§40.3 are fixed and `__tests__/issues.test.ts` is on disk, RED for the correct reason ("Could not find module for: issues").
- Plan 40-03 (repetition-note endpoint + defensive ensure + backfill) can proceed immediately: §40.4 is fixed and `test_repetition_note.py` is RED with 404s, not import errors.
- Plan 40-04 (derivedState.ts / issueRouteResolver.ts / repetitionNoteClient.ts) can proceed immediately: §40.5/§40.6/§40.7 are fixed and both pure-TS RED specs are on disk.
- Plans 40-05/40-07 (IssueCard/ScheduledSlotCard/HoldDialog + issue overview) have RED specs already aligned to their own plan-file prop contracts — no rework expected when those plans execute.
- No blockers. The Convex-deploy gate (`pnpm --filter @eisenbalm/convex dev:once`) and the strict `next build` gate remain deferred to the plans that actually add implementation code (40-02 onward / 40-09's integration gate), per this repo's established convention — this plan intentionally ships no implementation.

---
*Phase: 40-issue-entity-issues-home*
*Completed: 2026-07-14*

## Self-Check: PASSED

All 9 created files found on disk; all 3 task commits (`9099c9b`, `f4b8574`, `13434a8`) found in git history.
