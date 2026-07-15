---
phase: 40-issue-entity-issues-home
plan: 04
subsystem: ui
tags: [typescript, pure-functions, derived-state, routing, dispatch-control, vitest]

# Dependency graph
requires:
  - phase: 40-01
    provides: "the RED test scaffolds __tests__/derivedState.test.ts and __tests__/issueRouteResolver.test.ts, plus the §40.5/§40.6/§40.7 contract text this plan implements"
  - phase: 33/36
    provides: "isOpenFinding (lib/galley/findingState.ts) and VOICE_AXES (lib/galley/axisPartition.ts) — the shared predicates this module reuses rather than re-derives"
  - phase: 39
    provides: "lib/coverageStripClient.ts — the fetch-client shape repetitionNoteClient.ts mirrors line-for-line"
provides:
  - "lib/derivedState.ts — deriveIssueStatus, deriveStageStates, deriveTasks, estimateWorkMinutes, SEVERITY_MINUTES (pure, no Convex import)"
  - "lib/issueRouteResolver.ts — parseIssueNumber, issueHref, issueReviewHref, issueVoiceHref, issueRunHref, legacyRedirectTarget (pure, no imports)"
  - "lib/repetitionNoteClient.ts — fetchRepetitionNote, RepetitionNoteError, RepetitionNote, RepetitionAvoidItem (fetch-only, no Sanity import)"
affects: [40-05-issues-home-screen, 40-06-routing-inversion, 40-07-issue-overview-hold, 40-08-masthead-nav-chrome, 41-issue-workspace, 43-my-tasks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side derived-state selector module (D-23) — pure functions over existing Convex query results, no new persisted state, no Convex import so the module unit-tests in isolation"
    - "undefined vs null distinction as the structural mechanism for ISS-06 (an unloaded/failed query input can only ever produce 'unknown', never a stale value)"
    - "Per-client private pipelineBaseUrl() copy (matches coverageStripClient.ts / findingsClient.ts precedent) rather than a shared cross-import"

key-files:
  created:
    - apps/dispatch-control/lib/derivedState.ts
    - apps/dispatch-control/lib/issueRouteResolver.ts
    - apps/dispatch-control/lib/repetitionNoteClient.ts
    - .planning/phases/40-issue-entity-issues-home/deferred-items.md
  modified: []

key-decisions:
  - "Voice stage's 'no open voice findings, sounds-human sign-off still outstanding, run not running' branch returns openCount 0 (not the contract table's literal 1) to match the 40-01 RED test's exclusion-filter assertion — state stays 'needs-you'; there is no enumerable finding to count in that branch, only the sign-off action itself"
  - "deriveTasks guards on i.signOffs !== undefined before generating the two missing-sign-off tasks — a defensive null check not spelled out character-for-character in the contract prose, needed because signOffs['facts-cleared'] would throw on an undefined record"

patterns-established:
  - "Pattern: every new fetch-client module in lib/ keeps its own private pipelineBaseUrl() copy rather than importing a shared one — repetitionNoteClient.ts continues this from coverageStripClient.ts"

requirements-completed: [ISS-01, ISS-06, ISS-02, ISS-03]

# Metrics
duration: 15min
completed: 2026-07-14
---

# Phase 40 Plan 04: Derived-State & Resolver Libs Summary

**Three pure/fetch-only TS library modules — a derived-state selector (issue status, 5-stage states, task projection, estimated work), an issueNumber<->URL resolver, and a repetition-note fetch client — all unit-tested green with zero Convex or Sanity imports.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-14T16:52:00-07:00
- **Completed:** 2026-07-14T16:58:28-07:00
- **Tasks:** 3
- **Files modified:** 3 created (+ 1 deferred-items log)

## Accomplishments
- `lib/derivedState.ts`: `deriveIssueStatus` (unloaded/failed input → `'unknown'`, never a stale `'ready'` — ISS-06 made structural), `deriveStageStates` (5-tuple, artifact-derived, Fact Check stage never reads `runStatus` per D-19), `deriveTasks` (the real D-21 projection consumed by both the header's count and Phase 43's future My Tasks screen), `estimateWorkMinutes` + `SEVERITY_MINUTES` (D-22)
- `lib/issueRouteResolver.ts`: strict `parseIssueNumber`, four href builders, `legacyRedirectTarget` that never returns a run-keyed URL
- `lib/repetitionNoteClient.ts`: `fetchRepetitionNote` GETting `/registry/repetition-note`, mirroring `coverageStripClient.ts`'s auth/error shape exactly
- All three verified to import none of `convex/react`, `@convex/_generated`, or `@sanity/*`

## Task Commits

Each task was committed atomically:

1. **Task 2: lib/issueRouteResolver.ts** - `a5ba9df` (feat) — done first per the plan's own note that Task 1 (`deriveTasks`) imports from it
2. **Task 1: lib/derivedState.ts** - `5679b3f` (feat)
3. **Task 3: lib/repetitionNoteClient.ts** - `66d02ff` (feat)

_No separate plan-metadata commit yet — this SUMMARY + STATE/ROADMAP updates land in the final commit._

## Files Created/Modified
- `apps/dispatch-control/lib/derivedState.ts` — pure derived-state selector (§40.6)
- `apps/dispatch-control/lib/issueRouteResolver.ts` — pure issueNumber<->URL resolver (§40.7)
- `apps/dispatch-control/lib/repetitionNoteClient.ts` — repetition-note fetch client (§40.5)
- `.planning/phases/40-issue-entity-issues-home/deferred-items.md` — logs pre-existing, out-of-scope `tsc` errors in unrelated test files

## Decisions Made
- Implemented Task 2 (`issueRouteResolver.ts`) before Task 1 (`derivedState.ts`) since `deriveTasks` imports `issueReviewHref`/`issueVoiceHref` from it — the plan's own `<read_first>` for Task 1 flags this ordering.
- Kept `primary.label` as a fixed `'Review'` string and qa-finding `title` as the finding's `reason` text for `deriveTasks` — neither is pin-specified by §40.6's bullet list or asserted by the RED test, so any plain-language string satisfies "plain language" per the `DerivedTask` type; downstream UI plans (40-05/41) can adjust copy without touching the derivation logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Voice stage `needs-you` openCount changed from the contract's literal `1` to `0` for the "sign-off outstanding, no open voice findings" branch**
- **Found during:** Task 1 (derivedState.ts) — running `__tests__/derivedState.test.ts`
- **Issue:** §40.6's stage-states table literally specifies `needs-you/1` for the branch where `V === 0` (no open voice-axis findings) and `signOffs['sounds-human']` is still missing on a non-running run. Implementing that literally failed the 40-01 RED test `findings with resolution:"dismissed" or accepted:true are excluded from every stage count`, which asserts `result[3].openCount` (Voice) is `0` in exactly that scenario.
- **Fix:** Changed the fallback's `openCount` from `1` to `0`, keeping `state: 'needs-you'` unchanged. Documented the deviation with an inline code comment. No other test in the 40-01 suite exercises this branch, so nothing else was affected.
- **Files modified:** `apps/dispatch-control/lib/derivedState.ts`
- **Verification:** `pnpm vitest run __tests__/derivedState.test.ts` — all 16 tests green (was 1 failing before the fix)
- **Committed in:** `5679b3f` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Guarded the two missing-sign-off tasks in `deriveTasks` on `signOffs !== undefined`**
- **Found during:** Task 1 (derivedState.ts) implementation, before running tests
- **Issue:** §40.6's bullet rules state the missing-sign-off tasks fire when `runId !== null && runStatus !== 'running' && !signOffs['facts-cleared']` — but if `signOffs` itself is `undefined` (not-loaded), indexing into it (`signOffs['facts-cleared']`) would throw a runtime `TypeError` rather than degrade gracefully.
- **Fix:** Added an explicit `i.signOffs !== undefined` guard before generating either missing-sign-off task, matching the module's overall "unloaded input never crashes" discipline (the same discipline `deriveIssueStatus` establishes for ISS-06).
- **Files modified:** `apps/dispatch-control/lib/derivedState.ts`
- **Verification:** `pnpm vitest run __tests__/derivedState.test.ts` passes; no test exercises `signOffs: undefined` with a non-null `runId` directly, but the guard prevents a crash in that combination without changing any tested behavior.
- **Committed in:** `5679b3f` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix to match the RED spec, 1 missing null-safety guard)
**Impact on plan:** Both changes are narrowly scoped to `derivedState.ts` internals; neither changes any exported signature, type, or the pass/fail status of any other test. No scope creep.

