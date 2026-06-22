---
phase: "23"
plan: "03"
subsystem: dispatch-control-graph
tags: [react-flow, dagre, convex, agent-dag, live-status, io-panel]
dependency-graph:
  requires: [23-01]
  provides: [graph-page, pipeline-canvas, agent-node, agent-io-panel]
  affects: [dispatch-control]
tech-stack:
  added: ["@xyflow/react@12.11.0", "@dagrejs/dagre@3.0.0"]
  patterns: [ReactFlowProvider-client-component, dagre-tb-layout, convex-skip-pattern, D16-env-null-guard]
key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/graph/_components/pipelineTopology.ts
    - apps/dispatch-control/app/(dashboard)/graph/_components/useGraphLayout.ts
    - apps/dispatch-control/app/(dashboard)/graph/_components/AgentNode.tsx
    - apps/dispatch-control/app/(dashboard)/graph/_components/PipelineGraph.tsx
    - apps/dispatch-control/app/(dashboard)/graph/_components/AgentIOPanel.tsx
    - apps/dispatch-control/__tests__/AgentNode.test.tsx
    - apps/dispatch-control/__tests__/pipelineTopology.test.ts
  modified:
    - apps/dispatch-control/package.json
    - convex/runs.ts
    - apps/dispatch-control/app/(dashboard)/graph/page.tsx
    - apps/dispatch-control/vitest.config.ts
    - convex/_generated/api.d.ts
    - apps/dispatch-control/components/ConvexClientProvider.tsx
decisions:
  - "agentKey→displayName derived via toDisplayName() (Title Case from snake_case); no displayName field on agents table"
  - "computeLayout() is a pure synchronous function (not a hook) — dagre layout called inside useMemo"
  - "AgentRun status typed as string in AgentIOPanel to avoid circular import; cast at usage site in PipelineGraph"
  - "ConvexClientProvider D-16 null guard added to fix build without NEXT_PUBLIC_CONVEX_URL (mirrors apps/web pattern)"
  - "runs.latest query uses client-side sort (52 runs/year — negligible, per RESEARCH Pattern 5)"
metrics:
  duration: "~30 minutes total execution (including merge + prior context)"
  tasks_completed: 3
  files_changed: 13
  completed_date: "2026-06-22"
---

# Phase 23 Plan 03: Graph View — React Flow DAG with Live Status Summary

React Flow DAG canvas for the dispatch-control pipeline graph, wiring static topology, config-at-rest display (OBS-01), live Convex status repaint (OBS-03), and per-agent I/O inspection (OBS-05).

## What Was Built

**Static topology (`pipelineTopology.ts`):** Defines 18 nodes (calibrator → publisher, including all 7 section writers with `design` always present), 23 edges representing the sequential spine + 7-way fan-out/fan-in. Single source of truth matching `builder.py`.

**Dagre layout (`useGraphLayout.ts`):** Pure `computeLayout()` function (not a hook). Applies dagre TB layout with `nodesep:60, ranksep:80`, node dimensions 176×72. Returns `{ nodes: layoutedNodes, edges }` for React Flow.

**AgentNode (`AgentNode.tsx`):** Custom `'use client'` React Flow node. Two rendering modes:
- At rest: shows `displayName`, `model`, `description`, dimmed + "suppressed" badge when `enabled=false`
- During run: border/background color by status (queued/running/done/failed), animated spinner for running, inline `$cost · Xs` text
- Selected: ring-2 outline

**PipelineGraph (`PipelineGraph.tsx`):** Client Component wrapped in `<ReactFlowProvider>`. Three `useQuery` subscriptions:
- `api.agents.listForWorkspace` — config at rest
- `api.runs.latest` — most recent run to resolve `runId`
- `api.agentRuns.byRunId` — live per-agent status (skipped when `runId` is null)
Node data merged inside `useMemo`. Node click toggles `selectedAgentKey` (click again to deselect).

