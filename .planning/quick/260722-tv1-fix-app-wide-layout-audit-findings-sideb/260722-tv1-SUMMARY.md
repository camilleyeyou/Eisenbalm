---
phase: quick-260722-tv1
plan: 01
subsystem: ui
tags: [nextjs, tailwind, react, dispatch-control, css-container-queries, jump-nav, run-monitor]

# Dependency graph
requires:
  - phase: quick-260722-n5r
    provides: The rebuilt Issue Workspace frame (sticky stage nav, `min-h-full` page roots, `[id^='galley-']` scroll-margin) this plan's 23 findings were audited against and build directly on top of
provides:
  - App shell fixes — AppSidebar bottom block no longer clipped, Issues home no longer overscrolls/double-gutters, InspectorPanel starts below the Masthead, HelpTip popover renders above the sticky stage nav, AwaitingYouInbox width-clamped, PlaceholderScreen sized for rail mounts, HeldIssueRow text no longer shoves the Reopen button
  - Voice Pass container-query layout (`.voice-canvas`/`.voice-stage-row`/`.voice-stage-rail`) — one layout serves both the narrow workspace-canvas mount and the wide standalone route
  - Working jump-nav from every stage (WorkspaceOutline/DecisionRail/SourceIndex now route to `issueDraftHref(n)#anchor` when the current stage has no galley mounted, instead of silently no-opping) + a one-shot hash-scroll receiver on the Draft stage
  - Galley overlay viewport clamps (AnnotationMark popover self-clamp, PassageToolbar Masthead/viewport clamp) and DecisionLog `<dd>` wrapping
  - run-monitor sticky tab bar, 1600px-capped runs pages, and client-side list caps (RunsTable/DriftScoreboard/VersionHistoryPanel/IssueComments) with Show-more/Show-all/Show-older toggles, plus a DiffViewer height cap
affects: [issue-workspace, review-desk, voice-pass, run-monitor, eval-center, prompt-lab, issues-home]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS container-query column/row flip (container-type: inline-size on a wrapper + @container (min-width: Nrem)) as the fix for a component starved by a viewport lg: breakpoint when mounted in a narrower canvas than the viewport — same pattern quick 260722-n5r established for the galley type scale, now applied to Voice Pass's two-column layout"
    - "Jump-nav fallback: try document.getElementById(anchor)?.scrollIntoView() first; if the anchor isn't mounted on the current stage, router.push(issueDraftHref(issueNumber) + '#' + anchor) instead of silently no-opping, with a one-shot hash-scroll effect on the receiving stage (mirrors the existing deepLinkAppliedRef ?edit= pattern)"
    - "Client-side list cap: slice to the latest N (respecting the query's existing sort order), render a Show-more/Show-all/Show-older <button> OUTSIDE the <ul>/<tbody> (never a listitem/row), keep data-testid indices scoped to the visible slice"

key-files:
  created: []
  modified:
    - apps/dispatch-control/components/AppSidebar.tsx
    - apps/dispatch-control/app/(dashboard)/issues/page.tsx
    - apps/dispatch-control/components/inspector/InspectorPanel.tsx
    - apps/dispatch-control/components/ui/HelpTip.tsx
    - apps/dispatch-control/components/AwaitingYouInbox.tsx
    - apps/dispatch-control/components/_PlaceholderScreen.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/HeldIssueRow.tsx
    - apps/dispatch-control/app/globals.css
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx
    - apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx
    - apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx
    - apps/dispatch-control/components/galley/AnnotationMark.tsx
    - apps/dispatch-control/components/galley/PassageToolbar.tsx
    - apps/dispatch-control/components/decision-log/DecisionLog.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/layout.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/page.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/page.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/page.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunsTable.tsx
    - apps/dispatch-control/app/(dashboard)/eval-center/_components/DriftScoreboard.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/DiffViewer.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/_components/IssueComments.tsx
    - apps/dispatch-control/__tests__/DecisionRail.roleGate.test.tsx
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx
    - apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx
    - apps/dispatch-control/__tests__/WorkspaceApprovalPanelLoop.test.tsx
    - apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx
    - apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx
    - apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx
    - apps/dispatch-control/__tests__/WorkspaceOutline.test.tsx
    - apps/dispatch-control/__tests__/WorkspaceOutlineEmptyState.test.tsx

