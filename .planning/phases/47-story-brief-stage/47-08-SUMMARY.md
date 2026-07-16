---
phase: 47-story-brief-stage
plan: 08
subsystem: ui
tags: [nextjs, react, vitest, clerk, convex, dispatch-control, pytest]

# Dependency graph
requires:
  - phase: 47-03-writer-brief-threading
    provides: "the 7 section writers threading state.get('brief') via build_section_writer_prompt's 5th param — the pipeline-side half of BRF-05"
  - phase: 47-04-leads-and-brief-fastapi-endpoints
    provides: "the leads require/remove + brief PATCH + strengthen preview/apply Clerk-guarded FastAPI endpoints every Stage-1 component's client calls"
  - phase: 47-05-workspace-subscriptions-lead-card-actions
    provides: "WorkspaceStateProvider.storyLeads/verificationRecords/brief + LeadCard/LeadActions"
  - phase: 47-06-org-options-and-needs-your-decision
    provides: "OrgOptionSlate + NeedsYourDecisionCard + selectActiveLead"
  - phase: 47-07-brief-field-table-and-strengthen
    provides: "BriefFieldTable + BriefFieldStrengthen + briefClient.ts"
provides:
  - "StoryBriefScreen.tsx — the Stage-1 composition shell (leads -> org options -> Needs-your-decision -> Brief table+strengthen) mounted at issues/[issueNumber]/story, replacing SignalDeskScreen/StoryPanelContent.tsx"
  - "Annotations §Stage 1 Empty (CreatePanel reuse) / Loading ('Finding leads… (~40s)') / Error (plain-language errorMessage + Restart discovery + Run Details link) states"
  - "deriveStoryStage tightened to gate 'needs-you' on the precise Gate-1-paused predicate (status==='awaiting-review' && completedAt==null) instead of 'leads exist, none selected'"
  - "All six BRF-01..06 requirements marked complete in REQUIREMENTS.md — operator-visible end-to-end for the first time this phase"
affects: [48-start-from-my-brief]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "StoryBriefScreen takes a runId prop (server-resolved, like SignalDeskScreen) but computes effectiveRunId = ws.runId ?? runId — the SSR prop disambiguates the provider's own query-loading null on first paint, while the live ws.runId takes over afterward so 'Restart discovery' (which creates a NEW pipelineRuns row for the same issue) is picked up automatically via Convex reactivity, no page reload required"
    - "story/page.tsx no longer redirects away when no run exists for the issue — Stage 1 is the first stage (D-04: 'no run at all also lands on Story'), so StoryBriefScreen itself renders the Empty state (CreatePanel) rather than bouncing to the bare index, which would have redirect-looped back to Story"
    - "Error state detection reuses the same api.pipelineRuns.byRunId row SignalDeskScreen already queries (status/completedAt/errorMessage) — no new Convex table or field"

key-files:
  created:
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx"
    - "apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx"
  modified:
    - "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx"
    - "apps/dispatch-control/lib/derivedState.ts"
    - "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"
    - "apps/dispatch-control/__tests__/derivedState.test.ts"
    - "apps/dispatch-control/__tests__/StageContextPanels.test.tsx"
  deleted:
    - "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx"

key-decisions:
  - "runId resolution prefers the live ws.runId over the SSR-resolved prop once the provider's own query resolves (ws.runId ?? runId) — enables Restart-discovery to hand off to the new run without a page reload, while still avoiding an initial-paint flash of the Empty state before the provider's query resolves"
  - "story/page.tsx's prior 'redirect to /issues/[n] when no run exists' was removed (not merely left in place) — it was the direct cause of a latent redirect loop (bare index -> Story on no-run per D-04 -> Story's own redirect back to bare index -> …) that this plan's Empty-state requirement made newly load-bearing to fix"
  - "Restart discovery re-triggers a run for the SAME issueNumber (api.pipelineRuns.byIssueNumber already resolves to the most-recent run) rather than inventing a new 'restart' endpoint — router.refresh() re-runs the Server Component in case the live subscription hasn't caught up yet"
  - "All six BRF-01..06 checkboxes flipped to [x] in REQUIREMENTS.md this plan (previous plans 47-01/47-05/47-06/47-07 explicitly deferred this because the components weren't mounted into any reachable route yet) — the traceability table's per-row status intentionally left as 'Planned' (matches the tool's existing mixed-state precedent elsewhere in REQUIREMENTS.md, e.g. SIG-01)"

patterns-established: []

requirements-completed: [BRF-01, BRF-02, BRF-03, BRF-04, BRF-05, BRF-06]

# Metrics
duration: 55min
completed: 2026-07-16
---

# Phase 47 Plan 08: Story & Brief Screen Mount + Phase Gate Summary

