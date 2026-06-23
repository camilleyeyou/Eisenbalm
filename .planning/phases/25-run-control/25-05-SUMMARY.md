---
phase: 25
plan: 05
subsystem: dispatch-control
tags: [frontend, run-control, config-page, budget-caps, cancel-run, reroll, next-run-display]
dependency-graph:
  requires: [25-03, 25-04]
  provides: [run-control-ui-complete, config-page-rebuilt]
  affects: [dispatch-control]
tech-stack:
  added: []
  patterns:
    - two-step inline confirm (no modal — D-12)
    - role=switch kill-switch toggle
    - Intl.DateTimeFormat for local+UTC dual timezone display (D-11)
    - afterEach(cleanup) explicit DOM teardown in vitest/jsdom tests
key-files:
  created:
    - apps/dispatch-control/lib/pipelineControlClient.ts
    - apps/dispatch-control/app/(dashboard)/runs/_components/RunControlBar.tsx
    - apps/dispatch-control/app/(dashboard)/runs/_components/BudgetAlertBanner.tsx
    - apps/dispatch-control/app/(dashboard)/runs/_components/CancelRunButton.tsx
    - apps/dispatch-control/app/(dashboard)/runs/_components/RerollButton.tsx
    - apps/dispatch-control/app/(dashboard)/config/_components/NextRunDisplay.tsx
    - apps/dispatch-control/app/(dashboard)/config/_components/AutomationPanel.tsx
    - apps/dispatch-control/app/(dashboard)/config/_components/BudgetCapsPanel.tsx
    - apps/dispatch-control/__tests__/runControl.test.tsx
    - apps/dispatch-control/__tests__/nextRunDisplay.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/runs/_components/RunsTable.tsx
    - apps/dispatch-control/app/(dashboard)/runs/_components/RunDetail.tsx
    - apps/dispatch-control/app/(dashboard)/runs/page.tsx
    - apps/dispatch-control/app/(dashboard)/config/page.tsx
decisions:
  - afterEach(cleanup) must be added explicitly in vitest+jsdom when multiple describes share a file — @testing-library/react auto-cleanup does not fire reliably without it
  - NextRunDisplay marked 'use client' to use Intl.DateTimeFormat in browser locale context
  - Danger Zone panel is copy-only in this phase per UI-SPEC (no destructive actions beyond Cancel Run on /runs)
metrics:
  duration: ~45 min
  completed: 2026-06-23
  tasks: 3
  files: 14
---

# Phase 25 Plan 05: Run-Control Dashboard Surfaces Summary

Pipeline-control client + all Runs-page and Config-page run-control UI per the 25-UI-SPEC.md design contract. Operators can now trigger runs, cancel active runs, re-roll individual sections, configure the automation kill-switch and schedule, and set budget caps — all in the dispatch-control app with two-step inline confirms and no modals.

## Tasks Completed

### Task 1 — Pipeline-control client + Runs page control bar + budget banner

- `pipelineControlClient.ts`: three exports (`triggerRun`, `cancelRun`, `rerollAgent`) mirroring the `testRunClient.ts` pattern. `pipelineBaseUrl()` reads `NEXT_PUBLIC_PIPELINE_URL`, throws if unset, strips trailing slash.
- `RunControlBar.tsx`: Trigger Run button with two-step inline confirm, disabled-while-running with exact tooltip, Loader2 spinner during POST.
- `BudgetAlertBanner.tsx`: `role="alert"` amber banner shown when MTD spend >= alert threshold. Dismissible. Copy matches spec exactly.
- `RunsTable.tsx`: exported `STATUS_CLASSES`, added `cancelled: 'bg-neutral-100 text-neutral-600'` entry.
- `runs/page.tsx`: BudgetAlertBanner + RunControlBar mounted above CostRollup/RunsTable.
- `runControl.test.tsx`: 20+ assertions covering STATUS_CLASSES, RunControlBar, BudgetAlertBanner, CancelRunButton, RerollButton.

Commit: `33d0f99`

### Task 2 — Cancel Run + per-section Re-roll on Run detail

- `CancelRunButton.tsx`: running-only render, two-step inline confirm ("Confirm Cancel?" / "Keep Running"), red border style.
- `RerollButton.tsx`: `SECTION_WRITERS` array (7 keys), null for non-section agents, D-04 disabled tooltip when run is still active, `window.confirm` with section-name, "Re-rolled ✓" success flash 3s.
- `RunDetail.tsx`: CancelRunButton between header and per-agent table; Re-roll column added per agent row; `cancelled` badge in STATUS_CLASSES.

Commit: `6e42c4f`

### Task 3 — Config page rebuilt with three panels

- `NextRunDisplay.tsx`: "Not scheduled yet." when `nextRunAt === 0`; otherwise renders `Next run: {local tz} ({HH:MM} UTC)` using `Intl.DateTimeFormat` (D-11).
- `AutomationPanel.tsx`: `role="switch"` kill-switch (`bg-neutral-900` ON / `bg-red-500` OFF), always-visible badge, schedule editor (day/hour/minute UTC selects), NextRunDisplay preview, Save Schedule.
- `BudgetCapsPanel.tsx`: per-run cap + monthly cap + alert threshold inputs, Save Caps, read-only MTD progress bar (`bg-amber-400` when over threshold), trailing-average projection display.
- `config/page.tsx`: three panels in order — Automation, Budget Caps, Danger Zone (copy-only, `border-red-200`, `text-red-700` heading).
- `nextRunDisplay.test.tsx`: 5 assertions (zero nextRunAt, valid timestamp, UTC in output, no exclamation marks).

Commit: `e08f48b`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DOM accumulation in vitest jsdom tests**
- **Found during:** Task 1 test run
- **Issue:** `@testing-library/react` auto-cleanup was not firing between tests in the same file across different `describe` blocks, causing "Found multiple elements with the role 'button'" failures.
- **Fix:** Added explicit `afterEach(() => cleanup())` to all four `describe` blocks in `runControl.test.tsx` (and `nextRunDisplay.test.tsx` as a precaution).
- **Files modified:** `apps/dispatch-control/__tests__/runControl.test.tsx`
- **Commit:** Fixed in `33d0f99` (cleanup added before that commit was created)

## Known Stubs

None. All components read live data from Convex (`useQuery`) and write via `useMutation`. The schedule_next_run_at key for NextRunDisplay is read from pipelineConfig — if the pipeline hasn't written this key yet, NextRunDisplay shows "Not scheduled yet." which is the correct fallback, not a stub.

## Self-Check: PASSED

All 10 created files confirmed on disk. All 3 task commits (33d0f99, 6e42c4f, e08f48b) confirmed in git log. Build exits 0. 100 tests pass.
