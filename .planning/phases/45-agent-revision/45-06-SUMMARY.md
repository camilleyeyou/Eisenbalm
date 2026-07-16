---
phase: 45-agent-revision
plan: 06
subsystem: ui
tags: [convex, react, next.js, cost-guard, workspace-header]

# Dependency graph
requires:
  - phase: 45-agent-revision (45-01)
    provides: "Wave-0 test scaffolds, incl. the FrameChromeCostReadout.test.tsx it.todo stub this plan fills"
  - phase: 41 (Issue Workspace frame)
    provides: "WorkspaceStateProvider + FrameChrome, the header this plan extends"
provides:
  - "deriveRunCostUsd/deriveRunCapUsd pure helpers in lib/derivedState.ts"
  - "WorkspaceStateProvider subscriptions to agentRuns.byRunId + pipelineConfig.getAll, exposed as runCostUsd/capUsd"
  - "FrameChrome header cost-vs-budget readout (data-testid=\"cost-vs-budget\"), never-blank (loading -> refresh affordance)"
affects: [45-02, 45-03, revision-cost-guard, workspace-header]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Never-blank readout: a derived value stays `undefined` while its source query is loading; consumers render an explicit refresh affordance, never a stale/fabricated default"
    - "Durable-source cost summation: per-issue spend is summed from the durable Convex agentRuns rows (never a pipeline-local in-memory cost store)"

key-files:
  created:
    - apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx (converted from Wave-0 it.todo stub to real assertions)
  modified:
    - apps/dispatch-control/lib/derivedState.ts
    - apps/dispatch-control/__tests__/derivedState.test.ts
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx
    - apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx
    - apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx

key-decisions:
  - "runCostUsd stays undefined (never coerced to 0) while agentRuns:byRunId is loading — the header renders a refresh affordance in that state, matching the existing StatusReadout 'unknown' pattern"
  - "capUsd defaults to 10.0 (DEFAULT_RUN_CAP_USD) until pipelineConfig:getAll resolves or when the per_run_cap_usd key is absent — same default BudgetCapsPanel.tsx already uses server-side"
  - "pipelineConfig.getAll is subscribed unconditionally (not skip-guarded on runId) since the cap is workspace-scoped, not run-scoped — mirrors every other pipelineConfig.getAll consumer in the app"

patterns-established:
  - "Cost-vs-budget readout pattern: pure derive fn (never-blank contract) + provider subscription + presentational component with a stable data-testid, directly parallel to the existing StatusReadout/IssueStatus pattern"

requirements-completed: [REV-05]

# Metrics
duration: 8min
completed: 2026-07-15
---

# Phase 45 Plan 06: Frontend Cost-vs-Budget Readout Summary

**Workspace header now shows a never-blank `$spent / $cap` readout summed from durable Convex `agentRuns` rows against `pipelineConfig`'s `per_run_cap_usd`, next to the existing tasks/minutes line.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-15T18:44:22-07:00 (prior plan's completion commit)
- **Completed:** 2026-07-15T18:51:47-07:00
- **Tasks:** 2
- **Files modified:** 6 (2 created/converted, plus 2 pre-existing test files fixed as a blocking-issue deviation)

