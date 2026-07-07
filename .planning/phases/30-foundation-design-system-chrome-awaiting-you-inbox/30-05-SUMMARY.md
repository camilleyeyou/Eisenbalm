---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 05
subsystem: ui
tags: [nextjs, react, tailwind, dispatch-control, nav, design-system]

# Dependency graph
requires:
  - phase: 30-01
    provides: 1c design token CSS variables (--color-ink, --color-nav, --color-vermilion, --color-faint, --color-masthead-text) in apps/dispatch-control/app/globals.css
  - phase: 30-02
    provides: real page.tsx files for all 11 grouped-nav routes + how-to-use stub (route skeleton)
provides:
  - "Grouped NAV_GROUPS + NAV_PINNED shape in lib/nav.ts (supersedes Phase 21's flat 7-item NAV_ITEMS)"
  - "Rewritten AppSidebar.tsx rendering the 1c grouped chrome (210px, #e3e5e8, vermilion active-border formula)"
  - "Rewritten nav.test.ts coverage gate walking all groups + pinned item against real page.tsx files"
affects: [30-06, 30-07, 30-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grouped nav data shape (NavGroup[] + pinned NavItem) as the canonical structure for dispatch-control chrome"
    - "Active-state formula: 3px left border (vermilion active / transparent inactive) + ink bg + masthead-text color on active, matching dc.html spec verbatim"

key-files:
  created: []
  modified:
    - apps/dispatch-control/lib/nav.ts
    - apps/dispatch-control/components/AppSidebar.tsx
    - apps/dispatch-control/__tests__/nav.test.ts

key-decisions:
  - "Removed the duplicate Clerk UserButton from the sidebar footer — Masthead (Plan 30-04) now owns the single sign-out affordance"
  - "Dropped lucide icon imports from nav items entirely per dc.html spec (text-only nav)"

requirements-completed: [CHR-03]

# Metrics
duration: 4min
completed: 2026-07-06
---

# Phase 30 Plan 05: Grouped Nav Sidebar Summary

**Rewrote dispatch-control's flat 7-item nav into a workflow-ordered 3-group structure (Workflow / Craft & memory / Operations) with a pinned How-to-use item, and rebuilt AppSidebar.tsx to the 1c chrome spec (210px, #e3e5e8, vermilion active-border).**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-06T18:29:00-07:00
- **Completed:** 2026-07-06T18:33:00-07:00
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `lib/nav.ts` now exports `NAV_GROUPS` (3 labeled groups, 10 items total) + `NAV_PINNED` ("How to use"), replacing the flat `NAV_ITEMS` array and its lucide icon imports
- `AppSidebar.tsx` rebuilt to the dc.html 1c grouped chrome: 210px width, `#e3e5e8` background, group labels in Space Grotesk 9px uppercase, nav items with the exact active-state formula (3px vermilion left border + ink background + masthead-text color when active)
- `nav.test.ts` rewritten to assert the 3 group labels in order, Review Desk as the Workflow group's first item (home), and every href across all groups + the pinned item resolves to a real `page.tsx` on disk — no stale flat-array assertion left behind

## Task Commits

Each task was committed atomically:

1. **Task 1: Grouped NAV structure in lib/nav.ts + rewritten nav.test.ts** - `9c90d4e` (feat)
2. **Task 2: Rebuild AppSidebar.tsx to the 1c grouped chrome** - `f338f54` (feat)

**Plan metadata:** (this commit) - `docs: complete 30-05 plan`

## Files Created/Modified
- `apps/dispatch-control/lib/nav.ts` - Grouped `NAV_GROUPS`/`NavGroup`/`NavItem` shape + `NAV_PINNED`, icon imports dropped
- `apps/dispatch-control/components/AppSidebar.tsx` - Rebuilt to render grouped nav + pinned item in the 1c skin with the dc.html active-state formula; duplicate `UserButton` removed
- `apps/dispatch-control/__tests__/nav.test.ts` - Rewritten coverage gate walking groups + pinned item, asserting real `page.tsx` existence per href

## Decisions Made
- Removed the sidebar's Clerk `UserButton` entirely rather than keeping a second sign-out affordance — the Masthead (Plan 30-04) already renders it in the top-right, so keeping both would create a duplicate-action UX regression called out explicitly in the plan.
- Kept `isActiveHref` matching logic (`pathname === href || pathname.startsWith(href + '/')`) unchanged from the prior flat sidebar so `/run-monitor/*` subpaths still highlight `Run Monitor` correctly, per the plan's interface note.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their acceptance criteria on the first pass; no auto-fixes were required in the files this plan owns.

## Issues Encountered

While running the plan's own verification command (`pnpm --filter dispatch-control build`), the build failed with a TypeScript syntax error in `app/(dashboard)/how-to-use/page.tsx` — an unrelated, uncommitted, in-flight change from a concurrently-running executor (a `*/`-inside-comment bug, not caused by this plan's files). Per the parallel-execution scope boundary, this file is not in this plan's `files_modified` list and was not touched. To verify my own changes in isolation, I stashed that single file (`git stash push -- <path>`), ran `pnpm --filter dispatch-control test -- --run` (215/215 passed, including nav.test.ts 4/4) and `pnpm --filter dispatch-control build` (exit 0, all 19 routes including `/run-monitor` and the grouped-nav pages built cleanly), then restored the stashed file exactly as found. This plan's two files (`lib/nav.ts`, `AppSidebar.tsx`) are verified clean; the other executor's file remains their responsibility to fix before their own commit.

A second concurrent, uncommitted change (`components/Masthead.tsx`, also outside this plan's scope) causes 8 pre-existing `Masthead.test.tsx` failures when running the full suite with all working-tree changes present simultaneously — unrelated to nav/AppSidebar and not touched by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CHR-03 (grouped, workflow-ordered nav with pinned How-to-use, 1c skin, no dead links) is complete and independently verified (isolated test + build pass).
- Plans 30-06/30-07/30-08 (Awaiting-you inbox, how-to-use full content, remaining chrome work) can build on the now-stable `NAV_GROUPS`/`NAV_PINNED` shape.
- No blockers from this plan. The two concurrent-executor issues noted above (how-to-use syntax error, Masthead test failures) are outside this plan's ownership and should resolve when those executors commit their own work.

---
*Phase: 30-foundation-design-system-chrome-awaiting-you-inbox*
*Completed: 2026-07-06*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commits (`9c90d4e`, `f338f54`) verified present in git history.
