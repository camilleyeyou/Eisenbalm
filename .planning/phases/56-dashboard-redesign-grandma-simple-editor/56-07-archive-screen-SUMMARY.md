---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 07
subsystem: dispatch-control
tags: [archive, editor-ui]
requires: [56-01, 56-03]
provides: ["/archive Past issues screen"]
key-files:
  modified:
    - apps/dispatch-control/app/(editorial)/archive/page.tsx
    - apps/dispatch-control/app/(editorial)/archive/_components/ArchiveBody.tsx
    - apps/dispatch-control/__tests__/ArchiveScreen.test.tsx
requirements-completed: [P56-A1, P56-A2, P56-A3, P56-B1]
completed: 2026-10-22
---

# Phase 56 Plan 07: Archive Screen Summary

Past issues rebuilt: newest-first list with charity links opening /?run=<id>, plain search, and a collapsed "Stopped or unfinished issues (N)" section, using client-side join of issues.listWithTitles with runs.listRecentForWorkspace via deriveArchiveRows. No Convex edits.

## Commits
- ff83abac ArchiveBody pure view + tests
- 8327280e archive page wrapper (HeldIssueRow import removed; ?issue=N forwarding kept)

## Deviations
- listWithTitles returns no slug; wrapper passes `issue-<N>` for published issues (the same pattern the old code used) and prefixes with `NEXT_PUBLIC_WEB_PREVIEW_BASE`. `websiteUrlFor` prop takes the relative published path instead of an issue number.

## Verification
Strict `pnpm --filter dispatch-control build` passed; full suite 113 files passed, 1039 tests (ArchiveScreen rewritten, 8 tests replace the older set).

## Self-Check: PASSED
