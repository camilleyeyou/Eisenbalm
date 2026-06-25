---
phase: quick-260625-7ya
plan: 01
subsystem: convex
tags: [convex, pipelineRuns, runs, status-mirror, zombie-run, 409-gate]
dependency_graph:
  requires: []
  provides: [status-mirror-pipelineruns-to-runs]
  affects: [convex/pipelineRuns.ts, dispatch-control dashboard run list]
tech_stack:
  added: []
  patterns: [null-guard-skip-silent, status-mirror-alongside]
key_files:
  modified:
    - convex/pipelineRuns.ts
decisions:
  - "Null-guard (skip silently) rather than throw when runs row is absent — pipelineRuns patch must always succeed for legacy/test runIds"
  - "Write only status + completedAt to runs; pipelineRuns-only fields (errorMessage, durationMs, cost, awaitingHumanAt, sanityIssueId) never written to runs"
  - "Used tsc --noEmit from main repo (not worktree) because convex/ has no own node_modules; codegen required CONVEX_DEPLOYMENT which is offline; noted below"
metrics:
  duration: "~5 min"
  completed: "2026-06-25"
  tasks: 2
  files: 1
---

# Quick 260625-7ya: Mirror pipelineRuns.status into Dashboard Runs Row — Summary

**One-liner:** Wired the missing status mirror in `pipelineRuns:updateStatus` so failed/complete/awaiting-review transitions land terminal in the `runs` table too, clearing the zombie-run 409 gate that blocked new manual runs after a Scout crash.

---

## What Changed

### `convex/pipelineRuns.ts` — `updateStatus` handler

After the existing `ctx.db.patch(run._id, updates)` that writes `pipelineRuns`, inserted a mirror block:

```typescript
// ── Mirror status into the dashboard runs row (schema.ts line 246:
// "mirrors pipelineRuns.status; updated alongside it"). Null-guard: skip
// silently if the runs row doesn't exist (legacy/test runIds) — the
// pipelineRuns patch above must always succeed regardless. ──────────────
const dashboardRun = await ctx.db
  .query('runs')
  .withIndex('by_runId', q => q.eq('runId', args.runId))
  .first()
if (dashboardRun) {
  await ctx.db.patch(dashboardRun._id, {
    status: args.status,
    ...(args.completedAt !== undefined ? { completedAt: args.completedAt } : {}),
  })
}
```

Nothing else changed: the `args` validator is identical, the pipelineRuns patch is identical, and the Phase 27 NTF-01 notification block is byte-identical.

---

## Convex Typecheck Path Used

**Fallback: `tsc --noEmit -p convex/tsconfig.json`** (run from main repo root using `apps/web/node_modules/.bin/tsc`).

Why fallback:
- `npx convex codegen` requires `CONVEX_DEPLOYMENT` env var to be set; running offline/without credentials exits with "No CONVEX_DEPLOYMENT set" and produces no type output.
- The worktree has no `node_modules/`; the convex package lives in the main repo's root `node_modules/`.
- Running tsc from the main repo root (where `convex/` package is resolvable) against `convex/tsconfig.json` produced **0 errors** — clean.

---

## Pytest Result

```
347 passed, 33 skipped, 6 warnings in 13.40s
```

`tests/lib/test_vercel_client.py` was excluded (requires `respx` which is not installed in the local environment — pre-existing; all other tests green). Python is unchanged; this is a pure confidence check.

---

## Four-Case Manual-Reasoning Walkthrough

### Case 1 — failed (Scout crash)

1. Agent node wrapper catches exception, calls `pipelineRuns:updateStatus(runId, status='failed', completedAt=...)`.
2. Handler patches `pipelineRuns` row → `status='failed'`.
3. Mirror block looks up `runs` row by `runId` → found → patches `status='failed', completedAt=...`.
4. `runs:latest` query that the 409 gate uses (`status=='running'`) now returns no 'running' row.
5. New manual run is no longer blocked. **Zombie fixed.**

### Case 2 — complete / awaiting-review (happy path / Editor Gate 1)

1. Publisher or Editor agent calls `pipelineRuns:updateStatus(runId, status='complete'|'awaiting-review', completedAt=...)`.
2. Handler patches `pipelineRuns` row to terminal status.
3. Mirror block patches `runs` row to the same terminal status + `completedAt`.
4. Dashboard shows correct terminal state; 409 gate clears for the next weekly run. **Correct.**

### Case 3 — cancel / cost-cap (cooperative cancel path)

1. `_execute_run` in `packages/pipeline/.../api/runs.py` (lines 197-209) calls `runs:updateStatus(runId, status='cancelled')` **directly** — it does NOT call `pipelineRuns:updateStatus`.
2. Therefore the mirror block in `pipelineRuns:updateStatus` never executes on the cancel path.
3. The `runs` row is written `'cancelled'` by `runs:updateStatus` as its terminal writer.
4. There is no subsequent `pipelineRuns:updateStatus` call on the cancel path that could overwrite it.
5. **The 'cancelled' runs row can never be clobbered by the mirror.** The two mutation callers (`runs:updateStatus` for cancel, `pipelineRuns:updateStatus` for agent-lifecycle) are on separate call paths with no overlap on the cancel branch.

### Case 4 — missing runs row (legacy / test runId)

1. `pipelineRuns:updateStatus` is called with a runId that has no matching `runs` row (e.g., a legacy run created before the `runs` table existed, or a unit test that only inserts into `pipelineRuns`).
2. Handler patches `pipelineRuns` row — succeeds as before.
3. Mirror block: `ctx.db.query('runs').withIndex('by_runId')...first()` returns `null`.
4. `if (dashboardRun)` is falsy → mirror block body is skipped entirely.
5. No throw, no error. The `pipelineRuns` patch completes normally. **Null-guard works.**

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Self-Check

- [x] `convex/pipelineRuns.ts` modified with mirror block
- [x] Commit `05ac1a5` exists
- [x] Typecheck: tsc --noEmit clean (0 errors) — codegen fallback noted above
- [x] Pytest: 347 passed, 0 failures
- [x] Notification block unchanged (byte-identical)
- [x] No Python files modified
- [x] No `npx convex deploy` run
- [x] No prod data mutated

## Self-Check: PASSED
