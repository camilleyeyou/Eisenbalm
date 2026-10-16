---
phase: 52-issue-the-front-door
plan: 03
subsystem: ui
tags: [tdd, dispatch-control, front-door, props-only]
requires:
  - phase: 52-01
    provides: homeSections selector and copy helpers
  - phase: 52-02
    provides: PublishGate and publish copy constants
provides:
  - IssueHomeView, StoryRow, PublishFooter props-only components
affects: [52-04]
tech-stack:
  added: []
  patterns: [props-only view seam, all copy sourced from selector helpers]
key-files:
  created:
    - apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx
    - apps/dispatch-control/app/(editorial)/_components/StoryRow.tsx
    - apps/dispatch-control/app/(editorial)/_components/PublishFooter.tsx
    - apps/dispatch-control/__tests__/IssueHomeView.test.tsx
  modified: []
key-decisions:
  - "StoryRow takes a `divided` prop so the border sits on the <li>, keeping the <ol> valid HTML"
requirements-completed: [HOME-01, HOME-04, HOME-06, HOME-07, HOME-08, HOME-09]
duration: 10min
completed: 2026-10-16
---

# Phase 52 Plan 03: Issue Home View Summary

**Props-only front door: wordmark header, real title and subject, nine linked story rows, and a single-Publish footer with inline confirm, skeletons and honest failed/published/gate-1/none states.**

## Accomplishments
- Every sentence and note comes from the 52-01/52-02 helpers, so the page cannot disagree with the gate.
- Loading renders aria-busy skeletons and never "Reads clean"/"Ready".
- Collaborator lock uses LockedControl; held reason shown; no window.confirm, no inputs.
- 21 view tests; with homeSections and publishChain suites, 70 passing.

## Task Commits
1. RED: 0b08ac48
2. GREEN: cfdd1121

## Deviations from Plan
- [Rule 1 - Bug] The plan imports `LockedControl` as a default export, but the component is a named export; used the named import.
- [Rule 1 - Bug] The plan wrapped rows in a `<div>` inside `<ol>` for dividers (invalid HTML); the divider is applied to the `<li>` via a `divided` prop on StoryRow.
- Two docstring phrases reworded so the plan's grep acceptance checks (window.confirm / shadow) return nothing.
- tsc reports zero errors in the new files (pre-existing errors in unrelated test files remain, untouched).

## Known Stubs
None.

## Self-Check: PASSED