## Accomplishments
- `deriveRunCostUsd`/`deriveRunCapUsd` pure helpers added to `lib/derivedState.ts`, fully unit-tested (never-blank `undefined`-while-loading contract, cap default/parse behavior)
- `WorkspaceStateProvider` now subscribes to `api.agentRuns.byRunId` (skip-guarded on `runId`) and `api.pipelineConfig.getAll`, exposing `runCostUsd`/`capUsd` on the workspace context
- `FrameChrome` renders a `data-testid="cost-vs-budget"` readout beside `{tasks.length} open · ~{workMinutes} min`: a refresh affordance while `runCostUsd` is `undefined`, `"$x.xx / $y.yy"` once both values resolve
- Converted the Wave-0 `FrameChromeCostReadout.test.tsx` `it.todo` stubs into real end-to-end assertions rendering the actual `IssueWorkspaceLayout` (mirroring `WorkspaceLayout.test.tsx`'s established full-render mocking pattern)

## Task Commits

Each task was committed atomically:

1. **Task 1: deriveRunCostUsd + deriveRunCapUsd pure helpers** - `4efb269` (feat)
2. **Task 2: Provider subscription + never-blank FrameChrome readout** - `2925c89` (feat)

**Plan metadata:** (this commit) - `docs: complete 45-06 plan`

## Files Created/Modified
- `apps/dispatch-control/lib/derivedState.ts` - Added `deriveRunCostUsd`, `deriveRunCapUsd`, `DEFAULT_RUN_CAP_USD` (pure, no Convex import)
- `apps/dispatch-control/__tests__/derivedState.test.ts` - Extended with a `describe` block covering every `<behavior>` case from the plan
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` - Two new skip-guarded/unconditional `useQuery` subscriptions; `runCostUsd`/`capUsd` added to `WorkspaceStateValue` and the returned context value
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx` - New `CostBudgetReadout` component mounted in `FrameChrome`'s header row
- `apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx` - Converted from Wave-0 `it.todo` scaffold to 3 real tests against the rendered layout
- `apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx`, `apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx` - Added `agentRuns`/`pipelineConfig` entries to the local mocked Convex `api` object (blocking-issue fix, see Deviations)

## Decisions Made
- Followed the plan's exact helper signatures and default (10.0) verbatim.
- `pipelineConfig.getAll` subscribed unconditionally (not `runId`-gated) since the cap is workspace-level config, consistent with every other consumer of that query in the codebase (`BudgetCapsPanel.tsx`, `AutomationPanel.tsx`, etc.).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated two pre-existing tests' mocked Convex `api` object**
- **Found during:** Task 2 verification (`npx vitest run` full suite)
- **Issue:** `WorkspaceLayout.test.tsx` and `WorkspaceContextPanelSlot.test.tsx` each mock `@convex/_generated/api` with a local object that renders the REAL `WorkspaceStateProvider`. Once the provider began referencing `api.agentRuns.byRunId`/`api.pipelineConfig.getAll`, both mocked `api` objects (which omitted those keys) threw `TypeError: Cannot read properties of undefined (reading 'byRunId')` at render time — a direct, in-scope consequence of this plan's provider change.
- **Fix:** Added `agentRuns: { byRunId: 'agentRuns:byRunId' }` and `pipelineConfig: { getAll: 'pipelineConfig:getAll' }` entries to both files' mocked `api` object, matching the exact style already used for every other query reference in those mocks.
- **Files modified:** `apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx`, `apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx`
- **Verification:** Full `npx vitest run` suite green (101 files passed, 866 tests passed, 8 todo — the 8 pre-existing todos are unrelated to this plan).
- **Committed in:** `2925c89` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary consequence of extending the shared provider; no scope creep — both fixes are one-line additions matching the existing mock convention.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required. No new Convex schema or function; `agentRuns.byRunId` and `pipelineConfig.getAll` are already-deployed public queries.

## Next Phase Readiness
- The visible half of REV-05 is complete: the header always shows either a refresh affordance or a concrete `$spent / $cap` figure, sourced from the durable `agentRuns` table.
- 45-02 (guard predicate) and 45-03 (revision cost recording endpoint) can now record cost under the real `run_id` and this readout will reflect it automatically — zero additional frontend wiring needed, since the readout already sums ALL `agentRuns:byRunId` rows for the issue's run, not just the original pipeline agents.
- No blockers for remaining Phase 45 plans.

---
*Phase: 45-agent-revision*
*Completed: 2026-07-15*

## Self-Check: PASSED

All created/modified files confirmed present on disk; both task commits (`4efb269`, `2925c89`) confirmed in git history.
