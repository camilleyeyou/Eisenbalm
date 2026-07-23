---
phase: quick-260722-n5r
plan: 01
subsystem: ui
tags: [nextjs, tailwind, react, dispatch-control, css-container-queries, workspace-layout]

# Dependency graph
requires:
  - phase: 41-issue-workspace-frame
    provides: The Issue Workspace frame (layout.tsx), WorkspaceOutline, ContextPanel, and the Draft/Fact Check/Voice/Approval stage split this plan restyles
provides:
  - Widened (1600px) Issue Workspace frame with sticky stage-tab nav and independently-scrolling sticky outline/context rails
  - Container-query-driven galley type scale (headline/h2 resolve against the galley's own width, not the viewport)
  - De-duplicated Draft navigation (SectionChipList orientation prop; no nested chip column in galley mode)
  - Fact Check claims grouped into collapsible per-section sections
  - Approval DecisionRail constrained to a readable measure
affects: [issue-workspace, review-desk, fact-check, approval-stage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS container queries (container-type: inline-size + cqi units) as the fallback-safe way to scale display type against a component's own column width instead of the viewport, guarded by @supports so the existing clamp(vw) rule remains the non-container fallback"
    - "Presentational orientation prop ('vertical' | 'horizontal') on a single shared list component instead of forking it for two layout roles"

key-files:
  created: []
  modified:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx
    - apps/dispatch-control/app/globals.css
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx
    - apps/dispatch-control/__tests__/FactCheckScreen.test.tsx

key-decisions:
  - "Kept the viewport-based clamp(vw) galley type-scale rule as the fallback and layered an @supports (container-type: inline-size) override on top, rather than replacing it outright — browsers without container-query support still get a sane (if less ideal) scale"
  - "Scoped the one FactCheckScreen test assertion that collided with the new group-header text (within the summary region) rather than loosening the assertion's specificity, matching the pattern already used by sibling tests in the same file"

requirements-completed: [ISSUE-WORKSPACE-STAGE-LAYOUT-REDESIGN]

# Metrics
duration: ~10min
completed: 2026-07-23
---

# Quick Task 260722-n5r: Redesign Issue Workspace Stage Pages Layout Summary

**Widened the Issue Workspace frame to 1600px with sticky stage tabs + independently-scrolling sticky rails, switched the galley headline/h2 type scale to container-query units so it stops wrapping one word per line, removed Draft's duplicate section-chip column, and grouped Fact Check's flat 132-claim list into collapsible per-section sections.**

## Performance

- **Duration:** ~10 min (3 task commits, 16:51–17:00 UTC-7)
- **Started:** 2026-07-22T23:51:08Z (first task commit)
- **Completed:** 2026-07-23T00:00:01Z (last task commit)
- **Tasks:** 3 completed
- **Files modified:** 7 (6 planned + 1 companion test fix)

## Accomplishments

- Frame widened from `max-w-[1200px]` to `max-w-[1600px]`; grid changed from `220px_1fr_300px` to `232px_minmax(0,1fr)_320px` with `lg:items-start` so the canvas can no longer be starved and the sticky rails below can travel independently.
- Stage-tab nav (`sticky top-0 z-30`) and both side rails (`lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto`) stay reachable/visible while the center canvas scrolls the page.
- `.galley-root` now establishes a CSS container-query context (`container-type: inline-size`); `.galley-headline`/`.galley-h2` get an `@supports`-guarded `cqi`-based override (44px/26px caps) so type resolves against the galley's own column width instead of the viewport — the original `clamp(vw)` rule remains as the non-container fallback.
- `ApprovalStage.tsx`'s `DecisionRail` is wrapped in `max-w-[760px]` so it no longer stretches edge-to-edge across the widened canvas.
- `SectionChipList` gained an `orientation` prop (`'vertical'` default, `'horizontal'`); `ReviewDeskRunView` no longer nests a nested `lg:w-64` chip column beside the galley (it duplicated the frame's `WorkspaceOutline` jump-nav) — the chip strip now renders only in edit mode, as a horizontal section-selector strip above the editor.
- `FactCheckScreen`'s claim list is reorganized into collapsible groups, one per `EDITABLE_SECTIONS` entry (reading order) plus a trailing "Other" group for unresolved `sectionName`s. Groups where every claim is `'checked'` (via the existing shared `deriveClaimChipState` classifier — no forked logic) default collapsed; any group with a must-fix/unchecked/changed/review-recommended claim defaults open. Group headers show `{claims} claims · {mustFix} must fix · {unchecked} unchecked`. Filters, selection state, the published context-panel card, and all six claim actions are untouched — purely a render reorganization of `filteredRows`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen & stabilize the frame** — `30938fd` (feat) — layout.tsx sticky nav/rails + widened grid, globals.css container-query galley scale, ApprovalStage.tsx readability measure
2. **Task 2: De-duplicate Draft navigation** — `53a91a2` (feat) — SectionChipList orientation prop, ReviewDeskRunView column removal + edit-mode horizontal strip
3. **Task 3: Group Fact Check claims** — `9d50a80` (feat) — FactCheckScreen.tsx per-section collapsible grouping + one companion test-assertion scope fix

_No TDD tasks in this plan — layout/CSS/markup restructuring, verified via `typecheck`/`build`/`test`, not test-first._

## Files Created/Modified

- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx` - Widened frame (`max-w-[1600px]`), `232px_minmax(0,1fr)_320px` + `lg:items-start` grid, sticky stage-tab nav, both side rails wrapped in independently-scrolling sticky shells
- `apps/dispatch-control/app/globals.css` - `.galley-root` gets `container-type: inline-size`; `@supports`-guarded `cqi` headline/h2 override layered on top of the existing viewport-clamp fallback
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx` - `DecisionRail` wrapped in a `max-w-[760px]` readability measure
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx` - New `orientation?: 'vertical' | 'horizontal'` prop (default `'vertical'`, unchanged behavior); `'horizontal'` switches the `<nav>` to `flex flex-wrap`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx` - Removed the nested `lg:w-64` chip column; canvas is now a single full-width column; `SectionChipList` (horizontal) renders only under `viewMode === 'edit'`, above the editor body
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx` - Added `sectionGroupKeyFor`/`buildClaimGroups`/`defaultCollapsedFor`/`chipStateForRow` helpers and per-group collapse state (`collapseOverrides`); claim `<ul>` render replaced with one collapsible group per section
- `apps/dispatch-control/__tests__/FactCheckScreen.test.tsx` - Scoped the "renders every counter explicitly" test's assertions to the summary region (`within(getByRole('region', ...))`) so the new group-header counts text no longer collides with the summary counter text under `getByText`

## Decisions Made

- Kept the viewport-based `clamp(30px, 4vw, 52px)` galley headline rule as-is and layered an `@supports (container-type: inline-size)` override on top (per plan spec) rather than replacing it, preserving a sane fallback for any container-query-unsupporting environment.
- For the Fact Check section-key resolution, checked `claim_checks.sectionName` against `EDITABLE_SECTIONS` ids directly first (the vocabulary it actually uses per the plan's verified facts), falling back to `qaSectionToGalleyId` only for legacy snake_case rows — matches the plan's specified two-step resolution exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Scoped a FactCheckScreen test assertion to fix a getByText collision introduced by Task 3's grouping**
- **Found during:** Task 3 (`pnpm --filter dispatch-control test` run after implementing the grouped claim list)
- **Issue:** The existing "renders every counter explicitly, even at zero — never omitted" test used an unscoped `screen.getByText(/0 must fix/i)`. Once claims render inside per-section group headers (`"{claims} claims · {mustFix} must fix · {unchecked} unchecked"`), a single-claim fixture produces a group header whose text also matches `/0 must fix/i`, so the unscoped query now matches two elements and throws.
- **Fix:** Scoped the affected assertions to the summary region via `within(screen.getByRole('region', { name: 'Fact check summary' }))`, mirroring the pattern already used by the two sibling tests above it in the same file (loading/empty states).
- **Files modified:** `apps/dispatch-control/__tests__/FactCheckScreen.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test` — 1085/1085 passed (was 1084 passed / 1 failed before the fix)
- **Committed in:** `9d50a80` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — test-assertion collision)
**Impact on plan:** Necessary companion fix to keep `pnpm --filter dispatch-control test` green after Task 3's required grouping feature; not scope creep — the plan's own `<verification>` section requires the test suite to pass. No production logic changed.

## Issues Encountered

None beyond the test-assertion collision documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three tasks complete; `pnpm --filter dispatch-control build` and `pnpm --filter dispatch-control test` (1085/1085) both pass.
- `git diff --name-only db75105..HEAD -- apps/dispatch-control` lists exactly the 6 planned files plus the 1 companion test fix — no server/Convex/run-monitor/VoicePassRunView changes, matching the plan's constraints.
- All `data-testid` attributes preserved (`fact-check-row-*`, `chip-count`, `workspace-tab-*`, `cost-vs-budget`, etc.) — verified via the full green test suite, which exercises them.
- No stubs introduced — this was a pure layout/markup/CSS restructuring with zero data-flow changes.

---
*Phase: quick-260722-n5r*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 7 modified/created source files and the SUMMARY.md confirmed present on disk; all 3 task commits (`30938fd`, `53a91a2`, `9d50a80`) confirmed present in `git log`.
