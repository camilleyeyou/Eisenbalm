---
phase: 43-my-tasks-decision-log
plan: 03
subsystem: ui
tags: [derived-state, selector, typescript, vitest, tdd, deep-links, routing]

# Dependency graph
requires:
  - phase: 43-01
    provides: docs/API_CONTRACTS.md §43.5 (the openedAt + href correction contract) this plan implements against
  - phase: 40-04
    provides: the original deriveTasks/DerivedTask/DerivationInputs selector this plan extends additively
provides:
  - "DerivedTask.openedAt (additive raw-ms timestamp, per-source: qaFindings.timestamp, claimRows.createdAt, runStartedAt)"
  - "formatTaskAge(openedAt, now) — pure relative-age formatter, called from the screen, never from deriveTasks"
  - "corrected claim-task href -> issueFactCheckHref (was issueDraftHref, Pitfall 1 bug fix)"
  - "corrected signoff-facts href -> issueApprovalHref (was issueDraftHref, Pitfall 1 bug fix)"
  - "widened DerivationInputs (qaFindings[].timestamp, claimRows[].createdAt, top-level runStartedAt) — all additive-optional"
affects: [43-05-my-tasks-screen-nav-handoff, 43-06-decision-log-component-mounts, 43-09-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure selector stays wall-clock-independent: openedAt is a raw timestamp set inside deriveTasks; formatTaskAge(openedAt, now) is a separate pure function called at render time — deriveTasks never calls Date.now()."
    - "Additive-only DerivationInputs widening: new fields are optional passthroughs so existing callers (Masthead's count-only assembly) keep compiling without changes."

key-files:
  created: []
  modified:
    - apps/dispatch-control/lib/derivedState.ts
    - apps/dispatch-control/__tests__/derivedState.test.ts

key-decisions:
  - "signoff-voice href left unchanged (issueVoiceHref) per §43.5b — only claim-row and signoff-facts hrefs were mis-wired to /draft; voice was already correct."
  - "formatTaskAge granularity: just now / Nm ago / Nh ago / Nd ago (extends RegistryTable.formatRelativeTime's day/week/month/year granularity with minute/hour buckets since tasks are far more recent than registry 'last featured' dates); undefined openedAt renders the explicit string 'unknown', never ''."
  - "openedAt is additive-optional throughout — DerivedTask.openedAt?, DerivationInputs.qaFindings[].timestamp?, DerivationInputs.claimRows[].createdAt?, DerivationInputs.runStartedAt? — so the Masthead count-only caller (which doesn't pass these) still compiles and still returns the same task count."

patterns-established:
  - "Same-shape additive field pattern for selector evolution: extend DerivedTask/DerivationInputs with optional fields rather than forking a second projection, verified by asserting the pre-existing regression test (task count) still holds."

requirements-completed: [TSK-01, TSK-02, TSK-03]

# Metrics
duration: 4min
completed: 2026-07-15
---

# Phase 43 Plan 03: deriveTasks age + deep-link fix Summary

**Extended the already-built `deriveTasks` selector with an additive `openedAt` timestamp + pure `formatTaskAge` formatter, and fixed the confirmed Pitfall-1 bug routing claim/facts-signoff tasks to `/draft` instead of the working `/fact-check` and `/approval` screens.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-15T16:24:00Z
- **Completed:** 2026-07-15T16:28:00Z
- **Tasks:** 2 (RED test task + implementation task, TDD)
- **Files modified:** 2 (+1 deferred-items log)

## Accomplishments
- `DerivedTask` now carries an additive `openedAt?: number`, populated per source: QA-finding tasks from `row.timestamp`, claim tasks from `row.createdAt`, missing-sign-off tasks from `i.runStartedAt`.
- Added pure `formatTaskAge(openedAt, now)` — renders `'just now'` / `'Nm ago'` / `'Nh ago'` / `'Nd ago'`, or the explicit `'unknown'` when `openedAt` is absent (never a blank string). Kept outside `deriveTasks` so the selector itself stays wall-clock-independent.
- Fixed the confirmed Pitfall-1 href bug: claim-row tasks now deep-link to `issueFactCheckHref(n)` (`/issues/{n}/fact-check`) instead of `/draft`; the `signoff-facts` ("Clear the facts") task now deep-links to `issueApprovalHref(n)` (`/issues/{n}/approval`) instead of `/draft`. `signoff-voice` was verified already-correct per §43.5b and left unchanged.
- Widened `DerivationInputs` with additive-optional passthrough fields (`qaFindings[].timestamp`, `claimRows[].createdAt`, top-level `runStartedAt`) — the Masthead's count-only caller, which doesn't supply these, still type-checks and still returns the identical task count (verified: no `Masthead` errors in `tsc --noEmit` output).
- Regression-pinned TSK-01: `deriveTasks` over one open finding + one pending claim + no sign-offs still returns exactly 4 tasks (1 finding + 1 claim + 2 missing sign-offs) — no new source, no dropped source.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: RED tests — TSK-01 regression + openedAt + href corrections** - `d49821d` (test)
2. **Task 2: Add openedAt + formatTaskAge + correct hrefs + widen DerivationInputs** - `68e041e` (feat)

_TDD: RED (7 failing tests, import of not-yet-exported `formatTaskAge` failed) → GREEN (all 54 tests pass, 47 pre-existing + 7 new)._

## Files Created/Modified
- `apps/dispatch-control/lib/derivedState.ts` - added `openedAt` to `DerivedTask`, widened `DerivationInputs` (additive-optional), fixed claim/signoff-facts hrefs, added `formatTaskAge`
- `apps/dispatch-control/__tests__/derivedState.test.ts` - added `deriveTasks — Phase 43` describe block (TSK-01/02/03) and `formatTaskAge` describe block
- `.planning/phases/43-my-tasks-decision-log/deferred-items.md` - logged pre-existing, unrelated `tsc --noEmit` failures (new file)

## Decisions Made
- `signoff-voice` href left unchanged (`issueVoiceHref`) — API_CONTRACTS.md §43.5b already resolved the plan's "VERIFY" instruction: the sounds-human sign-off control does not live on Approval, so no retarget was needed. Confirmed by a new regression test.
- `formatTaskAge` mirrors `RegistryTable.tsx`'s `formatRelativeTime` granularity but adds minute/hour buckets, since My Tasks items are typically minutes-to-hours old rather than days-to-years old (registry "last featured" use case).

## Deviations from Plan

None — plan executed exactly as written. The one open question left to the executor by the plan (whether `signoff-voice`'s href needed retargeting) was already resolved by `docs/API_CONTRACTS.md` §43.5b before this plan ran, so no additional file reads or architectural decisions were required beyond what the plan's `<context>` block specified.

## Issues Encountered
- `pnpm --filter dispatch-control typecheck` reports pre-existing failures in three unrelated files (`__tests__/syntheticPortableText.test.ts`, `__tests__/voicePassAxis.test.ts`, `__tests__/WriterExpansion.test.tsx`, last touched in Phases 32/36/37). Verified via `git stash` that these errors are byte-identical with and without this plan's changes — confirmed pre-existing and out of scope per the scope-boundary rule. Logged to `.planning/phases/43-my-tasks-decision-log/deferred-items.md` rather than fixed. `derivedState.ts` itself introduces zero new typecheck errors, and no `Masthead`-related errors appear.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `deriveTasks`/`DerivedTask`/`formatTaskAge`/`DerivationInputs` are ready for 43-05 (My Tasks screen) to consume directly — the screen can render `openedAt` via `formatTaskAge` and rely on corrected claim/facts-signoff hrefs with no further selector changes.
- The pre-existing, unrelated `tsc --noEmit` failures (see Issues Encountered) remain open and should be picked up by whichever plan/phase owns those files; they do not block 43-05/43-06 since they're isolated to `syntheticPortableText`/`voicePassAxis`/`WriterExpansion` test files, not `derivedState.ts` or its consumers.

---
*Phase: 43-my-tasks-decision-log*
*Completed: 2026-07-15*

## Self-Check: PASSED

All claimed files exist and all claimed commits are present in `git log`.
