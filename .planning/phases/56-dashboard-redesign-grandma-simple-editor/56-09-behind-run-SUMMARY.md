---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 09
subsystem: dispatch-control
tags: [behind-run, editor-ui, plain-words]
requires: [56-01, 56-02, 56-03]
provides: [BehindRun, BehindRunView, STEP_EXPLANATIONS]
affects: [apps/dispatch-control/app/admin/runs/[runId]]
key-files:
  created:
    - apps/dispatch-control/lib/behindExplanations.ts
    - apps/dispatch-control/app/admin/runs/_components/BehindRunView.tsx
    - apps/dispatch-control/app/admin/runs/_components/BehindRun.tsx
    - apps/dispatch-control/__tests__/BehindRun.test.tsx
  modified:
    - apps/dispatch-control/app/admin/runs/[runId]/page.tsx
decisions:
  - RunDetail/RecoveryRail/RerollButton left on disk (deleted in 56-12); only the run page stopped importing them.
metrics:
  completed: 2026-10-22
requirements: [P56-A1, P56-A2, P56-A3, P56-B1]
---

# Phase 56 Plan 09: Behind-Run Summary

Behind-Run page replaces Run Detail: plain-words explanation per failing step, step list, per-state single action (Start a new issue / Stop this issue with confirm), cost from per-step costs, raw error only inside collapsed Technical details.

## Commits
- ba49246d: BehindRunView, STEP_EXPLANATIONS, test (9 tests)
- 8e69049c: BehindRun wrapper + page swap

## Verification
Strict `pnpm build` green; full suite 114 files passed, 1051 tests.

## Deviations
None. Gate-interrupt runs show as paused (never Problem/Failed); Interrupt text only in the pre.

## Self-Check: PASSED
