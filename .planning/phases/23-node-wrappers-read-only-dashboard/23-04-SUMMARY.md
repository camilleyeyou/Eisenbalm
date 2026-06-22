---
phase: 23-node-wrappers-read-only-dashboard
plan: "04"
subsystem: dispatch-control-runs-audit
tags: [convex, runs, audit-log, cost-rollup, react-components, next-dynamic]
dependency_graph:
  requires: [23-01, 23-03]
  provides:
    - runs:listForWorkspace Convex query (OBS-02)
    - RunsTable component (OBS-02 run history table)
    - CostRollup component (OBS-04 week/month aggregate spend)
    - RunDetail component (OBS-04 per-agent reconciliation)
    - AuditLogViewer component (AUD-01 read-only viewer)
    - auditViewer convex-test spec (AUD-01 row shape validation)
    - runs convex-test spec (listForWorkspace newest-first ordering)
    - force-dynamic pattern for Convex SSR safety across dashboard
  affects:
    - convex/runs.ts (listForWorkspace appended)
    - apps/dispatch-control/app/(dashboard)/runs/ (full replacement)
    - apps/dispatch-control/app/(dashboard)/settings/ (AuditLogViewer added)
    - apps/dispatch-control/app/(dashboard)/graph/ (force-dynamic fix)
tech_stack:
  added: []
  patterns:
    - force-dynamic export on all dashboard pages with Convex useQuery (SSR safety)
    - Server Component resolves workspace_id; Client Component subscribes
    - parseCostJson + sumRunsCost imported (not reimplemented)
    - <details><summary> for collapsible JSON before/after in audit viewer
    - OBS-04 reconciliation panel: per-agent sum side-by-side with runs.cost.total
key_files:
  created:
    - apps/dispatch-control/__tests__/runs.test.ts
    - apps/dispatch-control/__tests__/auditViewer.test.ts
    - apps/dispatch-control/app/(dashboard)/runs/_components/RunsTable.tsx
    - apps/dispatch-control/app/(dashboard)/runs/_components/CostRollup.tsx
    - apps/dispatch-control/app/(dashboard)/runs/_components/RunDetail.tsx
    - apps/dispatch-control/app/(dashboard)/runs/[runId]/page.tsx
    - apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx
  modified:
    - convex/runs.ts (listForWorkspace query appended)
    - apps/dispatch-control/vitest.config.ts (runs.test.ts + auditViewer.test.ts edge-runtime entries)
    - apps/dispatch-control/app/(dashboard)/runs/page.tsx (replaced placeholder)
    - apps/dispatch-control/app/(dashboard)/settings/page.tsx (AuditLogViewer added)
    - apps/dispatch-control/app/(dashboard)/graph/page.tsx (force-dynamic fix)
decisions:
  - "force-dynamic required on all pages with Convex useQuery: D-16 null guard passes children through without ConvexProvider, causing useQuery to throw during static prerendering; force-dynamic skips static generation"
  - "Reconciliation panel shows both per-agent sum (from parseCostJson(run.cost).agents) and runs.cost.total side-by-side; discrepancy shown in red when delta > $0.0001"
  - "AuditLogViewer hard-codes limit=50; no write controls; empty state message references Phase 24 as when emissions begin"
  - "graph/page.tsx force-dynamic fix applied as Rule 1 auto-fix (same prerender bug from 23-03 that slipped through)"
metrics:
  duration: "~12 min"
  completed_date: "2026-06-22"
  tasks: 3
  files: 12
---

# Phase 23 Plan 04: Read-Only Runs Dashboard + Audit Viewer Summary

Runs history table + run detail with cost reconciliation (OBS-02, OBS-04) and read-only audit-log viewer (AUD-01) for the dispatch-control dashboard. Operators can now inspect every past run, see per-agent cost reconciled against the single recorder, and view audit infrastructure ahead of Phase 24 emissions.

## What Was Built

**Task 1 — runs:listForWorkspace query + test spec:**
- Appended `listForWorkspace` to `convex/runs.ts`: queries `by_workspace` index, sorts by `startedAt` descending, returns all runs for the workspace
- `__tests__/runs.test.ts`: 3 convex-test specs asserting newest-first ordering and workspace isolation
- `vitest.config.ts` updated with `runs.test.ts` and `auditViewer.test.ts` edge-runtime entries

