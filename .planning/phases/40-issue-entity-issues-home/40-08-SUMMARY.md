---
phase: 40-issue-entity-issues-home
plan: 08
subsystem: ui
tags: [react, nextjs, convex, dispatch-control, derived-state, lucide-react, vitest]

# Dependency graph
requires:
  - phase: 40-02
    provides: "convex/issues.ts (byIssueNumber, held/published fields) + convex/pipelineRuns.ts byRunId (existing, issueNumber lookup)"
  - phase: 40-04
    provides: "lib/derivedState.ts (deriveIssueStatus, deriveTasks, DerivationInputs)"
  - phase: 40-05
    provides: "/issues home screen — the /issues page.tsx nav destination the restructured Editorial group now points at"
provides:
  - "Masthead.tsx rebuilt into four separate, never-blended, label+icon readouts (Issue status, System activity, My Tasks count, Cost vs budget) per ISS-05 / D-24"
  - "lib/nav.ts NAV_GROUPS restructured into Editorial / System Workbench / Operations per ISS-02 / D-31 (§40.9) — Review Desk, Signal Desk, Voice Pass removed from the nav"
  - "Auto-publish OFF header copy renamed to 'Human approval required' (D-26)"
affects: [40-09-integration-gate, 41-issue-workspace, 43-my-tasks-screen, 50-nomenclature-renames]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Header readouts resolve their DerivationInputs off the SAME existing runs.latest → pipelineRuns.byRunId wiring the masthead already had (not the full issues-list scan /issues/page.tsx performs) — a deliberate simplification scoped to header chrome, per the plan's explicit interface note"
    - "Each of the four ISS-05 readouts renders as its own isolated <span>/<button> node with its own label+icon — never nested inside a shared chip container, so no two state systems can visually blend"

key-files:
  created: []
  modified:
    - apps/dispatch-control/components/Masthead.tsx
    - apps/dispatch-control/__tests__/Masthead.test.tsx
    - apps/dispatch-control/lib/nav.ts
    - apps/dispatch-control/__tests__/nav.test.ts

key-decisions:
  - "Issue status derivation is scoped to the LATEST run (runs.latest → pipelineRuns.byRunId → issues.byIssueNumber), not the full in-progress-issue scan /issues/page.tsx performs over issuesList — this is what the plan's interfaces section explicitly specifies ('reusing the masthead's EXISTING wiring'), and it means a freshly-created issue with no run yet (e.g. before D-13's 'start early' triggers a run) will not be picked up by the header until a run exists for it. Acceptable: the header's job is 'what's the machine doing right now', and Phase 43's My Tasks screen (not the header) is the durable task-completeness signal."
  - "AwaitingYouTrigger renamed to MyTasksTrigger and exported standalone (same pattern as before) — no other file imported the old name, confirmed by repo-wide grep before renaming"
  - "My Tasks readout dropped the old solid-vermilion filled-button treatment in favor of the State & Icon Contract's label+icon-color convention (ink-soft at count=0, vermilion at count>0) — matching the other three readouts' visual language, per the UI-SPEC's explicit accent-reserved rule ('vermilion... the My Tasks readout icon ONLY when count > 0')"
  - "Kept the pre-existing 'Issue {n}' / 'Issue —' contextual chip alongside (not replacing) the new Issue-status readout — it is not one of the four ISS-05 state systems, but removing it would be an unrequested regression; nothing in the plan or UI-SPEC calls for its removal"
  - "ISS-06 'State unknown — refresh' is rendered as a clickable button (window.location.reload()) matching the IssueCard.tsx precedent, since Convex queries are already live-subscribed with no client-side retry lever"

patterns-established:
  - "Pattern: when a not-loaded/failed derived-state input reaches 'unknown', render AlertTriangle (vermilion) + a reload-triggering button reading 'State unknown — refresh' — now established in both IssueCard.tsx (40-05) and Masthead.tsx (40-08); Phase 41's stage tabs should follow the same convention"

requirements-completed: [ISS-05, ISS-02]

# Metrics
duration: 11min
completed: 2026-07-15
---

# Phase 40 Plan 08: Masthead + Nav Chrome Summary

