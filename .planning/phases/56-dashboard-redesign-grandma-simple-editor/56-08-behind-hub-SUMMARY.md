---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 08
subsystem: dispatch-control
tags: [admin, behind-the-scenes, editor-ux]
requires: [56-01, 56-02, 56-03]
provides: ["/admin rebuilt as Behind the scenes", "BehindHub + BehindHubView"]
key-files:
  created:
    - apps/dispatch-control/app/admin/_components/BehindHub.tsx
    - apps/dispatch-control/app/admin/_components/BehindHubView.tsx
  modified:
    - apps/dispatch-control/app/admin/page.tsx
    - apps/dispatch-control/__tests__/AdminHub.test.tsx
decisions:
  - "ASSUMPTION A9: while the latest run is Working the slab reads 'Nothing here needs you. The writers are working on this week's issue.'; Problem reads 'This issue hit a problem and stopped. Nothing reached readers.'"
metrics:
  tasks: 2
  completed: 2026-10-22
---

# Phase 56 Plan 08: Behind the scenes hub Summary

/admin now renders the Behind artboard: ghost-only slab, h1, ten plain steps with a real summed cost line (deriveRunCostUsd over agent_runs, never runs.cost), and the seven dials with plain "Check weekly" text.

## Deviations from Plan
None. Issue line uses formatIssueLine with run start (no extra issues query).

## Verification
- AdminHub + nav tests green; strict `pnpm --filter dispatch-control build` green; full suite 113 files passed, 1042 tests passed.
- No Convex edits.

## Commits
- 0d62eb4e BehindHubView + test
- 4c84fe02 BehindHub wrapper + page

## Self-Check: PASSED