**AgentIOPanel (`AgentIOPanel.tsx`):** Absolute-positioned slide-over panel (w-96, right-0). Queries `api.agentRuns.payloadByRunIdAgentKey` for `inputSnapshot` + `outputSnapshot` (pretty-printed JSON in `<pre>`). Shows error block when status=failed, metrics table with cost/duration/tokens.

**graph/page.tsx:** Server Component — calls `await getCurrentWorkspace()`, renders `<PipelineGraph workspace_id={...} />`. Dashboard content area fills remaining height via `flex-1 min-h-0`.

**runs.latest (convex/runs.ts):** New query — fetches all runs for workspace, sorts client-side, returns newest. Used by PipelineGraph to identify the active runId without a dedicated index.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `displayName` not in agents table schema**
- **Found during:** Task 3 — TypeScript build error `Property 'displayName' does not exist`
- **Issue:** `PipelineGraph.tsx` referenced `config?.displayName` but the `agents` table only has `agentKey`, `model`, `enabled`, `description`
- **Fix:** Derive display name via `toDisplayName(agentKey)` (Title Case from snake_case). No schema change needed.
- **Files modified:** `apps/dispatch-control/app/(dashboard)/graph/_components/PipelineGraph.tsx`
- **Commit:** 275b8f3

**2. [Rule 2 - Missing null guard] ConvexClientProvider throws without NEXT_PUBLIC_CONVEX_URL**
- **Found during:** Task 3 — `next build` prerender error "No address provided to ConvexReactClient"
- **Issue:** `ConvexClientProvider.tsx` used `new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)` — the `!` doesn't prevent runtime throw when env var is absent in CI/build
- **Fix:** D-16 null guard (mirrors the pattern from `apps/web`): `const convex = convexUrl ? new ConvexReactClient(convexUrl) : null`. When null, render `<>{children}</>` (build-time passthrough only — app doesn't function without a real URL)
- **Files modified:** `apps/dispatch-control/components/ConvexClientProvider.tsx`
- **Commit:** 275b8f3

**3. [Rule 3 - Blocking] `@vitejs/plugin-react` v6 ERR_PACKAGE_PATH_NOT_EXPORTED**
- **Found during:** Task 2 — AgentNode.test.tsx JSX transform needed
- **Issue:** `@vitejs/plugin-react@6.0.2` not compatible with installed vite version in worktree
- **Fix:** Used `esbuild: { jsx: 'automatic', jsxImportSource: 'react' }` in `vitest.config.ts` directly instead of a plugin. Achieves automatic JSX transform without plugin dependency.
- **Files modified:** `apps/dispatch-control/vitest.config.ts`
- **Commit:** 30e1a76

## Test Results

```
Test Files  9 passed | 1 skipped (10)
     Tests  53 passed | 2 todo (55)
```

New tests added this plan:
- `AgentNode.test.tsx`: 4 tests — at-rest model display, suppressed badge, cost string, running spinner
- `pipelineTopology.test.ts`: 9 tests — 18 nodes, design always present, 7 fan-out edges, 7 fan-in edges, symmetric fan-out/fan-in sets match SECTION_WRITER_KEYS

## Build Verification

```
✓ Compiled successfully
/graph route: 73.2 kB (206 kB first load)
Build: exits 0
```

## Known Stubs

None — all data flows are wired. At rest: agents table drives node display. During run: agent_runs drives live status. AgentIOPanel: agent_run_payloads drives I/O snapshots. The graph renders an empty canvas when no run is active and no agents are seeded, which is expected behavior for a fresh workspace.

## Commits

| Hash | Message |
|------|---------|
| fb96b23 | feat(23-03): install ReactFlow+dagre; runs:latest query; pipeline topology + dagre layout |
| 30e1a76 | feat(23-03): AgentNode custom node + jsdom vitest config + AgentNode tests |
| 275b8f3 | feat(23-03): PipelineGraph canvas + AgentIOPanel + graph page + topology tests |

## Self-Check: PASSED

All 8 key files found on disk. All 3 task commits found in git log. Build exits 0. 53 tests pass.
