---
phase: 23-node-wrappers-read-only-dashboard
plan: "01"
subsystem: convex-schema, convex-mutations, test-harness
tags: [convex, schema, agent-runs, audit-log, convex-test, cost-rollup, pytest]
dependency_graph:
  requires: []
  provides:
    - agent_runs schema extension (tokensIn/tokensOut/error)
    - agent_run_payloads table (OBS-05 I/O snapshots)
    - agentRuns Convex mutations (queueForRun/started/completed/failed/savePayload)
    - agentRuns Convex queries (byRunId/payloadByRunIdAgentKey)
    - auditLog Convex internal mutation (write) + query (listForWorkspace)
    - costRollup TS util (parseCostJson/sumRunsCost)
    - convex-test harness with edge-runtime env
    - Python no-double-count guard test
  affects:
    - convex/_generated (regeneration required on next convex dev)
    - Wave 1 plans (02 wrap_agent_node, 03/04 dashboard views)
tech_stack:
  added:
    - convex-test@0.0.53 (devDep in dispatch-control)
    - "@edge-runtime/vm@5.0.0 (devDep, required by convex-test)"
  patterns:
    - Convex internalMutation for pipeline-called writes
    - convex-test with import.meta.glob modules parameter for Vite-aware module resolution
    - TDD: schema + mutations created before tests; tests confirmed passing (GREEN)
    - upsert pattern: withIndex('by_runId').filter(agentKey).first() → patch else insert
key_files:
  created:
    - convex/agentRuns.ts
    - convex/auditLog.ts
    - apps/dispatch-control/lib/costRollup.ts
    - apps/dispatch-control/__tests__/setup.ts
    - apps/dispatch-control/__tests__/costRollup.test.ts
    - apps/dispatch-control/__tests__/agentRuns.test.ts
    - apps/dispatch-control/__tests__/auditLog.test.ts
    - packages/pipeline/tests/test_cost_double_count.py
  modified:
    - convex/schema.ts (agent_runs extended + agent_run_payloads added)
    - apps/dispatch-control/vitest.config.ts (environmentMatchGlobs for edge-runtime)
    - apps/dispatch-control/package.json (convex-test + @edge-runtime/vm devDeps)
decisions:
  - "convex-test requires import.meta.glob passed explicitly as `modules` arg — not the schema-only overload — for Vite's static analysis to resolve Convex module files at test time"
  - "agentRuns upsert uses by_runId index + .filter(agentKey) (no compound index on agent_runs) — matches RESEARCH Pattern 2 exactly"
  - "agent_run_payloads uses by_runId_agentKey compound index for O(1) node-click lookups"
  - "environmentMatchGlobs deprecated in vitest v3.2 but still functional; shows deprecation warning only"
metrics:
  duration: "9 min"
  completed_date: "2026-06-22"
  tasks: 3
  files: 10
---

# Phase 23 Plan 01: Convex + Test Foundation Summary

Convex schema extension, per-table mutation/query files, cost-rollup util, and full test harness (convex-test + pytest) for Phase 23's node-wrapper and read-only dashboard deliverables.

## What Was Built

**Task 1 — Schema extension:**
- Added `tokensIn`, `tokensOut`, `error` optional fields to `agent_runs` (OBS-03 — wrapper can emit them)
- Added new `agent_run_payloads` table with `by_runId_agentKey` compound index (OBS-05 — separate from live subscription to keep `agent_runs` lightweight)
- Frozen tables (`pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`, `audit_log`) untouched

**Task 2 — Convex per-table files:**
- `convex/agentRuns.ts`: 5 `internalMutation` exports (`queueForRun`, `started`, `completed`, `failed`, `savePayload`) + 2 public `query` exports (`byRunId`, `payloadByRunIdAgentKey`)
- `convex/auditLog.ts`: 1 `internalMutation` (`write`) + 1 public `query` (`listForWorkspace`)
- All pipeline-called writes use `internalMutation` (correct Convex pattern — only dashboard queries are public)
- Upsert pattern: guard via `by_runId` index filtered on `agentKey`, patch existing else insert

**Task 3 — Test harness + cost util:**
- `convex-test@0.0.53` + `@edge-runtime/vm` installed; `vitest.config.ts` updated with `environmentMatchGlobs` for agentRuns/auditLog tests
- `lib/costRollup.ts`: `parseCostJson` (parse `runs.cost` JSON with fallback) + `sumRunsCost` (aggregate across run array)
- 13 costRollup unit tests, 6 agentRuns convex-test integration tests, 5 auditLog convex-test integration tests — all 40 TS tests pass
- 3 Python tests asserting `get_cost_payload` is a pure read (no-double-count guard) — all pass

## Deviations from Plan

**1. [Rule 1 - Fix] convex-test modules parameter required**
- **Found during:** Task 3 test execution
- **Issue:** `convexTest(schema)` fails with `(intermediate value).glob is not a function` — convex-test's default `import.meta.glob` (Vite API) doesn't resolve in test context without being explicitly passed
- **Fix:** Used `convexTest({ schema, modules })` where `modules = import.meta.glob('../../../convex/**/*.*s')` is defined as a literal in each test file (Vite requires static glob literals for static analysis)
- **Files modified:** `__tests__/agentRuns.test.ts`, `__tests__/auditLog.test.ts`, `__tests__/setup.ts` (updated comment)
- **Commit:** fe30572

**2. [Note] environmentMatchGlobs deprecated in vitest v3.2**
- The `environmentMatchGlobs` option shows a deprecation warning in vitest 3.2 (recommends `test.projects`). The tests pass correctly; the acceptance criteria grep check still matches (`edge-runtime` string present). Not upgraded as the deprecation is benign and the acceptance criteria is satisfied.

## Test Results

```
pnpm --filter dispatch-control test:unit
  Test Files  7 passed | 1 skipped (8)
  Tests  40 passed | 2 todo (42)

uv run pytest packages/pipeline/tests/test_cost_double_count.py -x
  3 passed in 0.02s
```

## Self-Check: PASSED

Files exist:
- convex/agentRuns.ts ✓
- convex/auditLog.ts ✓
- apps/dispatch-control/lib/costRollup.ts ✓
- apps/dispatch-control/__tests__/setup.ts ✓
- apps/dispatch-control/__tests__/costRollup.test.ts ✓
- apps/dispatch-control/__tests__/agentRuns.test.ts ✓
- apps/dispatch-control/__tests__/auditLog.test.ts ✓
- packages/pipeline/tests/test_cost_double_count.py ✓

Commits exist:
- baea19c (schema task 1) ✓
- 91826eb (agentRuns + auditLog task 2) ✓
- fe30572 (harness + util + tests task 3) ✓
