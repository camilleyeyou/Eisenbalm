---
phase: 52-issue-the-front-door
plan: 01
subsystem: ui
tags: [selector, tdd, dispatch-control, gate-parity]
requires:
  - phase: 51.1-claims-carry-verdicts
    provides: isOpenBlocking claim predicate
provides:
  - deriveHomeSections / deriveHomeFooter pure selector for the front door
affects: [52-02, 52-03, 52-04]
tech-stack:
  added: []
  patterns: [terminal-states-first footer precedence, never-clean-while-loading]
key-files:
  created:
    - apps/dispatch-control/lib/homeSections.ts
    - apps/dispatch-control/__tests__/homeSections.test.ts
  modified:
    - .planning/ROADMAP.md
key-decisions:
  - "Blocking = open error-severity findings on any axis + open contradicted claims (server gate parity); warnings never block"
  - "runStatus 'complete' reads as published (pipeline never flips issues.published)"
requirements-completed: [HOME-02, HOME-03, HOME-04, HOME-05, HOME-06, HOME-09]
duration: 10min
completed: 2026-10-16
---

# Phase 52 Plan 01: Home Sections Selector Summary

**Pure selector producing nine story rows (headline, derived state, count, deep-link) and a footer model whose Publish-disabled reasons always name a story or an unattributed blocker.**

## Accomplishments
- `lib/homeSections.ts` composes `isOpenFinding`, `isOpenBlocking`, `draftSectionIdsFromDraft`, `qaSectionToGalleyId`; no predicate re-implemented.
- Footer resolves terminal states (none/published/failed/running/gate1) before requiring content inputs; fix/ready only when everything has loaded.
- Server claim summary wins over attributed claim count so unattributed contradicted claims still block with a named reason.
- 32 tests (headline/state/href/footer/loading).

## Task Commits
1. RED tests: 02000df6
2. GREEN implementation: 61fbf347
3. Test typing fix (strict index access): 6bcc6884

## Deviations from Plan
- [Rule 3 - Blocking] The test fixture used `d.sections.originStory.headline`, which fails `tsc --noEmit` under noUncheckedIndexedAccess; added non-null assertions (follow-up commit 6bcc6884).
- `git commit --no-verify` is blocked by a repo plugin hook, so task commits ran with normal hooks (no failures).
- ROADMAP checkbox for 52-01 ticked by hand (gsd-tools roadmap misreports v5).

## Known Stubs
None.

## Self-Check: PASSED