key-decisions:
  - "RunsTable/DriftScoreboard: called the new useState for the Show-more toggle BEFORE the loading/empty early-return guards (not literally 'after the guards' as the plan's action text read) — hooks must be called in the same order on every render of a component instance; calling it after a conditional early return would violate Rules of Hooks the moment the query resolves from undefined to data. Matches the codebase's own established pattern (VersionHistoryPanel already declares its state before its early return)."
  - "AnnotationMark's popover self-clamp applies `style={{ left: popoverShift }}` (a negative px shift) rather than repositioning via `right`/`transform` — implemented exactly as specified in the plan/audit, mirroring HelpTip's existing self-clamp convention in this codebase."

requirements-completed: [LAYOUT-AUDIT-260722-TV1]

# Metrics
duration: ~18min
completed: 2026-07-23
---

# Quick Task 260722-tv1: Fix App-Wide Layout Audit Findings Summary

**Closed 23 audit-verified layout/markup/CSS defects across the dispatch-control app shell, Issue Workspace stages, and run-monitor/ops surfaces — sidebar clipping, page overscroll/double-gutters, an Inspector panel painting over the Masthead, a starved Voice Pass galley, four dead jump-nav controls, unclamped galley overlays, and five unbounded ops lists — with zero data-flow or Convex changes.**

## Performance

- **Duration:** ~18 min (3 task commits, 21:43–22:00 PDT)
- **Started:** 2026-07-23T04:43:00Z (first task commit)
- **Completed:** 2026-07-23T05:00:40Z (last task commit)
- **Tasks:** 3 completed
- **Files modified:** 36 (27 planned + 9 companion test-mock fixes)

## Accomplishments

- **Shell + page roots (7 files):** `AppSidebar`'s `<aside>` `h-screen` → `h-full` so its `mt-auto` bottom block (How to use / role indicator) fits inside the 100vh−52px shell row. Issues home root `min-h-screen px-6 py-8 lg:px-8` → `min-h-full py-2`, matching the 260722-n5r workspace-frame pattern; held list capped to 8 with a `+N more held` note. `InspectorPanel` slide-over `top-0 h-full` → `top-[52px] h-[calc(100%-52px)]` so it no longer blocks My Tasks/UserButton while open. `HelpTip` popover `z-20` → `z-40` (above the workspace's `z-30` sticky stage nav). `AwaitingYouInbox` dropdown width-clamped (`w-[min(360px,calc(100vw-24px))]`). `_PlaceholderScreen` `min-h-[60vh]` → `min-h-[320px]` (stops forcing rail scroll when mounted inside a ContextPanel). `HeldIssueRow` text container gets `min-w-0`, reason span gets `break-words`.
- **Issue Workspace stages (11 files):** `globals.css` gains `.voice-canvas`/`.voice-stage-row`/`.voice-stage-rail` container-query classes (column below a 56rem canvas width, row with a 336px rail above it) — `VoicePassRunView` now uses them instead of `lg:flex-row`/`lg:w-[336px]`, so Voice Pass's galley is no longer starved in the narrow workspace-canvas mount even though the standalone route is wide enough. `ReviewDeskRunView` drops its own `min-h-[70vh]` and gains a one-shot `#galley-*` hash-scroll receiver. `WorkspaceOutline`/`DecisionRail`/`SourceIndex` jump-nav now routes to `issueDraftHref(issueNumber)#anchor` when the current stage (Story/Fact Check/Approval) has no galley mounted, instead of silently no-opping. `StoryBriefScreen`/`SignalDeskScreen` drop their double-guttering outer `p-6` (except StoryBrief's bordered error card, which needs its own padding). `AnnotationMark`'s popover self-clamps left on overflow; `PassageToolbar`'s fixed anchor floors `top` at 60 (Masthead + gap) and clamps `left`; `DecisionLog`'s `<dd>` cells get `min-w-0 break-words`.
- **run-monitor + ops hardening (9 files):** the Runs/Graph tab bar is now `sticky top-0` with an opaque rail background; the Graph page drops the vertical half of a `-m-6` that pulled its header under the tab bar. Both run-monitor/runs pages cap to `max-w-[1600px]`. `RunsTable` caps to the latest 50 with a "Show all" toggle; `DriftScoreboard`'s per-scenario series wraps in `overflow-x-auto` and caps to the latest 20; `VersionHistoryPanel` caps to the latest 20 with "Show older"; `IssueComments` caps to the latest 20 with "Show earlier comments" above the list; `DiffViewer` gains `max-h-[480px]` so a large diff engages its own scroll.

