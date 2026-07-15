---
phase: 40-issue-entity-issues-home
plan: 06
subsystem: ui
tags: [nextjs, app-router, routing, convex, server-components, redirect]

# Dependency graph
requires:
  - phase: 40-issue-entity-issues-home
    provides: "40-02 pipelineRuns.byIssueNumber/listByIssueNumber queries; 40-04 issueRouteResolver.ts (parseIssueNumber/issueHref/legacyRedirectTarget)"
provides:
  - "Issue-keyed console route tree: /issues/[issueNumber]/review, /voice, /runs/[runId] — thin Server Component wrappers mounting the already-shipped Review Desk galley and Voice Pass screen with zero internal rewrite"
  - "Dynamic (data-dependent) redirects from every old run-keyed console URL (/review-desk/[runId], /voice-pass/[runId], /review-desk, /voice-pass, /) to their issue-keyed equivalents, resolved server-side via a live Convex read — never a static next.config rewrite"
  - "ReviewDeskRunView.tsx and VoicePassRunView.tsx: the shipped galley/voice-pass Client Components, moved to co-located non-route files so their old page.tsx paths could become redirect-only"
affects: ["41-issue-workspace-stage-tabs"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-dependent redirect: async Server Component awaits a ConvexHttpClient query, then calls redirect() from next/navigation — never a static next.config rewrite, because the runId<->issueNumber mapping requires a live DB read"
    - "Co-located non-route Client Component: a page's internals moved out of page.tsx into a sibling .tsx file in the SAME directory so all relative imports stay valid, freeing page.tsx to become a thin route wrapper or redirect"

key-files:
  created:
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx"
    - "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx"
    - "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx"
    - "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx"
    - "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/runs/[runId]/page.tsx"
  modified:
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"
    - "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx"
    - "apps/dispatch-control/app/(dashboard)/review-desk/page.tsx"
    - "apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx"
    - "apps/dispatch-control/app/(dashboard)/page.tsx"
    - "apps/dispatch-control/__tests__/VoicePassScreen.test.tsx"

key-decisions:
  - "Split ReviewDeskRunPage's default export into a named + default export named ReviewDeskRunView (plan's discretion) so the new /issues/[n]/review wrapper can import it cleanly as a default import, matching the plan's example code exactly"
  - "The /issues/[n]/runs/[runId] wrapper redirects to /issues on an invalid issueNumber param (not just the review/voice wrappers) — consistent input validation across all three new route entry points, not explicitly mandated by the plan text but a natural Rule 2 extension"
  - "Fixed VoicePassScreen.test.tsx's import to point at the new co-located VoicePassRunView.tsx instead of the now-redirect-only page.tsx — a direct regression from Task 3's export change, fixed under Rule 1"

patterns-established:
  - "Server-side Convex read pattern for data-dependent redirects (ConvexHttpClient + await query + redirect()) — now used four times in this plan alone (review wrapper, voice wrapper, two legacy redirects), reusable for any future runId<->issueNumber translation"

requirements-completed: [ISS-02]

# Metrics
duration: ~11min
completed: 2026-07-15
---

# Phase 40 Plan 06: Routing Inversion Summary

**Re-keyed Review Desk and Voice Pass under `/issues/[issueNumber]/{review,voice}` as thin Server Component wrappers around the unmodified shipped screens, added `/issues/[n]/runs/[runId]` as a run's historical-record route, and converted every old run-keyed console URL (including the dashboard index) into a dynamic Convex-backed redirect.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-07-15T00:34:00Z
- **Completed:** 2026-07-15T00:44:16Z
- **Tasks:** 3
- **Files modified:** 11 (5 created, 6 modified)

## Accomplishments
- `/issues/[issueNumber]/review` and `/issues/[issueNumber]/voice` resolve `issueNumber -> runId` server-side via `api.pipelineRuns.byIssueNumber` and mount the already-shipped `ReviewDeskRunView`/`VoicePassScreen` Client Components with zero internal rewrite
- `/issues/[issueNumber]/runs/[runId]` mounts the existing `RunDetail` client component as a historical record under its issue, with a back link to the issue overview (D-08/D-09)
- Every old run-keyed console URL now 30x's dynamically: `/review-desk/[runId]` and `/voice-pass/[runId]` resolve `runId -> issueNumber` via `api.pipelineRuns.byRunId` and call `legacyRedirectTarget()`; the auto-focus shells (`/review-desk`, `/voice-pass`) and the dashboard index (`/`) all redirect to `/issues`
- A pipeline run is now reachable ONLY under its issue — no top-level run-keyed nav destination or route survives as a direct editorial entry point

## Task Commits

Each task was committed atomically:

1. **Task 1: Move the galley + voice Client Components to co-located non-route files** - `134aea9` (feat)
2. **Task 2: Create the three issue-keyed route wrappers** - `b82df9b` (feat)
3. **Task 3: Legacy redirects + dashboard index** - `3b7b01e` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx` - the galley editor Client Component, copied verbatim out of the old `page.tsx`, both named and default exported
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx` - the de-slop screen Client Component, copied verbatim, keeps the named `VoicePassScreen({ runId })` export
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx` - issue-keyed thin wrapper: resolves issueNumber->runId, mounts `ReviewDeskRunView`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx` - issue-keyed thin wrapper: resolves issueNumber->runId, mounts `VoicePassScreen`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/runs/[runId]/page.tsx` - historical run record: mounts the existing `RunDetail`, adds a back link to the issue
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` - now redirect-only: `runId -> issueNumber` (`pipelineRuns.byRunId`) then `legacyRedirectTarget('review', ...)`
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx` - same shape, `legacyRedirectTarget('voice', ...)`
- `apps/dispatch-control/app/(dashboard)/review-desk/page.tsx` - now `redirect('/issues')`
- `apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx` - now `redirect('/issues')`
- `apps/dispatch-control/app/(dashboard)/page.tsx` - dashboard index now `redirect('/issues')` (was `/review-desk`)
- `apps/dispatch-control/__tests__/VoicePassScreen.test.tsx` - import fix (see Deviations)

## Decisions Made
- `ReviewDeskRunView`/`VoicePassScreen` export shape: matched the plan's exact example code (default import for the review wrapper, named import for the voice wrapper) rather than picking a single uniform export style, since the plan explicitly specified both shapes and D-07 says not to touch internals beyond the export surface
- Extended input-param validation (`parseIssueNumber` -> `redirect('/issues')` on failure) to the `/issues/[n]/runs/[runId]` wrapper too, for consistency with the review/voice wrappers, even though the plan's acceptance criteria only explicitly required it for the review/voice pair

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `VoicePassScreen.test.tsx` regression from Task 3's page.tsx export change**
- **Found during:** Task 3 (Legacy redirects + dashboard index) — post-task `tsc --noEmit` diff (194 -> 195 errors)
- **Issue:** `__tests__/VoicePassScreen.test.tsx` imported the named `VoicePassScreen` export from `../app/(dashboard)/voice-pass/[runId]/page.tsx`. Task 3 replaced that file's contents with a redirect-only Server Component that no longer exports `VoicePassScreen`, breaking the test's import (`TS2614: has no exported member 'VoicePassScreen'`).
- **Fix:** Updated the import to `../app/(dashboard)/voice-pass/[runId]/VoicePassRunView` (the Task 1 co-located file that now owns that export). This also incidentally fixed a pre-existing `TS5097` (`.tsx` extension in import path) error on the same line, since the new import has no explicit extension.
- **Files modified:** `apps/dispatch-control/__tests__/VoicePassScreen.test.tsx`
- **Verification:** `pnpm exec tsc --noEmit -p tsconfig.json` error count dropped from 195 back to 193 (194 baseline minus 1 for the now-fixed line); `pnpm exec vitest run __tests__/VoicePassScreen.test.tsx` — 6/6 pass; full `vitest run` — 560 tests pass (1 pre-existing unrelated failure, see Issues Encountered)
- **Committed in:** `3b7b01e` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to avoid shipping a broken test file as a direct side effect of the routing inversion. No scope creep — the fix touches only the one import line this task's own change broke.

## Issues Encountered
- A full `pnpm --filter dispatch-control exec tsc --noEmit` run reports 193 pre-existing type errors, entirely in test files this plan did not touch (`spanResolver.test.ts`, `syntheticPortableText.test.ts`, `voicePassAxis.test.ts`, `review-desk-editors.test.tsx`, `WriterExpansion.test.tsx`, plus the widespread `import.meta.glob`/`ImportMeta` gap across `convex-test`-backed suites). Confirmed via an A/B `git stash` comparison that this count is unaffected by this plan's own files (194 baseline before this plan's Task 2 files existed, 193 after — the one-error *drop* is the VoicePassScreen.test.tsx fix above, not a new error). Documented in `.planning/phases/40-issue-entity-issues-home/deferred-items.md` under a new `## 40-06` heading, following the exact precedent set by 40-04/40-05. Not fixed here — out of scope per the executor's scope boundary (pre-existing, unrelated to this plan's changes).
- `pnpm exec vitest run` reports one failing suite: `__tests__/HoldDialog.test.tsx` (`Failed to resolve import ".../HoldDialog"`) — this is the pre-existing Plan 40-01 RED-scaffold test for Plan 40-07's not-yet-built `HoldDialog.tsx` component, already documented in 40-05's SUMMARY/deferred-items.md. All 560 other tests pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Success criterion 2 (a run is reachable only as a historical record under an issue, never a top-level nav destination) is now literally true at the route level: `/issues/[n]/review`, `/issues/[n]/voice`, and `/issues/[n]/runs/[runId]` are the only ways to reach the shipped editor/de-slop/run-detail screens from within the issue-keyed tree, and every old bookmark/link 30x's forward via a live Convex lookup.
- Plan 40-08 (masthead/nav chrome) can now safely remove `Review Desk`, `Signal Desk`, and `Voice Pass` from `lib/nav.ts` and move `Run Monitor` into System Workbench — this plan deliberately did NOT touch `nav.ts` (out of this plan's `files_modified` scope, reserved for 40-08 per the plan's own reminders).
- Plan 41 (Issue Workspace / stage tabs) can recompose `ReviewDeskRunView`/`VoicePassScreen` into stage tabs at the SAME `/issues/[n]/review` and `/issues/[n]/voice` URLs with no second URL migration, exactly as D-07 anticipated.
- No blockers.

---
*Phase: 40-issue-entity-issues-home*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 11 created/modified files confirmed present on disk; all 3 task commit
hashes (`134aea9`, `b82df9b`, `3b7b01e`) confirmed in `git log --all`.