## Issues Encountered
- `pnpm exec tsc --noEmit -p tsconfig.json` reports pre-existing type errors in five unrelated test files (`spanResolver.test.ts`, `syntheticPortableText.test.ts`, `voicePassAxis.test.ts`, `VoicePassScreen.test.tsx`, `WriterExpansion.test.tsx`) that this plan did not touch. Confirmed via `grep` that none of the errors originate in the three files this plan created. Logged to `.planning/phases/40-issue-entity-issues-home/deferred-items.md` per the scope-boundary rule rather than fixed here.

## Known Stubs

None — all three modules are fully implemented pure logic / fetch clients with no placeholder data paths. `deriveTasks`'s `primary.label` is a fixed `'Review'` string (not a stub; it is a deliberate, uniform label pending 40-05/41's UI copy pass).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `lib/derivedState.ts`, `lib/issueRouteResolver.ts`, and `lib/repetitionNoteClient.ts` are ready for 40-05 (Issues home screen), 40-06 (routing inversion), 40-07 (issue overview + hold), and 40-08 (masthead/nav chrome) to import directly.
- Both target RED test suites (`__tests__/derivedState.test.ts`, `__tests__/issueRouteResolver.test.ts`) are green (25/25 tests).
- No blockers for downstream plans. The one documented deviation (Voice stage openCount) is internal to the module's return values and does not change any exported type or signature §40.5/§40.6/§40.7 downstream consumers rely on.

---
*Phase: 40-issue-entity-issues-home*
*Completed: 2026-07-14*

## Self-Check: PASSED

All created files confirmed present on disk; all three task commits (`a5ba9df`, `5679b3f`, `66d02ff`) confirmed present in git history.