## Task Commits

Each task was committed atomically:

1. **Task 1: Shell + page-root defects** — `8dd442d` (fix) — AppSidebar, issues/page.tsx, InspectorPanel, HelpTip, AwaitingYouInbox, _PlaceholderScreen, HeldIssueRow
2. **Task 2: Issue Workspace stage defects** — `d913ff8` (fix) — globals.css voice-canvas classes, VoicePassRunView, ReviewDeskRunView, WorkspaceOutline, DecisionRail, SourceIndex, StoryBriefScreen, SignalDeskScreen, AnnotationMark, PassageToolbar, DecisionLog
3. **Task 3: run-monitor + ops hardening** — `c81c400` (fix) — run-monitor layout/graph/runs pages, RunsTable, DriftScoreboard, VersionHistoryPanel, DiffViewer, IssueComments, plus 9 companion test-mock fixes

_No TDD tasks in this plan — layout/CSS/markup/routing-fallback changes, verified via `build`/`test`, not test-first._

## Files Created/Modified

- `apps/dispatch-control/components/AppSidebar.tsx` - `h-screen` → `h-full` on the `<aside>`
- `apps/dispatch-control/app/(dashboard)/issues/page.tsx` - Root `min-h-full py-2`; held list capped to 8 + `+N more held`
- `apps/dispatch-control/components/inspector/InspectorPanel.tsx` - Slide-over `top-[52px] h-[calc(100%-52px)]`
- `apps/dispatch-control/components/ui/HelpTip.tsx` - Popover `z-40`
- `apps/dispatch-control/components/AwaitingYouInbox.tsx` - Dropdown `w-[min(360px,calc(100vw-24px))]`
- `apps/dispatch-control/components/_PlaceholderScreen.tsx` - `min-h-[320px]`
- `apps/dispatch-control/app/(dashboard)/issues/_components/HeldIssueRow.tsx` - `min-w-0` container + `break-words` reason span
- `apps/dispatch-control/app/globals.css` - `.voice-canvas`/`.voice-stage-row`/`.voice-stage-rail` container-query rules
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx` - Adopts the voice-canvas classes; drops `min-h-[70vh]`/`lg:flex-row`/`lg:w-[336px]`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx` - Drops `min-h-[70vh]`; adds one-shot `#galley-*` hash-scroll effect
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx` - `jumpToSection` routes to `issueDraftHref(n)#anchor` when the anchor is absent
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` - `handleTranscript`/`jumpToFinding` route-fallback; passes `issueNumber` to `SourceIndex`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx` - Optional `issueNumber` prop; `handleJump` route-fallback
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx` - Drops outer `p-6` from empty/loading/main roots (keeps the bordered error card's)
- `apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx` - Drops outer `p-6` from both roots
- `apps/dispatch-control/components/galley/AnnotationMark.tsx` - Popover self-clamp `useLayoutEffect`
- `apps/dispatch-control/components/galley/PassageToolbar.tsx` - `top` floored at 60; `left` clamped to viewport
- `apps/dispatch-control/components/decision-log/DecisionLog.tsx` - `<dd>` cells get `min-w-0 break-words`
- `apps/dispatch-control/app/(dashboard)/run-monitor/layout.tsx` - Tab bar `sticky top-0 z-20` + opaque rail background
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/page.tsx` - `-m-6` → `-mx-6`
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/page.tsx` - Root `mx-auto w-full max-w-[1600px]`
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/page.tsx` - Root `mx-auto w-full max-w-[1600px]`
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunsTable.tsx` - Caps to latest 50 + "Show all" toggle
- `apps/dispatch-control/app/(dashboard)/eval-center/_components/DriftScoreboard.tsx` - Table wrapped in `overflow-x-auto`; caps to latest 20 per scenario + toggle
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx` - Caps to latest 20 + "Show older" toggle
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/DiffViewer.tsx` - `max-h-[480px]`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/_components/IssueComments.tsx` - Caps to latest 20 + "Show earlier comments" toggle above the list
- `apps/dispatch-control/__tests__/DecisionRail.roleGate.test.tsx` - Added `useRouter` to the `next/navigation` mock
- `apps/dispatch-control/__tests__/DecisionRail.test.tsx` - Added a `next/navigation` mock with `useRouter`
- `apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx` - Added `useRouter` to the existing `next/navigation` mock
- `apps/dispatch-control/__tests__/WorkspaceApprovalPanelLoop.test.tsx` - Added `useRouter` to the existing `next/navigation` mock
- `apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx` - Added `useRouter` to the existing `next/navigation` mock
- `apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx` - Added `useRouter` to the existing `next/navigation` mock
- `apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx` - Added `useRouter` to the existing `next/navigation` mock
- `apps/dispatch-control/__tests__/WorkspaceOutline.test.tsx` - Added a `next/navigation` mock with `useRouter`/`useParams`
- `apps/dispatch-control/__tests__/WorkspaceOutlineEmptyState.test.tsx` - Added `useRouter` to the existing `next/navigation` mock