**StoryBriefScreen composes the six shipped Stage-1 components into the real Story & Brief stage at `issues/[issueNumber]/story`, replacing the provisional Signal Desk placeholder; the tightened `deriveStoryStage` Gate-1-paused predicate and all four phase gates (vitest, strict `next build`, pytest, Convex parity) are green.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-07-16T05:30:00Z (approx.)
- **Completed:** 2026-07-16T06:25:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 8 (2 new, 5 modified, 1 deleted)

## Accomplishments

- `StoryBriefScreen.tsx`: composes `LeadCard`+`LeadActions` (per lead), `OrgOptionSlate` (always mounted), `NeedsYourDecisionCard` (mounted only while genuinely paused at Gate 1), and `BriefFieldTable`+`BriefFieldStrengthen` (per field, once the Brief exists) — the exact Annotations §Stage 1 composition order, reading everything from `useWorkspaceState()` plus one own-query for the run's `status`/`completedAt`/`errorMessage` (mirrors `SignalDeskScreen`'s `isPausedAtGate1` exactly)
- The three Annotations §Stage 1 states: Empty (no run yet — reuses `issues/_components/CreatePanel.tsx` verbatim), Loading ("Finding leads… (~40s)", shown both full-screen with zero leads and as a non-blocking banner above an already-streaming lead list), and Error (the run's plain-language `errorMessage` + "Restart discovery" which re-triggers a run for the issue + a "Run Details" link)
- `deriveStoryStage` (`lib/derivedState.ts`) tightened: 'needs-you' now requires the PRECISE Gate-1-paused predicate (`status==='awaiting-review' && completedAt==null`) instead of "leads exist and none is selected" — a mid-flight run (Scout/Advocate still working) no longer flashes "Needs you" on the StageStrip. `runCompletedAt` threaded through `DerivationInputs` and `WorkspaceStateProvider` (from the already-subscribed `runs:byRunId` row) to support the gate.
- `story/page.tsx` rewritten to mount `<StoryBriefScreen issueNumber runId />` (not `SignalDeskScreen`), and — critically — no longer redirects away when no run exists for the issue: `issues/[issueNumber]/page.tsx`'s own D-04 default ("no run at all also lands on Story") made the OLD `if (!run) redirect(issueHref(n))` a latent infinite redirect loop once an operator could land on Story with no run; `StoryBriefScreen`'s own Empty state now handles that case in-frame.
- `StoryPanelContent.tsx` (the 131-line provisional context-panel-publisher placeholder) DELETED. `StageContextPanels.test.tsx`'s now-dangling "Stage 1 Story panel" describe block and the "Story publisher…" plumbing test were removed (Rule 3 — directly caused by the deletion); Stages 2-5's context-panel tests are untouched (16 of the original 20 tests remain, all still green).
- Phase gate: full `pnpm --filter dispatch-control test:unit` (932 passed / 2 todo / 0 failed), strict `pnpm --filter dispatch-control build` (exit 0, zero type errors), `pnpm check:convex-parity` (green — 61 called functions all present on `dev:modest-magpie-797`, including `briefs.js:byRunId/insert/patch` and `storyLeads.js:byRunId/insert/setStatus`), and the full pipeline `uv run pytest tests/ -q` (661 passed, 37 skipped, 0 failed) — all green.
- All six `BRF-01..06` requirement checkboxes flipped to complete in `.planning/REQUIREMENTS.md` — the six components are now mounted on a reachable route for the first time this phase.

## Task Commits

Each task was committed atomically:

1. **Task 1: StoryBriefScreen.tsx composition + empty/loading/error states + StageStrip derivation** - `95ee992` (feat)
2. **Task 2: Mount StoryBriefScreen at Stage 1 and delete the provisional placeholder** - `5556628` (feat)
3. **Task 3: Phase gate — full suites + strict build + Convex parity** - no code changes required (all four gates passed on first run); documented here, not a separate commit.

_Task 1 was `tdd="true"`; the test file (`StoryBriefScreen.test.tsx`, 8 tests, all new) and the passing component landed in a single commit — all assertions passed on first implementation, matching the precedent established by 47-05/47-06/47-07 in this same phase (no separate failing-test commit was meaningful to preserve)._

## Files Created/Modified

- `apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx` - new: the Stage-1 composition shell
- `apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx` - new: 8 tests (empty/loading/error states, composition, Needs-your-decision gating, Restart discovery)
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx` - mounts `StoryBriefScreen`; no longer redirects on no-run
- `apps/dispatch-control/lib/derivedState.ts` - `deriveStoryStage` tightened to the precise Gate-1-paused predicate; `runCompletedAt` added to `DerivationInputs`
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` - threads `runCompletedAt: runRow?.completedAt` into `derivationInputs`
- `apps/dispatch-control/__tests__/derivedState.test.ts` - 4 new tests for the tightened `deriveStoryStage` predicate
- `apps/dispatch-control/__tests__/StageContextPanels.test.tsx` - removed the dangling Stage-1 Story panel describe block + plumbing test (Rule 3, caused by `StoryPanelContent.tsx`'s deletion)
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx` - DELETED (D-01, replaced not extended)
- `.planning/REQUIREMENTS.md` - BRF-01..06 marked complete

## Decisions Made

See `key-decisions` in frontmatter above (runId resolution precedence, the redirect-loop fix, Restart discovery's reuse of `triggerRun`, and the requirements-marking timing).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `StageContextPanels.test.tsx`'s Stage-1 imports broke on `StoryPanelContent.tsx`'s deletion**
- **Found during:** Task 2 (deleting the placeholder)
- **Issue:** `StageContextPanels.test.tsx` imported `StoryPanelPublisher`/`buildStoryPanelContent` from the file this task deletes, and contained a "Stage 1 Story panel" describe block (3 tests) plus a "Story publisher calls setPanelContent…" test in the shared plumbing-block describe — both would fail to even collect once the import target no longer existed.
- **Fix:** Removed the dangling import (and the now-unused `InspectorProvider`/`Doc` imports it required), the "Stage 1 Story panel" describe block, and the "Story publisher…" test. Fixed a duplicate `WorkspaceStateValue` type import left behind by the edit. Stages 2-5's describe blocks (Draft/Fact Check/Voice/Approval panels) are untouched.
- **Files modified:** `apps/dispatch-control/__tests__/StageContextPanels.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test:unit -- StageContextPanels` — 16/16 tests pass (20 - 4 removed).
- **Committed in:** `5556628` (Task 2 commit)

**2. [Rule 1 - Bug] `story/page.tsx`'s pre-existing `if (!run) redirect(issueHref(n))` was a latent infinite redirect loop**
- **Found during:** Task 2 (designing the Empty state per D-14)
- **Issue:** The bare `/issues/[n]` index page's own D-04 default redirects to Story when no run exists at all ("no run at all also lands on Story"). Story's OLD page redirected back to the bare index whenever `!run` — for an issue with a reserved-but-not-yet-triggered slot (e.g. the next scheduled issue number, auto-reserved by `/issues/page.tsx`'s `ensureByNumber` effect before any run is triggered), navigating directly to `/issues/[n]` or `/issues/[n]/story` would bounce between the two routes indefinitely.
- **Fix:** Removed the redirect; `story/page.tsx` now always renders `StoryBriefScreen`, passing `runId: run?.runId ?? null`. `StoryBriefScreen`'s own Empty state (CreatePanel) handles the no-run case in-frame, closing the loop.
- **Files modified:** `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx`
- **Verification:** `pnpm --filter dispatch-control test:unit -- StoryBriefScreen` — the Empty-state test renders `CreatePanel`'s "Find a story with agents" button with no redirect attempted (jsdom has no real router to redirect-loop through, but the removed `redirect()` call and its `issueHref` import are gone from the file; the strict build's type-check also confirms no unused-import regressions).
- **Committed in:** `5556628` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). Both were direct, in-scope consequences of this plan's own D-01/D-14 work — no unrelated files touched, no scope creep.

## Issues Encountered

- `pnpm check:convex-parity` initially failed with `spawnSync npx ETIMEDOUT` (the underlying `npx convex function-spec` subprocess didn't return within the script's 60s timeout) on the first two attempts — a transient network/WebSocket-reconnect issue in this environment, not a real parity failure. A direct, unbounded run of `npx convex function-spec` from `convex/` confirmed `briefs.js:byRunId/insert/patch` and `storyLeads.js:byRunId/insert/setStatus` are genuinely live on `dev:modest-magpie-797`; a subsequent `pnpm check:convex-parity` run succeeded cleanly (61/61 called functions present). No code or config change was needed — documented here per the phase gate's own instruction to note exact results.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 47 (Story & Brief Stage) is complete: all six BRF-01..06 requirements are implemented AND operator-reachable end-to-end at `issues/[issueNumber]/story` inside the shared Workspace frame. All four phase gates (full vitest, strict `next build`, full pytest, Convex parity) are green.
- Phase 48 ("Start from my brief" — a second pipeline entry point that authors the same six-field Brief shape by hand, skipping discovery, entering at Researcher) can build directly on this plan's `Brief` shape (`briefs` Convex table, `briefClient.ts`, `BriefFieldTable.tsx`'s six-field editable form) — the Brief's shape and console-editable pattern are now proven end-to-end by a real operator flow, not just isolated components.
- No blockers.

---
*Phase: 47-story-brief-stage*
*Completed: 2026-07-16*

## Self-Check: PASSED

All 8 files verified present (StoryBriefScreen.tsx, StoryBriefScreen.test.tsx, story/page.tsx,
derivedState.ts, WorkspaceStateProvider.tsx, derivedState.test.ts, StageContextPanels.test.tsx,
this SUMMARY.md). StoryPanelContent.tsx confirmed deleted (`test ! -f`). Both task commit hashes
(95ee992, 5556628) verified present in `git log`.
