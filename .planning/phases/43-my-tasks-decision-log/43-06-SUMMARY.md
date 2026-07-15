---
phase: 43-my-tasks-decision-log
plan: 06
subsystem: ui
tags: [react, nextjs, convex, decision-log, audit-log, dispatch-control]

# Dependency graph
requires:
  - phase: 43-my-tasks-decision-log (Plan 43-02)
    provides: "auditLog.listDecisions (reason-bearing projection query) + users.byClerkUserId (actor-name resolution query)"
  - phase: 41-issue-workspace-frame
    provides: "the ContextPanel setPanelContent slot (ApprovalPanelContent) and the WorkspaceControls persistent-controls surface, with a reserved 'Decision log' control slot"
provides:
  - "components/decision-log/DecisionLog.tsx — the ONE shared, human-readable Decision Log component (reason-first, actor-as-name, legacy-tolerant)"
  - "DecisionLog mounted in the Approval context panel (below the readiness board)"
  - "DecisionLog mounted as a persistent, collapsed-by-default 'Decision log' disclosure control in the Issue Workspace frame"
affects: [43-07-retrofit-reason-actions-shared-helper, 43-08-do-not-use-reason-capture, 43-09-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure render + data-wrapper split for a Convex-backed component (DecisionLogRows vs default DecisionLog) so RED/GREEN TDD and future unit tests never need a live ConvexProvider"
    - "Per-distinct-id child resolver component (ActorNameResolver) to batch-resolve a variable-length set of Convex docs without violating Rules of Hooks (one useQuery per component instance, not a hook called in a loop)"
    - "Collapsed-by-default disclosure gating a Convex subscription — defers useQuery until the operator actually expands the control, keeping unrelated full-layout tests (whose mocked `api` object omits the new query refs) unaffected"

key-files:
  created:
    - apps/dispatch-control/components/decision-log/DecisionLog.tsx
    - apps/dispatch-control/__tests__/DecisionLog.test.tsx
  modified:
    - "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx"
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx

key-decisions:
  - "DecisionLog is a brand-new component, never imports or generalizes the raw Settings AuditLogViewer.tsx (verified: git diff --stat is empty for that file)"
  - "DecisionLog is appended in ApprovalPanelPublisher, NOT inside the pure buildApprovalPanelContent builder — keeps the builder Convex-free so its existing direct-call tests (StageContextPanels.test.tsx) never need a ConvexProvider mock"
  - "The Workspace 'Decision log' control is collapsed by default; DecisionLog (and its useQuery calls) only mounts once expanded, so WorkspaceLayout.test.tsx's full-layout render (whose mocked api object has no auditLog/users entries) is unaffected"
  - "Actor resolution: a small static SYSTEM_ACTOR_NAMES map (pipeline/cron/webhook/agent keys) resolves synchronously; human Clerk-sub actorIds resolve via one users.byClerkUserId lookup per distinct id present in the current row set, via a per-id ActorNameResolver child component (Rules-of-Hooks safe for a variable-length id set)"
  - "reasonOf() mirrors convex/auditLog.ts's isDecisionRow legacy-tolerance predicate client-side: structured reason first, else after-JSON reason/heldReason, else undefined -> renders '—'"

requirements-completed: [TSK-06]

# Metrics
duration: ~15min
completed: 2026-07-15
---

# Phase 43 Plan 06: Decision Log Component + Mounts Summary

**New `DecisionLog.tsx` component projecting `auditLog.listDecisions` reason-first with actor-as-name resolution (human via `users.byClerkUserId`, system/agent via a static map), mounted in both the Approval context panel and a collapsed-by-default Issue Workspace "Decision log" control — the raw Settings `AuditLogViewer.tsx` untouched.**

## Performance

- **Duration:** ~15 min (commit span e56b4e7→9706cb4: 6 min; plus context-loading/design time)
- **Started:** 2026-07-15T09:48:45-07:00 (first commit)
- **Completed:** 2026-07-15T09:54:39-07:00 (last commit)
- **Tasks:** 3/3 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Built the ONE shared, human-readable `DecisionLog` component (`DecisionLogRows` pure render + `DecisionLog` Convex data wrapper) — reason-first layout, actor rendered as a NAME never a bare Clerk sub, legacy after-JSON `heldReason` fallback, every field renders explicitly (never blank)
- Mounted `DecisionLog` in the Approval context panel below the existing readiness board, scoped to the current run/issue
- Added a persistent "Decision log" disclosure control to the Issue Workspace frame (`WorkspaceControls.tsx`), alongside Hold issue / Run history, that mounts `DecisionLog` on expand
- Zero regressions: full `dispatch-control` test suite (774 passed / 2 todo / 1 skipped / 0 failed) and a strict `next build` both green; `AuditLogViewer.tsx` is byte-for-byte unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: RED component test — reason-first, actor-as-name, legacy tolerance** - `e56b4e7` (test)
2. **Task 2: Build DecisionLog.tsx (projection + actor resolution + tolerant render)** - `d9d1b43` (feat)
3. **Task 3: Mount DecisionLog in the Approval context panel + the Workspace 'Decision log' control** - `9706cb4` (feat)

_TDD task 1: single RED commit (import-resolution failure — natural RED since the component didn't exist yet); Task 2 turned it GREEN in the same commit as the implementation (no separate REFACTOR commit needed)._

## Files Created/Modified

- `apps/dispatch-control/components/decision-log/DecisionLog.tsx` - `DecisionLogRows` (pure render) + `reasonOf`/`formatTimestamp`/`formatSnapshot` helpers + default `DecisionLog` (Convex wrapper: `listDecisions` subscription, `ActorNameResolver` per-distinct-human-actorId child, `SYSTEM_ACTOR_NAMES` static map)
- `apps/dispatch-control/__tests__/DecisionLog.test.tsx` - 7 tests pinning reason-first render, actor-as-name resolution (human + system), legacy `heldReason` fallback, explicit-placeholder honesty, and the empty state
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx` - `ApprovalPanelPublisher` now appends `<DecisionLog runId={ws.runId} issueNumber={ws.issueNumber} />` below the unchanged `buildApprovalPanelContent(...)` readiness board
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx` - new collapsed-by-default "Decision log" disclosure button + conditional `<DecisionLog runId={runId} issueNumber={n} />` mount

## Decisions Made

- Kept `buildApprovalPanelContent` a pure, Convex-free function and appended `DecisionLog` only inside `ApprovalPanelPublisher` — protects the existing `StageContextPanels.test.tsx` direct-call tests from needing a `ConvexProvider`/`convex/react` mock.
- Made the Workspace "Decision log" control collapsed by default rather than always-mounted — protects `WorkspaceLayout.test.tsx`'s full-layout render (its mocked `api` fixture has no `auditLog`/`users` entries) from crashing on an un-mocked `useQuery` call.
- Resolved the "variable number of actor ids -> variable number of Convex lookups" tension with a per-distinct-id child component (`ActorNameResolver`) rather than calling `useQuery` in a loop inside one component body — keeps `DecisionLog` Rules-of-Hooks safe for any row count.
- `reasonOf()` (client-side) deliberately mirrors `convex/auditLog.ts::isDecisionRow`'s legacy-tolerance predicate (`reason` then `after`-JSON `reason`/`heldReason`) so a row that qualifies as a "decision" server-side always has a non-empty reason to show client-side too.

## Deviations from Plan

None — plan executed exactly as written. `SYSTEM_ACTOR_NAMES` static map was populated locally in the component (per §43.4's explicit instruction: "a small static display-name map local to the component") rather than importing the richer `AGENT_DISPLAY_NAMES` map from `prompt-lab/_components/agentList.ts`, since the contract calls for a component-local map and the two maps serve different audiences (editor-facing prompt titles vs. compact decision-log actor names).

## Issues Encountered

None. Verified via `git stash` (temporarily removing the new `DecisionLog.tsx` + test) that `pnpm --filter dispatch-control typecheck` reports the identical pre-existing, repo-wide baseline (~28 unrelated files, 210 `error TS` lines — first documented in `deferred-items.md` under 43-03/43-04) with or without this plan's files present; zero occurrences of `DecisionLog` in the typecheck error output. Per the executor's scope-boundary rule, this pre-existing baseline was not touched. The plan's actual gating verification — `pnpm --filter dispatch-control test` (full suite) and `pnpm --filter dispatch-control build` (strict `next build`) — is green with zero new errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Decision Log substrate + component + both mounts are complete; 43-07 (retrofit shipped reason-requiring actions through the shared `writeDecision` helper) and 43-08 (Do-not-use reason capture) can now write decision rows that will render correctly through this component with zero further Decision Log changes.
- No blockers. `AuditLogViewer.tsx` remains the unmodified, separate Settings surface.

---
*Phase: 43-my-tasks-decision-log*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/components/decision-log/DecisionLog.tsx
- FOUND: apps/dispatch-control/__tests__/DecisionLog.test.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx
- FOUND commit: e56b4e7 (test)
- FOUND commit: d9d1b43 (feat)
- FOUND commit: 9706cb4 (feat)