## Decisions Made

- Called the new `useState` for each list-cap toggle (`RunsTable`, `DriftScoreboard`) BEFORE the component's loading/empty early-return guards, not literally "after the guards" as the plan's prose read — calling a hook only on some renders (once a Convex query resolves from `undefined` to data) violates Rules of Hooks. This matches the codebase's own established convention (`VersionHistoryPanel` already declares its toggle state before its early return).
- Implemented `AnnotationMark`'s popover self-clamp exactly as the plan/audit specified (`style={{ left: popoverShift }}` on overflow), matching `HelpTip`'s existing self-clamp pattern in this codebase rather than introducing a different positioning strategy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `useRouter` to 9 test files' `next/navigation` mocks**
- **Found during:** Task 3's final gate run (`pnpm --filter dispatch-control test`)
- **Issue:** Task 2's jump-nav fallback (`WorkspaceOutline`/`DecisionRail`/`SourceIndex` now call `useRouter()`) broke 9 pre-existing test files whose `next/navigation` mocks either omitted `useRouter` entirely or didn't mock the module at all — these components are mounted transitively by the real `IssueWorkspaceLayout`/`DecisionRail` integration-test harnesses (`WorkspaceLayout.test.tsx`, `FrameChromeCostReadout.test.tsx`, `WorkspaceDraftLoadLoop.test.tsx`, `WorkspaceContextPanelSlot.test.tsx`, `WorkspaceApprovalPanelLoop.test.tsx`, `WorkspaceOutlineEmptyState.test.tsx`, `WorkspaceOutline.test.tsx`, `DecisionRail.test.tsx`, `DecisionRail.roleGate.test.tsx`), causing "invariant expected app router to be mounted" / "No useRouter export is defined on the mock" failures.
- **Fix:** Added `useRouter: () => ({ push: vi.fn() })` to each affected mock (or a new minimal `next/navigation` mock where none existed). No assertions were changed or removed.
- **Files modified:** the 9 test files listed above.
- **Verification:** `pnpm --filter dispatch-control test` — 1085/1085 passed, 136 files (was 58 failed across 9 files before the fix).
- **Committed in:** `c81c400` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing test router mocks)
**Impact on plan:** Necessary companion fix required by the plan's own `<verification>` gate ("both must be green"); no production logic changed, no assertions weakened.

## Issues Encountered

None beyond the test-mock deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three tasks complete; `pnpm --filter dispatch-control build` and `pnpm --filter dispatch-control test` (1085/1085, 136 files) both pass.
- All `data-testid`/aria attributes preserved and moved with their elements (verified by the full green test suite, which exercises them).
- No `convex/*.ts` files touched; no sign-off-gate or data-flow logic changed — confirmed by `git show --stat` on all three task commits (layout/markup/CSS/test-mock files only).
- No stubs introduced — this was a pure layout/markup/CSS/routing-fallback pass with zero new data sources.

---
*Phase: quick-260722-tv1*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 27 planned source files plus this SUMMARY.md confirmed present on disk; all 3 task commits (`8dd442d`, `d913ff8`, `c81c400`) confirmed present in `git log`.
