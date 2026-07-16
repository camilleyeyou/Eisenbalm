---
phase: 45-agent-revision
plan: 06
type: execute
wave: 2
depends_on: ["45-01"]
files_modified:
  - apps/dispatch-control/lib/derivedState.ts
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx
  - apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx
  - apps/dispatch-control/__tests__/derivedState.test.ts
autonomous: true
requirements: [REV-05]
must_haves:
  truths:
    - "The workspace header shows the issue's cost-vs-budget ($spent / $cap) next to the tasks/minutes line"
    - "When the cost is not yet known the header shows a refresh affordance, never a stale or fake zero (never-blank honesty)"
    - "Spend is summed from durable agentRuns:byRunId costUsd rows; the cap is per_run_cap_usd from pipelineConfig (default 10.0)"
  artifacts:
    - path: "apps/dispatch-control/lib/derivedState.ts"
      provides: "deriveRunCostUsd(rows) -> number|undefined + deriveRunCapUsd(pipelineConfigRows) -> number"
      exports: ["deriveRunCostUsd"]
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"
      provides: "agentRuns.byRunId subscription + pipelineConfig.getAll → runCostUsd/capUsd on context"
      contains: "agentRuns.byRunId"
  key_links:
    - from: "WorkspaceStateProvider.tsx"
      to: "api.agentRuns.byRunId"
      via: "useQuery(runId ? {runId} : 'skip') → deriveRunCostUsd"
      pattern: "agentRuns.byRunId"
    - from: "layout.tsx FrameChrome"
      to: "useWorkspaceState().runCostUsd / capUsd"
      via: "cost-vs-budget span next to {tasks.length} open · ~{workMinutes} min"
      pattern: "runCostUsd"
---

<objective>
Deliver REV-05's visible half: a net-new cost-vs-budget readout in the workspace `FrameChrome`
header, next to the existing `{tasks.length} open · ~{workMinutes} min` line. Sum the issue's spend
from the durable `agentRuns:byRunId` rows (never the in-memory pipeline cost store), read the cap
from `per_run_cap_usd` in `pipelineConfig`, expose both via `WorkspaceStateProvider`, and render
them never-blank (unknown → refresh affordance, never a stale/fake zero) — the same honesty rule the
milestone locks.

Purpose: REV-05 requires the guard be "visible against the header's cost-vs-budget readout." This
plan needs zero new Convex schema/function — `agentRuns.byRunId` and `pipelineConfig.getAll` are
already public queries. It works independently of the pipeline cost-recording (45-03) because the
readout also reflects the original pipeline-agent rows.
Output: `deriveRunCostUsd`/`deriveRunCapUsd` helpers, provider subscription, header readout.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@.planning/phases/45-agent-revision/45-RESEARCH.md

<interfaces>
<!-- Existing query sources (no new Convex code). -->
convex/agentRuns.ts:224 byRunId({runId}) -> rows[{costUsd?, ...}]           // durable per-issue spend
convex/pipelineConfig.ts:61 getAll({workspace_id}) -> rows[{key:string, value:string(JSON)}]  // per_run_cap_usd, default 10.0

<!-- Provider + header to extend. -->
WorkspaceStateProvider.tsx:120-124 the skip-guarded useQuery block (mirror for agentRuns/pipelineConfig)
WorkspaceStateProvider.tsx:50-89 WorkspaceStateValue interface (add runCostUsd?: number; capUsd: number)
layout.tsx:161 const { status, stages, tasks, workMinutes, panelContent } = useWorkspaceState()
layout.tsx:194-197 the "{tasks.length} open · ~{workMinutes} min" span — the readout mounts beside it

<!-- Existing pure-derivation home + its test. -->
lib/derivedState.ts (pure TS, NO Convex import) — deriveRunCostUsd/deriveRunCapUsd land here
__tests__/derivedState.test.ts — extend with the new helpers
DEFAULT_WORKSPACE_ID from '@/lib/workspace'
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: deriveRunCostUsd + deriveRunCapUsd pure helpers</name>
  <requirements>REV-05</requirements>
  <read_first>
    - apps/dispatch-control/lib/derivedState.ts — the pure-TS derivation module (NO Convex import) these helpers join; mirror an existing exported helper's signature/style.
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py:244-256 — how the pipeline parses `pipelineConfig:getAll` rows (`_pc[row["key"]] = json.loads(row["value"])`) — mirror the JSON-parse for `per_run_cap_usd` (default 10.0).
    - apps/dispatch-control/__tests__/derivedState.test.ts — the test file to extend.
  </read_first>
  <behavior>
    - deriveRunCostUsd(undefined) === undefined   (loading → never zero)
    - deriveRunCostUsd([]) === 0
    - deriveRunCostUsd([{costUsd:1.2},{costUsd:0.3},{}]) === 1.5
    - deriveRunCapUsd(undefined) === 10.0   (default until config loads)
    - deriveRunCapUsd([{key:'per_run_cap_usd', value:'25'}]) === 25
    - deriveRunCapUsd([{key:'schedule_enabled', value:'true'}]) === 10.0   (key absent → default)
  </behavior>
  <files>apps/dispatch-control/lib/derivedState.ts, apps/dispatch-control/__tests__/derivedState.test.ts</files>
  <action>
