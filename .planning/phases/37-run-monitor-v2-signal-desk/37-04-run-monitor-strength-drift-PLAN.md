---
phase: 37-run-monitor-v2-signal-desk
plan: 04
type: execute
wave: 3
depends_on: ["37-03"]
files_modified:
  - apps/dispatch-control/lib/runMonitor/strengthScore.ts
  - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/WriterExpansion.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/DriftStrip.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx
  - apps/dispatch-control/__tests__/strengthScore.test.ts
  - apps/dispatch-control/__tests__/WriterExpansion.test.tsx
  - apps/dispatch-control/__tests__/DriftStrip.test.tsx
autonomous: true
requirements: [MON-03, MON-04]
must_haves:
  truths:
    - "The 7-writers node expands to per-section rows, each with a 0-100 QA-derived strength bar, flag counts by severity, and an individual re-run"
    - "A drift strip compares this run's cost and duration against the trailing 8 completed runs"
  artifacts:
    - path: "apps/dispatch-control/lib/runMonitor/strengthScore.ts"
      provides: "deterministic 0-100 strength from open qaCorrections (reuses isOpenFinding)"
      contains: "strengthScore"
    - path: "apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/WriterExpansion.tsx"
      provides: "per-section rows: strength bar + flag counts + rerun_agent"
      contains: "rerun"
    - path: "apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/DriftStrip.tsx"
      provides: "current vs trailing-8 mean cost/duration"
      contains: "pipelineRuns"
  key_links:
    - from: "WriterExpansion.tsx"
      to: "POST /runs/{run_id}/agents/{agent_key}/rerun"
      via: "per-section re-run button"
      pattern: "rerun"
    - from: "DriftStrip.tsx"
      to: "convex pipelineRuns.byRunId"
      via: "per-trailing-run cost/duration aggregation"
      pattern: "pipelineRuns"
    - from: "strengthScore.ts"
      to: "lib/galley/findingState.ts isOpenFinding"
      via: "open-finding filter before penalty"
      pattern: "isOpenFinding"
---

<objective>
Complete Run Monitor v2 with the 7-writers strength expansion (MON-03) and the drift strip (MON-04), wiring both into the spine built in 37-03.

- MON-03: the 7-writers node expands into per-section rows. Each row shows a deterministic 0-100 strength bar (start 100; subtract severity-weighted penalty per OPEN qaCorrections finding: error −25, warning −8, info −2; floor 0; color green ≥80 / amber 50-79 / red <50), flag counts by severity, and an individual re-run via the existing `rerun_agent` endpoint. Section IDs map 1:1 to writer agentKeys (Research Pattern 2 — no new lookup).
- MON-04: a drift strip aggregates this run vs the trailing 8 COMPLETED runs — read `pipelineRuns:byRunId(runId).cost`/`.durationMs` per trailing run (Research Pitfall 5: `runs.cost`/`runs.durationMs` are dead fields, do NOT read them), compare current cost + duration to the trailing mean with an over/under % indicator; n<8 → compare against what exists and label the n.

Purpose: turn the spine into a forensic drift + per-section quality tool.
Output: strength lib + two new components mounted into PipelineGraph, RED-first.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/37-run-monitor-v2-signal-desk/37-CONTEXT.md
@.planning/phases/37-run-monitor-v2-signal-desk/37-RESEARCH.md

<interfaces>
<!-- Executor: exact reusable shapes. Do NOT re-derive these. -->

lib/galley/findingState.ts:
```ts
export function isOpenFinding(row: { accepted?: boolean; resolution?: 'accepted'|'dismissed'|null }): boolean
// = row.accepted !== true && row.resolution == null   (Phase 33 canonical open-finding predicate)
```
lib/costRollup.ts: `export function parseCostJson(raw): CostPayload` → `.total` number (+ `.agents`), malformed-JSON safe.

Convex queries (ALL already exist — no new queries):
- `api.qaCorrections.byRunId({runId})` → rows `{sectionName, severity: 'info'|'warning'|'error', accepted, resolution?, resolutionReason?, ...}`.
- `api.runs.listForWorkspace({workspace_id})` → run list (to pick the trailing 8 completed).
- `api.pipelineRuns.byRunId({runId})` → `{status, completedAt, cost, durationMs, ...}` (cost is a JSON string for parseCostJson; RELIABLY populated, unlike runs.cost).

