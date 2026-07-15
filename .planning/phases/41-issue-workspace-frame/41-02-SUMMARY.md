---
phase: 41-issue-workspace-frame
plan: 02
subsystem: database
tags: [convex, mutation, convex-test, issues, workspace-frame]

# Dependency graph
requires:
  - phase: 40-issue-first-console-foundation
    provides: "issues Convex table (workspace_id/issueNumber/held/published/lastVisitedStage schema field, ensureByNumber/hold/reopen/markPublished mutations, requireOperator/requireOperatorOrPipeline auth guards)"
provides:
  - "issues.setLastVisitedStage — the sole, operator-guarded, patch-only writer of issues.lastVisitedStage"
  - "convex-test coverage proving patch / overwrite / no-op-on-absent-row / auth-rejection behavior"
  - "Live deployment of the mutation to dev:modest-magpie-797 (callable via api.issues.setLastVisitedStage)"
affects: [41-06-workspace-frame-layout-nav, issue-workspace-frame]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Operator-only mutation lane (mirrors hold/reopen) for human-triggered stage-visit writes, distinct from the dual-lane ensureByNumber/markPublished pattern"
    - "Strict patch-only NO-OP on absent row — never resurrects/creates an issue row from a passive read-side effect"

key-files:
  created:
    - apps/dispatch-control/__tests__/setLastVisitedStage.test.ts
  modified:
    - convex/issues.ts

key-decisions:
  - "setLastVisitedStage placed on the requireOperator (operator-only) lane, not requireOperatorOrPipeline — a stage visit is a human editorial action, per the plan's interface note that a stage-visit write should mirror hold/reopen, not ensureByNumber/markPublished."
  - "Ran the live Convex sync (pnpm --filter @eisenbalm/convex dev:once) as a mandatory step, not optional — committing convex/*.ts alone does not deploy it (project memory: convex-functions-need-live-sync)."

patterns-established:
  - "Stage-visit writers (any future 'remember where I was' Convex mutation) should use the operator-only lane and patch-only-on-existing-row shape established here."

requirements-completed: [WSP-01]

# Metrics
duration: ~8min
completed: 2026-07-15
---

# Phase 41 Plan 02: setLastVisitedStage Convex Mutation Summary

**Added `issues.setLastVisitedStage`, the sole operator-guarded patch-only writer of `issues.lastVisitedStage`, covered by 4 convex-test assertions and deployed live to dev:modest-magpie-797.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-15T05:41:23Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `convex/issues.ts` gained `setLastVisitedStage` — an operator-only mutation (mirrors `hold`/`reopen`, not the dual-lane `ensureByNumber`/`markPublished`) that patches `lastVisitedStage` on an existing `issues` row and is a strict no-op (no throw, no row creation) when the row is absent.
- `stage` argument is a closed `v.union` of the five D-05 route segments: `story` / `draft` / `fact-check` / `voice` / `approval`.
- Added `apps/dispatch-control/__tests__/setLastVisitedStage.test.ts` — 4 convex-test assertions: patch on existing row, overwrite (last-write-wins), no-op on an issueNumber with no row, and rejection with no Clerk identity.
- Ran the mandatory live Convex sync (`pnpm --filter @eisenbalm/convex dev:once`) — completed with "Convex functions ready!" against `dev:modest-magpie-797` (confirmed via `convex/.env.local`'s `CONVEX_DEPLOYMENT=dev:modest-magpie-797`). The mutation is now actually callable, not merely committed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add setLastVisitedStage operator mutation (D-03/D-04)** - `3af86fa` (feat)
2. **Task 2: convex-test coverage + live deploy sync** - `6310b13` (test)

**Live Convex sync:** ran `pnpm --filter @eisenbalm/convex dev:once` after Task 2's commit — no code change resulted (deploy-only step), so it has no separate commit; see "Live Convex Sync Result" below for the captured output.

**Plan metadata:** (pending — this commit, made after this SUMMARY is written)

## Files Created/Modified
- `convex/issues.ts` - Added `setLastVisitedStage` mutation (operator-only lane, patch-only, `stage` closed union of 5 literals)
- `apps/dispatch-control/__tests__/setLastVisitedStage.test.ts` - convex-test coverage (4 assertions)

## Live Convex Sync Result

Command run: `pnpm --filter @eisenbalm/convex dev:once` (= `convex dev --once`)

```
> @eisenbalm/convex@0.0.0 dev:once /Users/user/Desktop/Eisenbalm/convex
> convex dev --once

- Preparing Convex functions...
✔ 22:41:00 Convex functions ready! (6.64s)
```

Result: **SUCCESS.** Deployment target confirmed as `dev:modest-magpie-797` via `convex/.env.local`
(`CONVEX_DEPLOYMENT=dev:modest-magpie-797 # team: camille-yeyou, project: eisenbalm-dispatch`).
`setLastVisitedStage` is live and callable as `api.issues.setLastVisitedStage` on the dev deployment —
not merely committed to `convex/issues.ts`. No new untracked files were produced by the sync
(`_generated/` output was already up to date / unchanged).

## Decisions Made
- Followed the plan's interface note exactly: this is a human stage-visit action, so it uses the `requireOperator` (operator-only) lane, matching `hold`/`reopen` rather than the pipeline-callable dual lane.
- No architectural deviation from the plan's exact mutation shape (args, handler body, and test assertions match the plan's `<action>` blocks).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`pnpm --filter dispatch-control typecheck` (run as a courtesy check, not part of this plan's verification command) surfaces ~20 pre-existing TypeScript errors in unrelated files (`syntheticPortableText.test.ts`, `voicePassAxis.test.ts`, `WriterExpansion.test.tsx`). Confirmed neither `convex/issues.ts` nor `setLastVisitedStage.test.ts` appear in that error set — these predate this plan and are out of scope per CLAUDE.md SCOPE BOUNDARY (same conclusion independently reached in `41-01-SUMMARY.md`). Not fixed; not re-logged to a separate deferred-items file since 41-01 already recorded this exact debt.

## User Setup Required

None - no external service configuration required (the live Convex sync is a build/deploy step performed as part of this plan's execution, not a manual user action).

## Next Phase Readiness
- `api.issues.setLastVisitedStage` is live and ready for Plan 41-06 to wire into the workspace frame's redirect (D-03) and per-stage "remember where I was" `useEffect` writer (D-04).
- No blockers identified for downstream plans in this phase.

---
*Phase: 41-issue-workspace-frame*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: convex/issues.ts
- FOUND: apps/dispatch-control/__tests__/setLastVisitedStage.test.ts
- FOUND: commit 3af86fa (Task 1)
- FOUND: commit 6310b13 (Task 2)