Add to `lib/derivedState.ts` (keep it pure — no Convex import):
```ts
export function deriveRunCostUsd(rows: Array<{ costUsd?: number }> | undefined): number | undefined {
  if (rows === undefined) return undefined   // never-blank: loading, not zero
  return rows.reduce((sum, r) => sum + (r.costUsd ?? 0), 0)
}
export function deriveRunCapUsd(pipelineConfigRows: Array<{ key: string; value: string }> | undefined): number {
  if (pipelineConfigRows === undefined) return 10.0
  const row = pipelineConfigRows.find(r => r.key === 'per_run_cap_usd')
  if (!row) return 10.0
  try { const v = JSON.parse(row.value); return typeof v === 'number' ? v : Number(v) || 10.0 }
  catch { return Number(row.value) || 10.0 }
}
```
Extend `__tests__/derivedState.test.ts` with a `describe` covering every `<behavior>` case.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/derivedState.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `lib/derivedState.ts` exports `deriveRunCostUsd` and `deriveRunCapUsd`; the module still imports nothing from Convex.
    - `deriveRunCostUsd(undefined)` returns `undefined` (asserted); `deriveRunCapUsd` defaults to `10.0` when the key/rows are absent.
    - `cd apps/dispatch-control && npx vitest run __tests__/derivedState.test.ts` exits 0.
  </acceptance_criteria>
  <done>Two pure helpers compute per-issue spend (undefined while loading) and the cap (default 10.0), both fully tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Provider subscription + never-blank FrameChrome readout</name>
  <requirements>REV-05</requirements>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx:98-235 — the skip-guarded useQuery block + the `WorkspaceStateValue` interface + the `value` object to extend (add two subscriptions + two context fields, mirroring the existing eight).
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx:159-200 — `FrameChrome`, the `useWorkspaceState()` destructure, and the `{tasks.length} open · ~{workMinutes} min` span the readout mounts beside.
    - apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx — the Wave-0 it.todo stub to convert.
    - RESEARCH.md "Frontend: summing per-issue cost" code block — the exact never-blank render (loading → "cost unknown — refresh"; known → "$x.xx / $y.yy").
  </read_first>
  <behavior>
    - While agentRuns is loading (runCostUsd undefined) the header renders a refresh affordance, not $0 or a blank
    - When known, the header renders "$<spent> / $<cap>" (2dp)
    - The readout sits next to the tasks/minutes line
  </behavior>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx, apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx</files>
  <action>
`WorkspaceStateProvider.tsx`:
- Add two skip-guarded subscriptions beside the existing ones:
  `const agentRunRows = useQuery(api.agentRuns.byRunId, runId ? { runId } : 'skip')`
  `const pipelineConfigRows = useQuery(api.pipelineConfig.getAll, { workspace_id: DEFAULT_WORKSPACE_ID })`
- `const runCostUsd = deriveRunCostUsd(agentRunRows as Array<{costUsd?:number}> | undefined)`
  `const capUsd = deriveRunCapUsd(pipelineConfigRows as Array<{key:string; value:string}> | undefined)`.
- Add `runCostUsd: number | undefined` and `capUsd: number` to `WorkspaceStateValue` and to the returned `value` object. Keep the never-blank contract: `runCostUsd` stays `undefined` while `agentRunRows` is loading (do NOT coerce to 0).

`layout.tsx` FrameChrome:
- Destructure `runCostUsd, capUsd` from `useWorkspaceState()`.
- Next to the `{tasks.length} open · ~{workMinutes} min` span, render the cost-vs-budget readout: when `runCostUsd === undefined` render a refresh affordance span (`cost unknown — refresh`, ink-soft, mono) — NEVER `$0`; otherwise render `${runCostUsd.toFixed(2)} / ${capUsd.toFixed(2)}` (mono, ink). Give the readout a stable `data-testid="cost-vs-budget"` so the test can target it.

Convert the Wave-0 `FrameChromeCostReadout.test.tsx` it.todo entries into real assertions: mock
`useWorkspaceState` (or mount the provider with mocked `useQuery`) to assert the undefined→refresh
and known→"$x / $y" states.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/FrameChromeCostReadout.test.tsx && npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `WorkspaceStateProvider.tsx` subscribes to `api.agentRuns.byRunId` (skip-guarded) and `api.pipelineConfig.getAll`, and exposes `runCostUsd`/`capUsd` on the context value.
    - `layout.tsx` renders a `data-testid="cost-vs-budget"` readout that shows a refresh affordance when `runCostUsd === undefined` and `$spent / $cap` otherwise — never `$0` while loading.
    - `cd apps/dispatch-control && npx vitest run __tests__/FrameChromeCostReadout.test.tsx` exits 0; `npm run build` succeeds.
  </acceptance_criteria>
  <done>The header shows the issue's cost-vs-budget from durable agent_runs against per_run_cap_usd, never-blank (loading → refresh affordance).</done>
</task>

</tasks>

<verification>
- `npx vitest run __tests__/derivedState.test.ts __tests__/FrameChromeCostReadout.test.tsx` green.
- `npm run build` succeeds.
- Full console vitest green.
</verification>

<success_criteria>
The workspace header carries a never-blank cost-vs-budget readout summed from durable agent_runs vs
per_run_cap_usd — the visible surface REV-05's guard reports against.
</success_criteria>

<output>
After completion, create `.planning/phases/45-agent-revision/45-06-SUMMARY.md`.
</output>
