---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 02
subsystem: ui
tags: [nextjs, app-router, redirects, dispatch-control, routing]

# Dependency graph
requires:
  - phase: 30-01
    provides: 1c design tokens (globals.css @theme block) + Newsreader/Lora/Space Grotesk/IBM Plex Mono fonts consumed by the placeholder pages and tab shell
provides:
  - Final v3.0 route set live: /review-desk, /signal-desk, /run-monitor (+/runs, /graph tabs), /voice-pass, /prompt-lab (+ [agentKey]), /eval-center, /registry, /how-to-use
  - Permanent redirects from /graph, /runs, /prompts (+ :path*) to their v3.0 homes in next.config.ts
  - Home (/) redirects to /review-desk instead of /graph
  - Shared components/_PlaceholderScreen.tsx (1c-token-only, phase-labeled honest placeholder)
affects: [30-05-grouped-nav-sidebar, 30-06-awaiting-you-inbox, 30-07-how-to-use-screen, 37-run-monitor-v2, 38-eval-center]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Honest-placeholder pattern (D-02): PlaceholderScreen server component + phase-labeled marigold chip for not-yet-built screens"
    - "Tab-shell-via-layout pattern: run-monitor/layout.tsx (client, usePathname) renders the tab bar and wraps run-monitor/{runs,graph} sub-routes; bare run-monitor/page.tsx redirects to the default tab"

key-files:
  created:
    - apps/dispatch-control/components/_PlaceholderScreen.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/page.tsx
    - apps/dispatch-control/app/(dashboard)/signal-desk/page.tsx
    - apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx
    - apps/dispatch-control/app/(dashboard)/eval-center/page.tsx
    - apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/page.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/layout.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/page.tsx
    - apps/dispatch-control/next.config.ts
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/{RunsTable,ReviewQueue,RunDetail}.tsx (repointed hrefs)"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/{PromptsListClient,agentList}.ts (repointed hrefs/import)"
    - "graph/, runs/, prompts/ directories moved (git mv) to run-monitor/graph, run-monitor/runs, prompt-lab"

key-decisions:
  - "Tab shell implemented as a layout.tsx (client component, usePathname) wrapping run-monitor/{runs,graph}, with the bare run-monitor/page.tsx doing a plain redirect to /run-monitor/runs — satisfies the plan's 'tab shell + redirect on bare path is acceptable' instruction while making the tabs visible on both sub-routes, not just a page that immediately redirects away"
  - "lib/nav.ts (sidebar nav items still pointing at /graph, /runs, /prompts) was left untouched — out of this plan's explicit grep/file scope (app/ and components/ only); old links still function correctly via the new next.config.ts permanent redirects, and Plan 30-05 (grouped-nav-sidebar) owns rewriting nav.ts to the final route set"

requirements-completed: [CHR-03]

# Metrics
duration: ~10min
completed: 2026-07-07
---

# Phase 30 Plan 02: Route Skeleton & Redirects Summary

**Final v3.0 dispatch-control route set (review-desk, signal-desk, run-monitor tab shell, voice-pass, prompt-lab, eval-center) landed with permanent old-path redirects and home now pointing at Review Desk.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 3
- **Files modified/created:** 8 new files, 7 modified files, 3 directories moved

## Accomplishments
- Four not-yet-built screens (Review Desk, Signal Desk, Voice Pass, Eval Center) now render a shared 1c-styled, phase-labeled placeholder instead of 404ing or not existing
- `/run-monitor` hosts the existing Runs list and Graph visualizer as two tabs (cobalt active-tab underline) under one nav slot — nothing lost, one route consolidated
- `/prompts` renamed to `/prompt-lab` (including the `[agentKey]` dynamic route) ahead of Phase 28/38 work landing directly in its final home
- Old paths (`/graph`, `/runs`, `/prompts`, with `:path*` sub-routes) permanently redirect (308) to their new homes via `next.config.ts`
- Dashboard home (`/`) now redirects to `/review-desk` instead of `/graph` (D-04, supersedes Phase 21 D-09)

## Task Commits

Each task was committed atomically. Note: due to concurrent parallel-executor commits sharing this repo's git index (see Deviations), Task 2's file-move work landed inside another executor's commit rather than its own — the content is correct and verified in HEAD; only the commit attribution is imperfect.

1. **Task 1: 1c placeholder pages** - `d4ec353` (feat)
2. **Task 2: move Runs+Graph under /run-monitor, rename /prompts → /prompt-lab** - swept into `029673f` / `d9bebe7` (concurrent Plan 30-04 commits; see Deviations) — content verified present and correct in HEAD
3. **Task 3: home redirect + next.config redirects** - `ea319aa` (feat)