**The global header split into four separate, never-blended, label+icon readouts (Issue status, System activity, My Tasks count, Cost vs budget), and the left nav restructured into Editorial / System Workbench / Operations with Review Desk, Signal Desk, and Voice Pass removed as top-level destinations.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-15T00:59:24Z
- **Completed:** 2026-07-15T01:10:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `lib/nav.ts`: `NAV_GROUPS` restructured into exactly `Editorial` (Issues only) / `System Workbench` (Run Monitor, Prompt Lab, Eval Center, Registry) / `Operations` (Config, Finance, Settings) per §40.9 — Review Desk, Signal Desk, and Voice Pass are gone from the nav (now issue sub-routes per D-07/D-09), and the file header comment documents the naming trap between the console's issueNumber-keyed `/issues/[n]` route tree and the pipeline's runId-keyed `/issues/{run_id}/...` endpoints
- `components/Masthead.tsx`: rebuilt from a single blended "pipeline-state chip" into four visually-isolated readouts — Issue status (`deriveIssueStatus`, with a structural ISS-06 "State unknown — refresh" fallback), System activity (`runs.latest.status` relabeled with `Loader2` spin reserved exclusively to "Running"), My Tasks (`deriveTasks(...).length`, still opening the existing `AwaitingYouInbox` dropdown per D-25), and Cost vs budget (unchanged `runs.monthToDateCost` + `pipelineConfig` wiring)
- Auto-publish-OFF copy renamed to "Human approval required" (D-26); the ON case keeps its existing loud vermilion treatment unchanged
- Both test suites extended (not replaced) with new query-ref mocks (`issues:byIssueNumber`, `signOffs:activeByRunId`, `claimChecks:listByRunId`, `pitchLog:byRunId`) and new assertions covering the four-distinct-readout requirement, icon presence, `Loader2`-exclusivity, the D-26 rename, and the ISS-06 header case

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure lib/nav.ts + extend nav.test.ts (ISS-02 / D-31)** - `bb44830` (feat)
2. **Task 2: Rebuild Masthead.tsx into four separate readouts + extend Masthead.test.tsx (ISS-05)** - `eefc3b8` (feat)

_Plan metadata commit (this SUMMARY + STATE/ROADMAP updates) follows._

## Files Created/Modified
- `apps/dispatch-control/lib/nav.ts` — `NAV_GROUPS` restructured into Editorial / System Workbench / Operations; file header comment documents the D-31 rationale and the `/issues/[n]` vs pipeline `/issues/{run_id}` naming trap
- `apps/dispatch-control/__tests__/nav.test.ts` — updated group-label expectation, Issues-first-in-Editorial assertion, Run-Monitor-in-Workbench assertion, and a new guard that none of the three removed desk hrefs appear anywhere in `NAV_GROUPS`
- `apps/dispatch-control/components/Masthead.tsx` — rebuilt into four separate readouts (`IssueStatusReadout`, `SystemActivityReadout`, `MyTasksTrigger` + `AwaitingYouInbox`, cost-vs-cap span) plus the D-26 auto-publish copy rename
- `apps/dispatch-control/__tests__/Masthead.test.tsx` — extended with new query-ref mocks and assertions for the four-readout contract, icon presence, `Loader2` exclusivity, the D-26 rename, and the ISS-06 "State unknown — refresh" case

## Decisions Made
See `key-decisions` in frontmatter — the header's issue-status scope (latest-run-keyed, not the full issues-list scan), the `MyTasksTrigger` rename, dropping the old filled-button treatment for the label+icon convention, keeping the pre-existing "Issue {n}" identifier chip, and the reload-button pattern for the ISS-06 case.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<verify>` and `<acceptance_criteria>` commands pass verbatim; no Rule 1-4 fixes were required.

## Issues Encountered

None. One test-authoring adjustment (not a deviation from the plan's code requirements): the "My Tasks still opens the inbox" test initially used a raw `.click()` DOM call, which doesn't reliably flush a React state update outside `act()`; switched to Testing Library's `fireEvent.click`, which wraps the update correctly. No production code was affected.

## Known Stubs

None — all four readouts are wired to real derived data (either existing Convex query results or the `lib/derivedState.ts` pure selectors); no hardcoded empty values or placeholder copy.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `pnpm --filter dispatch-control test -- __tests__/nav.test.ts __tests__/Masthead.test.tsx` — both green (20/20 tests); full dispatch-control suite green (573/575, 2 pre-existing `.todo`).
- `pnpm --filter dispatch-control exec tsc --noEmit` — zero errors in this plan's files (`Masthead.tsx`, `Masthead.test.tsx`, `lib/nav.ts`, `nav.test.ts`); the broader pre-existing error surface (`spanResolver.test.ts`, `syntheticPortableText.test.ts`, `voicePassAxis.test.ts`, `WriterExpansion.test.tsx`) is unrelated to this plan and already logged in `.planning/phases/40-issue-entity-issues-home/deferred-items.md` by Plan 40-05.
- `AppSidebar.tsx` needed no changes — it already renders whatever `NAV_GROUPS` contains, confirmed by grep.
- The manual greyscale/color-removal check for the four header readouts (ISS-05) is explicitly deferred to Plan 40-09's integration/build gate, per this plan's own `<verification>` section.
- No blockers for Plan 40-09 (integration gate).

---
*Phase: 40-issue-entity-issues-home*
*Completed: 2026-07-15*

## Self-Check: PASSED

All modified files confirmed present on disk with the expected content (`apps/dispatch-control/lib/nav.ts`, `apps/dispatch-control/__tests__/nav.test.ts`, `apps/dispatch-control/components/Masthead.tsx`, `apps/dispatch-control/__tests__/Masthead.test.tsx`). Both task commits (`bb44830`, `eefc3b8`) confirmed present in git history via `git log`.