Section→agentKey (Research Pattern 2, byte-identical): qaCorrections.sectionName values `origin_story`, `problem`, `founder_bio`, `case_study`, `game`, `bonus` == the re-rollable writer agentKeys. Use sectionName directly as the `{agent_key}` path param.

Re-run endpoint (exists, control.py rerun_agent, Clerk-guarded): `POST /runs/{run_id}/agents/{agent_key}/rerun` → `{runId, agentKey, rerolled: true}`. Only the 7 section writers are RE_ROLLABLE (422 otherwise). Call it from the dashboard via the existing pipeline-API fetch helper used by other control actions (mirror the Phase 33 rail's re-run call site).

React-hooks-per-row rule (Research Pattern 1): `useQuery` cannot be called a variable number of times in one component. For the drift strip, render one small child `<DriftBar runId=... />` per trailing runId, each with its own `useQuery(api.pipelineRuns.byRunId, {runId})`.

PipelineGraph.tsx (from 37-03) owns the spine + node selection. Mount WriterExpansion when the selected node is the 7-writers group / a section writer; mount DriftStrip in the run-summary area.
</interfaces>
</context>

<sequencing_note>
Waves run SEQUENTIALLY in the main checkout — NO worktrees. This is Wave 3; it depends on 37-03 (owns/mounts into PipelineGraph.tsx). Land 37-03 first to avoid a file-ownership collision on PipelineGraph.tsx.
</sequencing_note>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Deterministic strengthScore lib (MON-03 core)</name>
  <read_first>
    - apps/dispatch-control/lib/galley/findingState.ts (isOpenFinding — reuse, do NOT re-derive)
    - apps/dispatch-control/__tests__/qaCorrectionsResolution.test.ts (open-finding test pattern reference)
    - apps/dispatch-control/__tests__/strengthScore.test.ts (NEW — Wave 0)
  </read_first>
  <behavior>
    - strengthScore.test.ts: `strengthScore([])` === 100. One open error → 75; one open warning → 92; one open info → 98; mixed clamps at floor 0 (e.g. 5 open errors → 0, never negative). A CLOSED finding (accepted:true OR resolution:'dismissed') is EXCLUDED via isOpenFinding and does not lower the score. `flagCounts(rows)` returns `{info, warning, error}` counting only OPEN findings.
    - `bandFor(score)` → 'green' (≥80) / 'amber' (50-79) / 'red' (<50).
  </behavior>
  <action>
    Create lib/runMonitor/strengthScore.ts exporting:
    - `const PENALTY = { error: 25, warning: 8, info: 2 } as const`
    - `strengthScore(rows): number` — filter `rows.filter(isOpenFinding)`, `100 - Σ PENALTY[severity]`, `Math.max(0, ...)`.
    - `flagCounts(rows): { info: number; warning: number; error: number }` — over open findings only.
    - `bandFor(score): 'green'|'amber'|'red'` (green ≥80, amber ≥50, else red).
    Import `isOpenFinding` from `@/lib/galley/findingState`. Add the behavior tests.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- strengthScore</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "isOpenFinding" apps/dispatch-control/lib/runMonitor/strengthScore.ts` (reuses the canonical predicate — does NOT inline `accepted !== true`)
    - `grep -q "strengthScore" apps/dispatch-control/lib/runMonitor/strengthScore.ts` AND `grep -q "flagCounts" strengthScore.ts` AND `grep -q "bandFor" strengthScore.ts`
    - `pnpm --filter dispatch-control test:unit -- strengthScore` exits 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: WriterExpansion — per-section strength bars + flag counts + per-section re-run (MON-03)</name>
  <read_first>
    - apps/dispatch-control/lib/runMonitor/strengthScore.ts (from Task 1)
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts (SECTION_WRITER_KEYS)
    - the Phase 33 rail's re-run call site (grep `rerun` under apps/dispatch-control for the existing pipeline-API fetch helper)
    - apps/dispatch-control/__tests__/WriterExpansion.test.tsx (NEW — Wave 0)
  </read_first>
  <behavior>
    - WriterExpansion.test.tsx: given qaCorrections rows keyed by sectionName, renders one row per section writer with (a) a strength bar whose width/label = strengthScore for that section's open findings and whose color band = bandFor, (b) flag counts info/warning/error, (c) a re-run button that POSTs to `/runs/{runId}/agents/{sectionName}/rerun`. A section with no findings shows 100/green. The re-run button is disabled while the run status is 'running' (mirrors the endpoint's 409 guard).
  </behavior>
  <action>
    Create WriterExpansion.tsx (Client Component). Props: `{ runId: string; runStatus?: string }`. Subscribe `useQuery(api.qaCorrections.byRunId, {runId})`. Group rows by `sectionName`. For each of the 6 writer section keys (`origin_story`, `problem`, `founder_bio`, `case_study`, `game`, `bonus` — the re-rollable set; `design` optional, only if present in SECTION_WRITER_KEYS/RE_ROLLABLE), render a row: section label, strength bar (`strengthScore` + `bandFor` color using 1c tokens), `flagCounts` chips, and a "Re-run" button calling the existing pipeline-API re-run helper `POST /runs/{runId}/agents/{sectionName}/rerun` (reuse the fetch/auth helper the Phase 33 rail uses — do NOT hand-roll a new client). Disable the button when `runStatus === 'running'`. Add the behavior tests.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- WriterExpansion</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "qaCorrections.byRunId\|qaCorrections\.byRunId" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/WriterExpansion.tsx`
    - `grep -q "strengthScore" WriterExpansion.tsx` AND `grep -q "rerun" WriterExpansion.tsx`
    - `pnpm --filter dispatch-control test:unit -- WriterExpansion` exits 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 3: DriftStrip (MON-04) + mount both into PipelineGraph</name>
  <read_first>
    - apps/dispatch-control/lib/costRollup.ts (parseCostJson)
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx (mount points; runId + workspace_id already resolved)
    - apps/dispatch-control/__tests__/DriftStrip.test.tsx (NEW — Wave 0)
  </read_first>
  <behavior>
    - DriftStrip.test.tsx: given a current run cost/duration and 8 trailing completed runs, renders an over/under indicator + % delta vs the trailing MEAN for BOTH cost and duration. With fewer than 8 prior runs it compares against the n that exist and labels the n (e.g. "vs last 3"). It reads cost via `parseCostJson(pipelineRuns.byRunId(runId).cost).total` and duration via `.durationMs` — NOT `runs.cost`.
  </behavior>
  <action>
    Create DriftStrip.tsx (Client Component). Props: `{ currentRunId: string; workspace_id: string }`. Subscribe `useQuery(api.runs.listForWorkspace, {workspace_id})`, filter to COMPLETED runs (status 'complete'/'awaiting-review' with completedAt set — exclude the current run), take the most recent 8 → `trailingRunIds`. Render one `<DriftBar runId=... />` child per trailing runId (Research Pattern 1 — stable hook count), each `useQuery(api.pipelineRuns.byRunId, {runId})` and exposing `{cost: parseCostJson(run?.cost).total, durationMs: run?.durationMs}` up to the parent (via a callback or a shared render-prop) so the parent computes the trailing mean; also a current-run `<DriftBar highlighted />`. Compute mean cost + mean duration over the trailing set, show current-vs-mean over/under with % delta and the trailing count label. Then in PipelineGraph.tsx: mount `<DriftStrip currentRunId={runId} workspace_id={workspace_id} />` in the run-summary area, and mount `<WriterExpansion runId={runId} runStatus={latestRun?.status} />` when the selected node is a section writer / the 7-writers group. Add the behavior tests.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- DriftStrip && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "parseCostJson" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/DriftStrip.tsx`
    - `grep -q "pipelineRuns.byRunId\|pipelineRuns\.byRunId" DriftStrip.tsx` AND DriftStrip.tsx does NOT read `runs.cost` (`grep -c "runs.cost" DriftStrip.tsx` returns 0)
    - `grep -q "DriftStrip" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx` AND `grep -q "WriterExpansion" PipelineGraph.tsx`
    - `pnpm --filter dispatch-control test:unit -- DriftStrip` exits 0
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit` green (strengthScore + WriterExpansion + DriftStrip)
- `pnpm --filter dispatch-control build` exits 0
- Manual: expand the 7-writers node — per-section strength bars + flag counts + re-run; the drift strip shows current vs last-8 for cost + duration
</verification>

<success_criteria>
- 7-writers expands to per-section strength bars (deterministic, open-findings only) + flag counts + individual re-run (MON-03)
- Drift strip compares current vs trailing-8 completed runs for cost + duration, reading pipelineRuns (not the dead runs.cost fields), n<8 labelled (MON-04)
- Both components mounted into the spine; build exits 0
</success_criteria>

<output>
After completion, create `.planning/phases/37-run-monitor-v2-signal-desk/37-04-SUMMARY.md`
</output>