## Files Created/Modified
- `apps/dispatch-control/components/_PlaceholderScreen.tsx` - shared 1c-token-only placeholder (title/phase/blurb props)
- `apps/dispatch-control/app/(dashboard)/{review-desk,signal-desk,voice-pass,eval-center}/page.tsx` - phase-labeled placeholders
- `apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx` - minimal stub (full content in 30-07)
- `apps/dispatch-control/app/(dashboard)/run-monitor/page.tsx` - bare-path redirect to `/run-monitor/runs`
- `apps/dispatch-control/app/(dashboard)/run-monitor/layout.tsx` - Runs/Graph tab bar shell
- `apps/dispatch-control/app/(dashboard)/run-monitor/{graph,runs}/` - moved from `app/(dashboard)/{graph,runs}/` via `git mv`
- `apps/dispatch-control/app/(dashboard)/prompt-lab/` - moved from `app/(dashboard)/prompts/` via `git mv`
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/{RunsTable,ReviewQueue,RunDetail}.tsx` - internal hrefs repointed to `/run-monitor/runs/...`
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/{PromptsListClient.tsx,agentList.ts}` - href + import repointed to `/prompt-lab/...` and `../../run-monitor/graph/...`
- `apps/dispatch-control/app/(dashboard)/page.tsx` - `redirect('/graph')` → `redirect('/review-desk')`
- `apps/dispatch-control/next.config.ts` - added `redirects()` with 6 permanent old→new path entries

## Decisions Made
- Tab shell built as a `layout.tsx` (not folded into `page.tsx`) so the tab bar renders on both `/run-monitor/runs` and `/run-monitor/graph`, while `page.tsx` stays a one-line redirect for the bare path — matches the plan's stated flexibility ("tab mechanics are Claude's discretion")
- `lib/nav.ts` sidebar links (still `/graph`, `/runs`, `/prompts`) intentionally left unchanged — outside this plan's file scope (Plan 30-05 owns the nav rewrite); the new `next.config.ts` redirects mean clicking those stale nav links still lands correctly on the new routes today

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed literal `neutral-` substring appearing in own doc comment, tripping the negative-grep acceptance check**
- **Found during:** Task 1
- **Issue:** `_PlaceholderScreen.tsx`'s header comment said "never literal `neutral-*`/`white`", which itself contains the substring `neutral-`, making `grep -Lq "neutral-"` fail even though no actual `neutral-*` Tailwind classes were used in the file
- **Fix:** Reworded the comment to "never literal Tailwind gray-scale or white classes" (no literal `neutral-` substring)
- **Files modified:** apps/dispatch-control/components/_PlaceholderScreen.tsx
- **Verification:** `grep -Lq "neutral-"` now lists the file (no match found), confirming the acceptance criterion
- **Committed in:** d4ec353 (Task 1 commit)

### Concurrent-execution note (not a deviation from plan content, but affects commit attribution)

This plan ran as one of several parallel executors sharing the same git working directory/index (per the parallel-execution protocol). Task 2's `git mv` operations (moving `graph/`, `runs/` under `run-monitor/`, renaming `prompts/` → `prompt-lab/`) and the subsequent link-fix edits were staged in the shared index at the same time another executor (Plan 30-04, Masthead work) ran `git commit` without a pathspec — which commits the entire current index, not just the files that executor explicitly `git add`ed. As a result, Task 2's file moves and edits appear in commits `029673f` ("feat(30-04): add Masthead component…") and `d9bebe7` ("feat(30-04): mount Masthead above sidebar+main…") rather than in a dedicated Plan-30-02 commit. The file content, directory structure, and link fixes were independently verified against this plan's acceptance criteria after the fact (all greps pass, `pnpm --filter dispatch-control build` exits 0 with the full expected route list). No rebase/history rewrite was attempted, per the constraint against destructive git operations while other agents may still be active. Task 1 and Task 3 committed cleanly under their own hashes (`d4ec353`, `ea319aa`).

---

**Total deviations:** 1 auto-fixed (1 blocking/acceptance-criteria fix) + 1 commit-attribution note (no functional impact)
**Impact on plan:** No scope creep; final on-disk/HEAD state matches every acceptance criterion in the plan.

## Issues Encountered
- See "Concurrent-execution note" above — resolved by verification rather than remediation, since the underlying content was correct.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 30-05 (grouped-nav-sidebar) can now point every nav item at a real route (`lib/nav.ts` rewrite is its job)
- Plan 30-06 (Awaiting-you inbox) can route inbox items at `/review-desk`, `/run-monitor/runs/{runId}/review`, etc.
- Plan 30-07 (how-to-use content) has a stub page to fill in
- Phases 31-39 build directly into their final route homes (`/review-desk`, `/signal-desk`, `/voice-pass`, `/prompt-lab`, `/eval-center`, `/run-monitor`) with no further renames needed

---
*Phase: 30-foundation-design-system-chrome-awaiting-you-inbox*
*Completed: 2026-07-07*

## Self-Check: PASSED

All created files verified present; both dedicated task commits (d4ec353, ea319aa) verified in git log; Task 2 content verified present in HEAD (attributed to concurrent commits 029673f/d9bebe7 per the documented deviation) and confirmed via full `pnpm --filter dispatch-control build` passing with the complete expected route list.