**Task 2 — Runs history table + run detail + cost roll-up:**
- `RunsTable.tsx`: Client Component, `useQuery(api.runs.listForWorkspace)`, columns: status badge / triggerSource / triggeredBy / startedAt / durationMs / cost total; each row links to `/runs/{runId}`; friendly empty state
- `CostRollup.tsx`: Client Component, collapsible `<details>` card at top of Runs list; filters runs by `startedAt >= sevenDaysAgo` / `thirtyDaysAgo`, calls `sumRunsCost(filtered)` for each window; renders a two-row aggregate table + recent per-run costs
- `runs/page.tsx`: Server Component, resolves `workspace_id`, renders `CostRollup` then `RunsTable`; `force-dynamic` to prevent static prerender with no Convex URL
- `RunDetail.tsx`: Client Component, `useQuery(api.runs.byRunId)` for run header + `useQuery(api.agentRuns.byRunId)` for per-agent table (agentKey/status/costUsd/durationMs/tokensIn/tokensOut/error); OBS-04 reconciliation panel shows per-agent sum alongside `parseCostJson(run.cost).total` with red discrepancy alert when delta > $0.0001
- `runs/[runId]/page.tsx`: Server Component, reads `runId` from params, renders `RunDetail`; `force-dynamic`

**Task 3 — Read-only audit-log viewer + auditViewer test spec:**
- `AuditLogViewer.tsx`: Client Component, `useQuery(api.auditLog.listForWorkspace, { workspace_id, limit: 50 })`; renders timestamp/actorId/action/resourceType/resourceId/before/after; before/after JSON collapsed in `<details><summary>` with pretty-print; empty state: "No audit events yet — actions are recorded starting in Phase 24"; no write controls
- `settings/page.tsx`: kept existing placeholder content; appended `<hr>` + `<AuditLogViewer>`; `force-dynamic`
- `__tests__/auditViewer.test.ts`: 3 convex-test specs validating AUD-01 row shape: action, numeric timestamp, before/after optional fields, newest-first ordering

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] graph/page.tsx also fails static prerender without force-dynamic**
- **Found during:** Task 2 build diagnosis
- **Issue:** The 23-03 summary claimed "Build: exits 0" but local CI confirms `/graph` also throws "Could not find Convex client!" during static prerender when `NEXT_PUBLIC_CONVEX_URL` is absent — same root cause as `/runs`
- **Fix:** Added `export const dynamic = 'force-dynamic'` to `apps/dispatch-control/app/(dashboard)/graph/page.tsx` alongside the same fix on all new pages
- **Files modified:** `apps/dispatch-control/app/(dashboard)/graph/page.tsx`
- **Commit:** 1529ea1

**2. [Rule 2 - Missing] force-dynamic on all Convex-subscribed pages**
- **Found during:** Task 2 — `pnpm --filter dispatch-control build` fails with prerender error
- **Issue:** D-16 null guard passes children unwrapped when Convex URL is absent, but `useQuery` still throws "Could not find Convex client!" because the ConvexProvider context is missing — static prerendering must be skipped on any page that reaches Convex queries
- **Fix:** `export const dynamic = 'force-dynamic'` on runs/page.tsx, runs/[runId]/page.tsx, settings/page.tsx, graph/page.tsx
- **Files modified:** All four pages
- **Commit:** 1529ea1

## Test Results

```
pnpm --filter dispatch-control test:unit -- runs
  ✓ __tests__/runs.test.ts (3 tests)
  Tests  59 passed | 2 todo (61)

pnpm --filter dispatch-control test:unit -- auditViewer
  ✓ __tests__/auditViewer.test.ts (3 tests)
  Tests  59 passed | 2 todo (61)
```

Total test count: 59 passing (up from 53 in 23-03).

## Build Verification

```
Route (app)                Size  First Load JS
├ ƒ /graph               70.5 kB         207 kB
├ ƒ /runs                  2 kB          132 kB
├ ƒ /runs/[runId]        2.02 kB         132 kB
├ ƒ /settings            1.34 kB         128 kB
Build: exits 0
```

All four Convex-subscribed pages are `ƒ` (dynamic), not `○` (static).

## Known Stubs

None — all data flows are wired:
- `RunsTable` reads live `runs` table rows
- `CostRollup` reads `runs.cost` via `parseCostJson` + `sumRunsCost`
- `RunDetail` reads live `runs` + `agentRuns` rows
- `AuditLogViewer` reads live `audit_log` rows
The audit viewer shows an empty state ("No audit events yet") which is correct behavior — actual audit emissions land in Phases 24-26.

## Commits

| Hash | Message |
|------|---------|
| b31d093 | feat(23-04): runs:listForWorkspace query + convex-test spec |
| 1529ea1 | feat(23-04): runs history table + run detail + cost roll-up (OBS-02, OBS-04) |
| 9b9c328 | feat(23-04): read-only audit-log viewer + auditViewer test spec (AUD-01) |

## Self-Check: PASSED
