---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 10
subsystem: dispatch-control
tags: [jargon-sweep, admin-runs, editor-copy]
requires: [56-01, 56-02, 56-03]
provides: ["/admin/runs in plain words", "adminRunsJargon tripwire"]
affects: [56-12]
key-files:
  modified:
    - apps/dispatch-control/app/admin/runs/page.tsx
    - apps/dispatch-control/app/admin/runs/layout.tsx
    - apps/dispatch-control/app/admin/runs/_components/RunsTable.tsx
    - apps/dispatch-control/app/admin/runs/_components/RunControlBar.tsx
    - apps/dispatch-control/app/admin/runs/_components/ReviewQueue.tsx
    - apps/dispatch-control/app/admin/runs/_components/CostRollup.tsx
    - apps/dispatch-control/app/admin/runs/_components/BudgetAlertBanner.tsx
    - apps/dispatch-control/app/admin/runs/_components/CancelRunButton.tsx
    - apps/dispatch-control/__tests__/runControl.test.tsx
  created:
    - apps/dispatch-control/__tests__/adminRunsJargon.test.ts
metrics:
  completed: 2026-10-22
  tasks: 2
---

# Phase 56 Plan 10: Runs pages sweep Summary

The past-issues list at /admin/runs now lists issues by name and date with the six status words, folds old unfinished issues, and carries no engineering jargon. A source-scan tripwire guards all nine owned files.

## Relabels (old -> new)

- layout: Runs / Graph mono-caps tabs -> slab "Nothing here is needed to publish this week's issue." with ghost "Back to behind the scenes", plus links "Every issue" and "How the steps connect". A single-issue page (segment is a run id) gets no extra slab, so Behind-Run keeps its own.
- page: heading "Runs" (from RunControlBar) -> h1 "Past issues, step by step" with intro "How each issue was made. Open one to see every step."; metadata title likewise.
- RunsTable: status chips (running/done/failed/awaiting-review/cancelled) -> StatusWord (Working/Done/Problem/Waiting for you/Stopped). `STATUS_CLASSES` -> `STATUS_WORDS_FOR_RUN`. Columns Trigger / Triggered By / Duration / Cost -> Where it stands / Started by / How long / What it cost (Trigger column dropped). "View →" -> "See the steps". Row label uses `formatRunLabel` and links via `adminRunHref`. "Older runs (N)" button -> closed `details` "Older unfinished issues (N)". "Show all" -> "Show every issue". Empty state reworded. HelpTip "Explain run status" removed.
- RunControlBar: "Trigger Run" -> "Start a new issue"; "Confirm Run?" -> "Yes, start it"; "Cancel" -> "Not now"; "Run started" -> "Issue started"; heading "System Workbench / Runs" -> "Every issue"; running tooltip reworded.
- ReviewQueue: "Review →" -> "Open the issue" (via `issueOpenHref`); chip -> "Waiting for you"; "Older runs" -> "Older unfinished issues"; "Estimated run cost" -> "What this issue cost so far".
- CostRollup: "Spend Summary" -> "What the writing cost"; Window/Runs/Total Cost -> When/Issues/What it cost; "Recent run costs" with 16-char run ids -> "Latest issues" with `formatRunLabel` labels. Costs still come from per-step totals.
- BudgetAlertBanner: "Month-to-date spend ... Add capacity or pause automation" -> "The writing has cost N% of this month's limit ... Raise the limit or pause the automatic start."; dismiss label "Hide this notice".
- CancelRunButton: "Cancel Run" -> "Stop this issue"; confirm uses `COPY.stopConfirmTitle/Body/stopConfirm/stopCancel` (kept inline two-step, no modal).
- Mono, uppercase, tracking and sub-15px text removed from the touched files.

## Deviations from Plan

None material. CancelRunButton keeps its inline two-step confirm rather than the `useConfirm` dialog, to avoid requiring a provider in its existing tests. The RerollButton block in runControl.test.tsx, RerollButton, RecoveryRail, RunDetail and the graph folder are untouched.

## Verification

- Strict `pnpm build` in dispatch-control: passes.
- Full suite: 115 files passed, 1060 tests passed (1 file skipped, 2 todo).

## Commits

- 9d78dd43 feat(56-10): plain-word past issues list with six status words and older fold
- 2ee4949f test(56-10): jargon tripwire over past issues pages

## Self-Check: PASSED
