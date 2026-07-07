---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 04
subsystem: ui
tags: [nextjs, convex, clerk, tailwind-v4, dispatch-control]

# Dependency graph
requires:
  - phase: 30-01
    provides: 1c design tokens in globals.css (--color-ink, --color-vermilion, --color-marigold, --color-green, --color-masthead-text/-muted, --color-rail) + next/font/google-loaded fonts (--font-ui, --font-mono)
provides:
  - Masthead.tsx — persistent 52px ink masthead with 4 live Convex-wired chips (issue #, pipeline-state, MTD spend vs cap, auto-publish lock) + Awaiting-you trigger + Clerk sign-out
  - AwaitingYouTrigger — standalone exported button component for Plan 30-06 to wire the inbox dropdown onto
  - (dashboard)/layout.tsx column shell (Masthead full-width on top, sidebar+main row below) mounted on every dashboard route
affects: [30-06-awaiting-you-inbox, 30-05-grouped-nav-sidebar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-table Convex join: runs.latest (Phase 21+ table, no issueNumber) -> pipelineRuns.byRunId (Phase 4 table, has issueNumber) via the 'skip' sentinel when the first query hasn't resolved a runId yet"
    - "pipeline_config row lookup by key with JSON.parse (monthly_cap_usd, auto_publish) — same canonical keys BudgetCapsPanel.tsx already reads/writes, not the pipeline-side env var"

key-files:
  created:
    - apps/dispatch-control/components/Masthead.tsx
    - apps/dispatch-control/__tests__/Masthead.test.tsx
    - .planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/deferred-items.md
  modified:
    - "apps/dispatch-control/app/(dashboard)/layout.tsx"

key-decisions:
  - "Pipeline-state chip is a fixed marigold treatment (bg marigold / text ink) regardless of status value, per the dc.html spec's single chip formula — status text itself (Running/Awaiting review/Complete/Failed) is the only thing that varies"
  - "Auto-publish chip renders as colored text (green=OFF safe state, vermilion=ON danger state) rather than a filled badge, keeping it visually distinct from the pipeline-state chip"
  - "AwaitingYouTrigger exported as a standalone named export (not just inlined JSX) so Plan 30-06 can attach open/close dropdown state without re-authoring the button markup"

patterns-established:
  - "Masthead chips render conditionally per-query (undefined guards) rather than blocking the whole masthead behind a single loading gate — each chip appears independently as its backing query resolves"

requirements-completed: [CHR-02]

# Metrics
duration: ~20min
completed: 2026-07-07
---

# Phase 30 Plan 04: Masthead Summary

**Persistent 52px ink masthead wired to 4 live Convex queries (runs.latest, pipelineRuns.byRunId, runs.monthToDateCost, pipelineConfig.getAll) and mounted above the sidebar+main row on every dashboard route.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-07T01:16:30Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `Masthead.tsx` renders the wordmark ("DISPATCH" + vermilion "/" + "CONTROL"), an issue-number chip cross-referencing `pipelineRuns.byRunId` off `runs.latest` (with a graceful "Issue —" dash when unresolved), a pipeline-state chip, a month-to-date-spend-vs-cap readout (`$X.XX / $cap`, vermilion-tinted numerator at/over cap), and an auto-publish lock chip (green OFF / vermilion ON) — all sourced from already-existing Convex queries, zero new backend
- `AwaitingYouTrigger` exported standalone with a clear `{/* AwaitingYouInbox mounts here in 30-06 */}` insertion point for the next plan's dropdown wiring
- Clerk `<UserButton />` mounted at the far right for sign-out
- `(dashboard)/layout.tsx` rewritten to a column shell (`<Masthead/>` full-width on top, `<AppSidebar/>`+`<main>` row below) so the masthead is persistent across every dashboard route; `<AutoPublishBanner/>` preserved unchanged inside `<main>`
- 9/9 component tests green covering every `<behavior>` assertion from the plan

## Task Commits

1. **Task 1: Masthead.tsx — 4 live chips + Awaiting-you trigger + sign-out** - `029673f` (feat)
2. **Task 2: Mount Masthead in the dashboard layout** - `d9bebe7` (feat)

_Note: both commits' diffs include extra renamed/new files from other concurrently-executing Phase 30 plans sharing the same git index (parallel-execution index contamination — see Issues Encountered). No content authored by 30-04 was affected._

## Files Created/Modified
- `apps/dispatch-control/components/Masthead.tsx` - persistent masthead component, 4 live chips + Awaiting-you trigger + sign-out
- `apps/dispatch-control/__tests__/Masthead.test.tsx` - 9 component tests (convex/react + @clerk/nextjs mocked per `runControl.test.tsx` precedent)
- `apps/dispatch-control/app/(dashboard)/layout.tsx` - column shell mounting `<Masthead/>` above the sidebar+main row
- `.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/deferred-items.md` - logged unrelated full-suite test failures from other in-flight Phase 30 plans (out of scope)

## Decisions Made
- Cross-referenced `pipelineRuns.byRunId` off `runs.latest.runId` (via the Convex `'skip'` sentinel, already an established pattern in this codebase — `PipelineGraph.tsx`, `AgentIOPanel.tsx`) to resolve `issueNumber`, since the newer `runs` table doesn't carry it — matches RESEARCH Open Question 2's recommendation exactly
- Used `monthly_cap_usd` / `auto_publish` `pipeline_config` keys (the same canonical keys `BudgetCapsPanel.tsx` reads/writes) rather than any pipeline-side env var, per RESEARCH Pattern 2
- Kept the pipeline-state chip's background fixed marigold (not status-conditional coloring) — matches the dc.html spec's single chip formula literally; only the label text varies by status

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance-criteria greps and behavior tests pass as specified.

## Issues Encountered

- **Parallel-execution git index contamination:** Three GSD executors are running concurrently against this repo. At each commit boundary, `git commit` (even after staging only this plan's specific files with `git add <path>`) also picked up additional renamed/new files staged by other concurrently-running executors' in-progress work (e.g. the `prompts/` → `prompt-lab/` and `graph|runs/` → `run-monitor/` route reorganization from other Phase 30 plans). This is inherent to running multiple executors against a single shared git working tree/index and is documented in the orchestrator's parallel-execution guidance; it does not indicate any content authored by 30-04 was incorrect, and no destructive operation was performed. Flagging here for the orchestrator's awareness in case any downstream plan's own commit ends up with nothing new to stage.
- **Full dispatch-control test suite was red at the time of this plan's execution** (49/182 failing across 12 files) due to other Phase 30 plans' in-progress route moves and Phase 28 prompt-console files following those moves — none of the failing files were touched by this plan. Logged in `deferred-items.md`; `Masthead.test.tsx` (9/9) and `pnpm --filter dispatch-control build` (exit 0, 19 routes) both passed cleanly for this plan's diff.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 30-06 (Awaiting-you inbox) can now import `AwaitingYouTrigger` from `Masthead.tsx` and attach dropdown state at the documented insertion point without touching the masthead's chip logic
- The masthead's live-data wiring pattern (cross-table Convex join + `pipeline_config` key lookups) is established and reusable for any future chrome that needs the same data
- Once the other concurrently-running Phase 30 plans (30-02/30-03/30-05) land their route-move and token-swap work, a full clean `pnpm --filter dispatch-control test -- --run` should be re-run by the phase orchestrator to confirm the complete green baseline (see deferred-items.md)

---
*Phase: 30-foundation-design-system-chrome-awaiting-you-inbox*
*Completed: 2026-07-07*
