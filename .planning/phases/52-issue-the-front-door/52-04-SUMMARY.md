---
phase: 52-issue-the-front-door
plan: 04
subsystem: ui
tags: [dispatch-control, front-door, routing, publish]
requires:
  - phase: 52-01
    provides: homeSections selectors
  - phase: 52-02
    provides: publishChain, derivePublishGate
  - phase: 52-03
    provides: IssueHomeView
provides:
  - IssueHome live data wrapper
  - "/ served by app/(editorial)/page.tsx"
  - hash-scroll to #finding-{id} on /s/[section]
affects: [53]
tech-stack:
  added: []
  patterns: [runId-keyed draft state, single route owner for /]
key-files:
  created:
    - apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx
    - apps/dispatch-control/app/(editorial)/page.tsx
    - apps/dispatch-control/__tests__/IssueHome.test.tsx
    - apps/dispatch-control/__tests__/homeRoute.test.ts
  modified:
    - apps/dispatch-control/app/(dashboard)/run/page.tsx
    - apps/dispatch-control/app/(editorial)/s/[section]/page.tsx
    - apps/dispatch-control/__tests__/SectionReaderPage.test.tsx
  deleted:
    - apps/dispatch-control/app/(dashboard)/page.tsx
key-decisions:
  - "Rows are withheld (skeleton) until claimSummary, signOffs, issue and title have all loaded, so nothing reads clean early"
requirements-completed: [HOME-01, HOME-05, HOME-07, HOME-08, HOME-09]
duration: 25min
completed: 2026-10-16
---

# Phase 52 Plan 04: Wire Front Door Route Summary

**`/` now serves the live Issue front door: current run via `useCurrentRun()`, runId-keyed draft, one-click `publishChain`, and `/s/{id}#finding-{id}` deep links that scroll to the mark.**

## Accomplishments
- IssueHome wraps IssueHomeView with real subscriptions; publish holds "Publishing…" until the run reads published (issue.published OR run status complete), with a 75s slow notice.
- The route move (delete `(dashboard)/page.tsx`, add `(editorial)/page.tsx`) is a single commit; `/` appears once in the build route table. Old URLs (/run, /issues, approval, my-tasks, review-desk) still resolve.
- Section page computes `pageLoading` among its hooks and scrolls to the hash target once loading clears.

Note: `SectionHeader`'s `href="/"` back-link (`app/(editorial)/s/[section]/_components/SectionHeader.tsx:39`) now lands on the front door instead of bouncing through /run. UAT should check it.

## Task Commits
1. IssueHome + tests: 98fccf1c
2. Route move + homeRoute test: 88ef0e5e
3. Hash-scroll: 350ed960
4. Test stabilization (slow-notice timing): 3c1731c2

## Verification
- `pnpm --filter dispatch-control build`: exit 0, `/` listed once.
- `pnpm --filter dispatch-control test`: 157 files passed, 1398 tests passed, 2 todo.
- tsc: zero errors in touched files.

## Deviations from Plan
- [Rule 1 - Bug] As specified, rows read "Reads clean" while claimSummary/signOffs/issue/title were still undefined (only the footer was gated). The wrapper now passes `sections=undefined` to the view until those inputs arrive (`rowsReady`).
- [Rule 1 - Bug] The slow-notice test registered its timer after the fake-timer switch / before publishOk was set; it uses fake timers from the start and advances until the notice appears (first attempt was flaky under the full suite).

## Known Stubs
None.

## Self-Check: PASSED
