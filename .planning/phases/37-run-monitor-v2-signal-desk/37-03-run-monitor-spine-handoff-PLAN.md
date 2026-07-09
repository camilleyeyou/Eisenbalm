---
phase: 37-run-monitor-v2-signal-desk
plan: 03
type: execute
wave: 2
depends_on: ["37-01"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts
  - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx
  - apps/dispatch-control/__tests__/pipelineTopology.test.ts
  - apps/dispatch-control/__tests__/AgentNode.test.tsx
  - apps/dispatch-control/__tests__/AgentIOPanel.test.tsx
autonomous: true
requirements: [MON-01, MON-02]
must_haves:
  truths:
    - "A run renders as a vertical forensic spine — LLM agents as dots, verify_research/validate_sections as marigold diamonds"
    - "Each node shows cost, latency, model chip, and retry count"
    - "Clicking a node shows the upstream→node→downstream handoff human-readably first, with raw JSON behind a toggle"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts"
      provides: "GATE_KEYS set distinguishing the two code gates"
      contains: "GATE_KEYS"
    - path: "apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx"
      provides: "dot vs diamond rendering + retryCount + model chip"
      contains: "retryCount"
    - path: "apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx"
      provides: "upstream→node→downstream handoff + raw-JSON toggle"
      contains: "toggle"
  key_links:
    - from: "AgentNode.tsx"
      to: "pipelineTopology.ts GATE_KEYS"
      via: "isGate lookup drives diamond vs dot"
      pattern: "GATE_KEYS"
    - from: "AgentIOPanel.tsx"
      to: "convex agentRuns.payloadByRunIdAgentKey"
      via: "handoff reads upstream/current/downstream snapshots"
      pattern: "payloadByRunIdAgentKey"
---

<objective>
Rebuild the v1 `run-monitor/graph` view IN PLACE (same route, D-01) into the vertical forensic spine (MON-01) and extend the inspector into a handoff view (MON-02). The dagre TB layout is already vertical — this is a data/visual/chrome upgrade, not a layout rewrite.

- MON-01: agents = dots, the two real code gates (`verify_research`, `validate_sections`) = marigold diamonds; each node chips cost (`costUsd`), latency (`durationMs`), model (`agents.model` config-at-rest, Research Pitfall 7), and `retryCount` (from 37-01).
- MON-02: the inspector shows the handoff — upstream node's output → this node's input/output → downstream node's input — human-readable first, raw JSON behind a toggle (reuse `agent_run_payloads`, ~2000-char truncation noted in UI).

Purpose: make the pipeline's checks-and-balances legible on one forensic spine.
Output: extended topology + node + graph + inspector, RED-first via Wave-0 tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/37-run-monitor-v2-signal-desk/37-CONTEXT.md
@.planning/phases/37-run-monitor-v2-signal-desk/37-RESEARCH.md
@docs/design/dispatch-control-v2/README.md

<interfaces>
<!-- Executor: exact v1 shapes to extend. Do NOT restructure. Design brief describes 3 gates; ONLY 2 exist — see below. -->

pipelineTopology.ts: exports `PIPELINE_NODES: string[]` (18 keys incl. `verify_research`, `validate_sections`), `SECTION_WRITER_KEYS`, `PIPELINE_EDGES: [string,string][]`. The vertical order + edges already match builder.py.

AgentNode.tsx: `AgentNodeData = {agentKey, displayName, model?, enabled, description?, status?, costUsd?, durationMs?}`. Registered as React Flow node type `agent`. Uses dagre TB (top-to-bottom) via useGraphLayout.ts (unchanged).

PipelineGraph.tsx wiring (~L63-73): `agents = useQuery(api.agents.listForWorkspace, {workspace_id})` (config-at-rest incl. `.model`); `latestRun = useQuery(api.runs.latest, {workspace_id})`; `agentRuns = useQuery(api.agentRuns.byRunId, runId ? {runId} : 'skip')`. Builds `AgentNodeData` from `config?.model`, `run?.status/costUsd/durationMs`. Merge `run?.retryCount` here (now on the agent_runs row from 37-01).

AgentIOPanel.tsx: `useQuery(api.agentRuns.payloadByRunIdAgentKey, {runId, agentKey})` → `{inputSnapshot, outputSnapshot}` (JSON strings, truncated ~2000 chars). Currently renders only the clicked node's own I/O in `<pre>`. `prettyJson()` helper already present.

Design tokens (docs/design README §Design tokens): marigold `#f2b01e` (code gates), ink `#17140e`, cobalt `#253ad4` (selection). SCOPE CORRECTION (Research Pitfall 8): the design brief's "3 code-gate diamonds (Verify Candidates, Verify Research, Validate Sections)" is STALE — "Verify Candidates" does not exist in builder.py. Only render TWO diamonds: `verify_research`, `validate_sections`.
</interfaces>
</context>

<sequencing_note>
Waves run SEQUENTIALLY in the main checkout — NO worktrees. This is Wave 2 (depends on 37-01 for the retryCount field). It owns PipelineGraph.tsx; the strength/drift plan (37-04, Wave 3) wires into this same file AFTER this lands.
</sequencing_note>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add GATE_KEYS + dot/diamond/chip rendering to topology + node</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx
    - apps/dispatch-control/__tests__/pipelineTopology.test.ts
    - apps/dispatch-control/__tests__/AgentNode.test.tsx
  </read_first>
  <behavior>
    - pipelineTopology.test.ts: `GATE_KEYS` contains exactly `verify_research` and `validate_sections`; every member of GATE_KEYS is also in `PIPELINE_NODES`; `GATE_KEYS.size === 2`.
    - AgentNode.test.tsx: a node whose agentKey ∈ GATE_KEYS renders the diamond variant (data-testid `agent-node-diamond` or class marker) and marigold token; a non-gate node renders the dot variant. A node with `retryCount > 0` renders the retry chip showing the count; `retryCount == 0`/undefined renders no retry chip. A node with `model` renders the model chip.
    - AgentNode.test.tsx (MON-01 "all chips together"): an EXECUTED node with `{status: 'done', costUsd: 0.12, durationMs: 3400, retryCount: 2, model: 'anthropic/claude-x'}` renders the model chip AND the cost/duration line AND the retry chip SIMULTANEOUSLY (all four present in one render) — the model chip must NOT be mutually exclusive with the cost/duration line.
  </behavior>
  <action>
    1. pipelineTopology.ts: export `export const GATE_KEYS = new Set<string>(['verify_research', 'validate_sections'])` with a comment: the two real code gates (builder.py); design brief's 3rd gate is stale.
    2. AgentNode.tsx: extend `AgentNodeData` with `retryCount?: number` and `isGate?: boolean`. Render the diamond variant (rotated square / distinct shape) with the marigold token `#f2b01e` when `isGate`, else the dot/box variant. Add a model chip (renders `model`, label it config-at-rest per Pitfall 7) and a retry chip (`retryCount` badge, only when `> 0`). Keep the existing cost/duration line. **MON-01 fix (plan-review warning 1): the model chip currently renders ONLY in the at-rest (`!nodeData.status`) branch — move/duplicate it so it renders UNCONDITIONALLY (or in the same block as cost/duration), so an executed node with `status: 'done'` shows model + cost + latency + retry TOGETHER. They must not be mutually exclusive.** Preserve the existing `selected` ring + handles.
    3. Add both behavior test blocks.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- pipelineTopology AgentNode</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "GATE_KEYS" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts`
    - `grep -q "verify_research" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts` AND `grep -q "validate_sections"` in the same file's GATE_KEYS
    - `grep -q "retryCount" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx` AND `grep -q "isGate" AgentNode.tsx`
    - `grep -q "f2b01e" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx` (marigold diamond)
    - The file does NOT introduce a third gate: `grep -c "Verify Candidates" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/*.ts*` returns 0
    - `pnpm --filter dispatch-control test:unit -- pipelineTopology AgentNode` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Wire retryCount + model + isGate into PipelineGraph spine</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx (~L80-127 node build)
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts (GATE_KEYS from Task 1)
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx (AgentNodeData from Task 1)
  </read_first>
  <action>
    In PipelineGraph.tsx node-build `useMemo`: set `data.retryCount = run?.retryCount ?? undefined` (the field now exists on the agent_runs row from 37-01) and `data.isGate = GATE_KEYS.has(agentKey)`; keep `data.model = config?.model` (config-at-rest source, Pitfall 7). Import `GATE_KEYS` from pipelineTopology. No layout change (dagre TB stays). Keep the AgentIOPanel mount. Confirm the whole graph page still type-checks and builds.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "retryCount" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx`
    - `grep -q "GATE_KEYS" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx` AND `grep -q "isGate" PipelineGraph.tsx`
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Extend AgentIOPanel into the upstream→node→downstream handoff inspector (MON-02)</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts (PIPELINE_EDGES — to resolve upstream/downstream)
    - apps/dispatch-control/__tests__/AgentIOPanel.test.tsx (NEW — Wave 0)
  </read_first>
  <behavior>
    - AgentIOPanel.test.tsx: given a selected agentKey, the panel renders three labelled handoff regions — upstream output, this node input+output, downstream input — resolving upstream/downstream from PIPELINE_EDGES. It renders a human-readable summary by default and reveals the raw JSON `<pre>` only after the toggle is activated. It shows the ~2000-char truncation note. For a node with no upstream (calibrator) or multiple downstream (verify_research fan-out) it degrades gracefully (renders what exists, no crash).
  </behavior>
  <action>
    Extend AgentIOPanel.tsx (keep the existing metrics/error blocks and the on-demand `payloadByRunIdAgentKey` query for the clicked node):
    1. Derive `upstreamKeys` = sources where `PIPELINE_EDGES[i][1] === agentKey`; `downstreamKeys` = targets where `PIPELINE_EDGES[i][0] === agentKey`. Fetch their payloads (per-key `payloadByRunIdAgentKey` — render a small child component per key so hook count is stable, OR fetch the first upstream/downstream for the summary).
    2. Render three regions: "From (upstream output)", "This node (input → output)", "To (downstream input)". Human-readable summary first (e.g. formatted key highlights / a compact render), with a "Show raw JSON" toggle (`useState`) that reveals the existing `<pre>{prettyJson(...)}</pre>`.
    3. Add the truncation note ("snapshots truncated ~2000 chars").
    Add the behavior test file.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- AgentIOPanel</automated>
  </verify>
  <acceptance_criteria>
    - `grep -qi "upstream" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx` AND `grep -qi "downstream" AgentIOPanel.tsx`
    - `grep -qi "toggle\|Show raw\|useState" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx`
    - `grep -q "PIPELINE_EDGES" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx`
    - `pnpm --filter dispatch-control test:unit -- AgentIOPanel` exits 0
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit` green (topology + node + IO panel)
- `pnpm --filter dispatch-control build` exits 0 (vitest does NOT type-check — build is the strict gate)
- Manual: open run-monitor/graph for a real run — agents=dots, the two gates=marigold diamonds, per-node cost/latency/model/retry chips, node click shows upstream→node→downstream handoff with a JSON toggle
</verification>

<success_criteria>
- Vertical forensic spine renders dots + two marigold diamonds with cost/latency/model/retryCount chips (MON-01)
- Inspector shows the handoff human-readable first, raw JSON behind a toggle, truncation noted (MON-02)
- No third/phantom gate introduced; build exits 0
</success_criteria>

<output>
After completion, create `.planning/phases/37-run-monitor-v2-signal-desk/37-03-SUMMARY.md`
</output>
