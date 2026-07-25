---
phase: quick-260724-x4b
plan: 01
subsystem: ui
tags: [nextjs, react, convex, dispatch-control, navigation]

# Dependency graph
requires:
  - phase: 41-issue-workspace-frame
    provides: WorkspaceStateProvider, FrameChrome layout, issueRouteResolver hrefs
  - phase: 24-review-desk
    provides: StoryDeskGrid, ReviewDeskRunView (Draft desk card grid + focus view)
provides:
  - Masthead "Paused for you" readout becomes a next/link to the run's Draft desk when awaiting-review
  - Dismissible DraftReadyBanner in the issue workspace frame (non-Draft stages, awaiting-review only)
  - Per-card "Edit →" shortcut on the Story Desk (StoryDeskGrid) straight into edit mode
  - RunDetail "Open issue →" link resolved via pipelineRuns.byRunId
  - RunControlBar inline "Open Issue N →" success link after Trigger Run
affects: [issues-workspace, review-desk, run-monitor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stretched primary button + real sibling secondary button (never button-in-button) for card-level primary/secondary click zones"
    - "Session-only (non-persisted) useState dismissal for contextual banners"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/_components/DraftReadyBanner.tsx
    - apps/dispatch-control/__tests__/DraftReadyBanner.test.tsx
    - apps/dispatch-control/__tests__/StoryDeskGrid.test.tsx
  modified:
    - apps/dispatch-control/components/Masthead.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunControlBar.tsx
    - apps/dispatch-control/__tests__/Masthead.test.tsx
    - apps/dispatch-control/__tests__/runControl.test.tsx
    - apps/dispatch-control/__tests__/runDetailActionNames.test.ts

key-decisions:
  - "All four affordances resolve issueNumber exclusively through the already-existing pipelineRuns.byRunId query — no new Convex functions were added."
  - "StoryDeskGrid cards became a <div> wrapping two REAL sibling <button>s (stretched primary + secondary Edit) instead of nesting an interactive Edit button inside the existing card <button> — avoids invalid interactive-in-interactive DOM nesting."
  - "DraftReadyBanner dismissal is session-only (component useState, no persistence) per the plan's STRICT SCOPE lock."

requirements-completed: [LD-1-MASTHEAD-DOOR, LD-2-DRAFT-READY-BANNER, LD-3-CARD-EDIT-SHORTCUT, LD-4-RUN-MONITOR-BACKLINK]

# Metrics
duration: ~35min
completed: 2026-07-25
---

# Quick 260724-x4b: Shorten the Launch-to-Editing Path Summary

**Four connected navigation shortcuts (Masthead door, draft-ready banner, per-card Edit affordance, Run Monitor backlinks) all wired from existing Convex queries — no new backend surface.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-25
- **Tasks:** 3 completed
- **Files modified:** 10 (3 created, 7 modified)

## Accomplishments

- Masthead's "Paused for you" system-activity readout becomes a `next/link` to the run's Draft desk exactly when the run is `awaiting-review` and its `issueNumber` has resolved — a plain readout for every other status.
- New `DraftReadyBanner`, mounted in the issue workspace frame between the stage tabs and the content grid, carries the operator forward from any non-Draft stage while the run sits at the Andrew gate; dismissible for the session.
- Every Story Desk card (`StoryDeskGrid`) now has a discrete "Edit →" affordance that jumps straight into edit mode for that section, alongside the unchanged primary click (opens the section read-only on its Draft tab).
- `RunDetail` shows an "Open issue →" link (Draft desk when awaiting-review/complete, issue overview otherwise) whenever the run has a resolvable `issueNumber`; `RunControlBar`'s Trigger Run shows an inline "Run started · Open Issue N →" link after a successful launch, never a broken link while the issue number is still resolving.

## Task Commits

Each task was committed atomically:

1. **Task 1: Awaiting-review becomes a door — Masthead link + workspace draft-ready banner** - `2b59e19` (feat)
2. **Task 2: Per-card Edit shortcut on the Story Desk** - `d1d1cda` (feat)
3. **Task 3: Run Monitor connects back to the work + full-suite/strict-build gate** - `6831136` (feat)

_Note: no TDD-style RED/GREEN split was used — tests were written and verified alongside each task's implementation per the plan's `tdd="true"` guidance on Task 1 and standard `type="auto"` on Tasks 2-3._

## Files Created/Modified

- `apps/dispatch-control/components/Masthead.tsx` - `SystemActivityReadout` accepts an optional `href`; renders a `next/link` to `issueDraftHref(issueNumber)` when `awaiting-review` + issueNumber resolved
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` - exposes raw `runStatus` on `WorkspaceStateValue` (scalar addition, no new subscriptions)
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/_components/DraftReadyBanner.tsx` (new) - session-dismissible banner gated on `runStatus === 'awaiting-review' && stage !== 'draft'`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx` - mounts `DraftReadyBanner` between the stage-tab nav and the content grid
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx` - cards convert from a single `<button>` to a `<div>` with a stretched primary button (open read-only) + a secondary "Edit →" button (`stopPropagation`)
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx` - adds `openStoryEditing`, wired as `onOpenEdit` to `StoryDeskGrid`
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx` - resolves `issueNumber` via `pipelineRuns.byRunId`, renders "Open issue →" next to "Back to all runs"
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunControlBar.tsx` - captures the started `runId`, resolves its `issueNumber`, and shows an inline post-launch success link
- `apps/dispatch-control/__tests__/Masthead.test.tsx` - +2 tests (door positive/negative)
- `apps/dispatch-control/__tests__/DraftReadyBanner.test.tsx` (new) - 4 tests (CTA shown, hidden on Draft stage, hidden mid-run, dismiss)
- `apps/dispatch-control/__tests__/StoryDeskGrid.test.tsx` (new) - 2 tests (open-vs-edit routing, mutual exclusivity)
- `apps/dispatch-control/__tests__/runControl.test.tsx` - +1 test (post-launch success link), mock gains `pipelineRuns.byRunId`
- `apps/dispatch-control/__tests__/runDetailActionNames.test.ts` - +1 source-scan test (`issueDraftHref`/`issueHref`/"Open issue" present)

## Decisions Made

- Resolved `issueNumber` in all four affordances purely via the already-subscribed/already-existing `pipelineRuns.byRunId` query — matches the plan's locked "no new Convex functions" constraint.
- Kept `StoryDeskGrid`'s primary open-story `data-testid` and click behavior byte-identical; the Edit shortcut is strictly additive (new sibling button, not a modification of the open path).
- `DraftReadyBanner` dismissal resets on reload (no localStorage/session-storage persistence) — matches the plan's explicit "no banner-dismissal persistence" scope lock.

## Deviations from Plan

**1. [Rule 1 - Bug] `RunDetail.tsx`'s new "Open issue" comment initially reused the banned word "Monitor"**
- **Found during:** Task 3, running `runDetailActionNames.test.ts`
- **Issue:** A source comment I added ("Run Monitor connects back to the work") tripped the pre-existing D-09 regression guard `expect(content).not.toMatch(/\bMonitor\b/)` in `RunDetail.tsx never renders the word "Monitor" in its idle/finished header path`.
- **Fix:** Reworded the comment to "connects this run back to the issue workspace" — no functional change, no visible-copy change (the word never appeared in rendered output, only in a source comment).
- **Files modified:** `apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx`
- **Verification:** `runDetailActionNames.test.ts` (12 tests) passes.
- **Committed in:** `6831136` (part of the Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — trivial comment wording, no behavior change).
**Impact on plan:** None on scope or behavior; caught and fixed inline before the task commit.

## Issues Encountered

None. The plan's `<interfaces>` section (verified query shapes, existing hrefs, existing handlers) matched the codebase exactly — no re-exploration or architectural surprises.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All four locked-decision affordances are wired end-to-end and covered by tests. The full dispatch-control vitest suite (139 files, 1111 tests, 1 skipped) and the strict Next.js production build both pass clean. No pipeline/API/Convex-function changes were made; `AwaitingYouInbox` routing, `deriveTasks` CTAs, and the Approval stage are untouched, matching the plan's STRICT SCOPE lock. Nothing blocks follow-on work.

---
*Quick task: 260724-x4b*
*Completed: 2026-07-25*

## Self-Check: PASSED

All 10 claimed created/modified source+test files verified present on disk via `git show --stat` across commits `2b59e19`, `d1d1cda`, `6831136`. All three task commit hashes verified present in `git log`. `pnpm --filter dispatch-control test` (1111 tests) and `pnpm --filter dispatch-control build` (strict production build) both verified green.
