# Phase 23: Node Wrappers + Read-Only Dashboard — Research

**Researched:** 2026-06-21
**Domain:** LangGraph node instrumentation · Convex live subscriptions · React Flow DAG visualization · audit-log infrastructure
**Confidence:** HIGH — all findings grounded in the actual codebase (builder.py, cost.py, schema.ts, convex/*.ts verified by direct read); graph library versions verified against npm registry; no training-data assumptions.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Real visual DAG using React Flow / `@xyflow` (default candidate — researcher confirms exact library + auto-layout). Faithfully shows the sequential spine AND the 7-writer parallel fan-out.
- **D-02:** Live status paints directly onto the nodes — color by state (queued/running/done/failed), spinner on active, cost + duration inline on each node. Updates live via Convex subscription, no page refresh. Parallel fan-out shows multiple running nodes simultaneously.
- **D-03:** Nodes show config summary at rest — agent name, current model, enabled flag, description from the `agents` table. Disabled/suppressed agents rendered visually dimmed.
- **D-04:** Clicking a node opens the per-agent input/output + error/retry + cost panel (OBS-05). The graph is the primary entry point to run inspection.

### Claude's Discretion

- Per-agent I/O storage depth and shape (OBS-05): full-raw vs truncated, field on `agent_runs` vs separate table, what constitutes "input/output."
- Live-run presentation beyond the graph and cost roll-up display format; where aggregation happens (OBS-03/04).
- Audit-log scope this phase (AUD-01): build infrastructure only (write helper + viewer); actual config/review/kill-switch emissions land in Phases 24/25/26.
- `wrap_agent_node()` internals: failure/retry semantics, which nodes emit (agent nodes vs `validate_sections` join node).
- Graph library exact version, auto-layout algorithm (dagre/elk/built-in), responsive behavior, empty/no-runs state, node icons, panel layout.

### Deferred Ideas (OUT OF SCOPE)

- Any dashboard write/control action — trigger, cancel, edit, review (Phases 24–26).
- Prompt editing / versioning / diff / rollback UI (Phase 24).
- Run control / scheduler / kill switch / re-roll / budget caps (Phase 25).
- Review gate / charity registry behavior (Phase 26).
- Stripe reconciliation / notifications (Phase 27).
- Full "graph-as-data" (editable edges from DB) — Phase 28 / productization.
- Audit-log emissions for config/prompt/review/kill-switch actions — land in owning phases.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OBS-01 | Operator can view the pipeline as the real agent graph — each agent a node showing its current config (model, enabled, description). | `agents` table already has `model`, `enabled`, `description` fields (schema.ts:252–263); `agents:listForWorkspace` query exists (agents.ts:47–55); React Flow renders static graph at rest. |
| OBS-02 | Operator can view full run history (status, trigger source, who triggered, duration, cost) and open any run. | `runs` table has all required fields (schema.ts:220–233); `runs:byRunId` query exists (runs.ts:63–71); list query needed over `by_workspace` index. |
| OBS-03 | Operator can watch a run live — each agent transitions queued→running→done/failed with live token/cost accrual + latency — via Convex subscriptions. | `agent_runs` table exists (schema.ts:291–302) but has no mutations yet; `wrap_agent_node()` emits to `agent_runs` mutations; Convex `useQuery` on `by_runId` delivers live updates. |
| OBS-04 | Operator can see cost rolled up per agent → per run → per issue → per week/month, reading already-captured cost. No second recorder. | `pipelineRuns.cost` is a JSON string (schema.ts:20) with shape `{total, agents: {key: {tokens_in, tokens_out, usd, duration_ms}}}` (cost.py:112–133); `runs.cost` mirrors it; no new recorder. |
| OBS-05 | Operator can inspect per-agent input/output and any error/retry for a run. | `agent_runs` has no payload field yet; decision needed on storage strategy; node-click is the access pattern. |
| AUD-01 | Every config/prompt change, review decision, and kill-switch flip is recorded in an audit log. | `audit_log` table exists (schema.ts:236–247); this phase builds the write helper and read-only viewer; actual emissions in Phases 24–26. |

</phase_requirements>

---

## Summary

Phase 23 has three interlocking deliverables: (1) a Python wrapper function that instruments all 14 LangGraph agent nodes to emit lifecycle events to Convex, (2) Convex mutations/queries for `agent_runs` and `audit_log`, and (3) four read-only dashboard views in `apps/dispatch-control` (Graph, Runs history/detail, live run, cost roll-up). The auth shell, Convex schema stubs, and sidebar navigation are all already in place from Phases 21–22; this phase fills the placeholders.

The biggest open decision is per-agent I/O storage for OBS-05. Research strongly recommends a separate `agent_run_payloads` table (not inline on `agent_runs`) to keep live-subscription documents small. The wrapper should capture a relevant slice of DispatchState — specifically the fields the node consumes and the fields it writes — rather than the full 30+ field state object (which includes multi-KB research blobs).

For the graph view, `@xyflow/react 12.11.0` with `@dagrejs/dagre 3.0.0` for auto-layout is the recommended approach. Both are React 19 compatible, dagre is not bundled with React Flow and must be installed separately, and the auto-layout pattern is well-documented. ELK is more powerful but adds 3MB to the bundle and requires an async worker; dagre produces clean left-to-right trees and hierarchical layouts in ~10ms synchronously.

**Primary recommendation:** Use `@xyflow/react` + dagre for the DAG; store I/O payloads in a separate `agent_run_payloads` table (queried on node click, not subscribed); aggregate cost on the frontend from `runs.cost` JSON; build `auditLog:write` as a Convex internal function callable from other mutations.

---

## Standard Stack

### Core (Phase 23 additions only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@xyflow/react` | `12.11.0` | React Flow — interactive node/edge DAG canvas | React 19 compatible (peer: `react >=17`); industry standard for DAG/flowchart UIs; 25K+ GitHub stars; handles zooming, panning, custom node renders natively |
| `@dagrejs/dagre` | `3.0.0` | Directed-graph auto-layout (assign x/y to nodes) | Synchronous, 0 extra dependencies, produces clean LR/TB layouts; community-standard pairing with React Flow; ELK is overkill for a static 14-node graph |

### Reused (no reinstall needed)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `convex` | `^1.38.0` | `useQuery` subscriptions, mutations | Already in `dispatch-control/package.json` |
| `lucide-react` | `^1.14.0` | Node icons (already imported in sidebar) | Already in `dispatch-control/package.json` |
| `@clerk/nextjs` | `^7.5.7` | Auth — all routes already protected | Already in `dispatch-control/package.json` |
| `next` + `react` | `15.3.9` / `19.2.6` | App Router, Client Components | Already in `dispatch-control/package.json` |
| `tailwindcss` | `^4.3.0` | Styling | Already in `dispatch-control/package.json` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@dagrejs/dagre` | `elkjs ^0.11.1` | ELK is more accurate for complex graphs but is ~3MB + requires a Web Worker for async layout; overkill for a static 14-node graph; adds async complexity to node positioning |
| `@xyflow/react` | Plain SVG + CSS grid | Custom SVG saves the library dependency (~1.2MB) but reproduces React Flow's zooming, panning, edge-routing, and node-click surface from scratch; not worth it for a 14-node graph |
| Separate `agent_run_payloads` table | Inline `inputSnapshot`/`outputSnapshot` fields on `agent_runs` | Inline works but bloats every live-subscription document; the subscription for a run's progress would carry payload blobs that are only needed on node-click; separate table keeps subscriptions lightweight |

### Installation

```bash
pnpm --filter dispatch-control add @xyflow/react @dagrejs/dagre
pnpm --filter dispatch-control add -D @types/dagre
```

### Version verification

Verified against npm registry 2026-06-21:
- `@xyflow/react`: latest `12.11.0` (dist-tags.latest)
- `@dagrejs/dagre`: latest `3.0.0`
- `@types/dagre` may not be needed (dagre 3.0.0 ships its own types — verify at install time)

---

## Architecture Patterns

### Recommended Project Structure (additions in Phase 23)

```
convex/
├── agentRuns.ts           # NEW — mutations: started, completed, failed, queued; queries: byRunId, byRunId_live
├── auditLog.ts            # NEW — internal mutation: write; query: listForWorkspace
convex/schema.ts           # MODIFIED — add inputSnapshot/outputSnapshot to agent_runs? Or new agent_run_payloads table

packages/pipeline/src/eisenbalm_pipeline/
├── lib/
│   └── agent_wrapper.py   # NEW — wrap_agent_node(agent_key, fn) → fn

apps/dispatch-control/app/(dashboard)/
├── graph/
│   ├── page.tsx           # REPLACE placeholder — PipelineGraphView
│   └── _components/
│       ├── PipelineGraph.tsx          # React Flow canvas + node definitions
│       ├── AgentNode.tsx              # Custom node: config summary at rest / live status
│       ├── AgentIOPanel.tsx           # Slide-over panel on node click (OBS-05)
│       └── useGraphLayout.ts          # dagre layout hook
├── runs/
│   ├── page.tsx           # REPLACE placeholder — run history table
│   ├── [runId]/
│   │   └── page.tsx       # Run detail — per-agent status list + live view + cost
│   └── _components/
│       ├── RunsTable.tsx
│       └── AgentRunRow.tsx
└── (cost roll-up can live on runs/[runId]/page.tsx or a cost tab — see Claude's Discretion below)
```

### Pattern 1: `wrap_agent_node()` — Node Wrapper

**What:** A higher-order function wrapping a LangGraph node function to emit lifecycle events to Convex before/after execution. Applied in `builder.py` at the `add_node` call site.

**Exact interface from architecture research:**

```python
# packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py
import time
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.cost import get_cost_payload
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe

def wrap_agent_node(agent_key: str, fn) -> callable:
    """
    Wraps a LangGraph node fn to emit agent_runs lifecycle events to Convex.
    Reads cost from lib/cost.py AFTER fn() returns (no second record_cost() call).
    Failure semantics: catch Exception → emit 'failed' with error str → re-raise.
    """
    async def wrapped(state: DispatchState) -> dict:
        run_id = state["run_id"]
        workspace_id = state.get("workspace_id", "eisenbalm")

        await convex_mutation_safe("agentRuns:started", {
            "workspace_id": workspace_id,
            "runId": run_id,
            "agentKey": agent_key,
            "startedAt": int(time.time() * 1000),
        })
        try:
            result = await fn(state)
            # Read cost AFTER fn() returns — cost.py has already accumulated it
            cost_payload = get_cost_payload(run_id)
            agent_cost = cost_payload["agents"].get(agent_key, {})
            await convex_mutation_safe("agentRuns:completed", {
                "workspace_id": workspace_id,
                "runId": run_id,
                "agentKey": agent_key,
                "completedAt": int(time.time() * 1000),
                "costUsd": agent_cost.get("usd", 0.0),
                "durationMs": agent_cost.get("duration_ms", 0),
                "tokensIn": agent_cost.get("tokens_in", 0),
                "tokensOut": agent_cost.get("tokens_out", 0),
            })
            return result
        except Exception as e:
            await convex_mutation_safe("agentRuns:failed", {
                "workspace_id": workspace_id,
                "runId": run_id,
                "agentKey": agent_key,
                "error": str(e),
            })
            raise  # Re-raise — LangGraph failure semantics unchanged
    return wrapped
```

**Applied in builder.py:** Replace `builder.add_node("scout", scout)` with `builder.add_node("scout", wrap_agent_node("scout", scout))`. Repeat for all agent nodes.

**Which nodes get wrapped:** All named LangGraph agent nodes that do real work — the 14 listed in `SECTION_WRITERS` plus `calibrator`, `scout`, `advocate`, `editor_gate_1`, `chronicler`, `researcher`, `verify_research`, `qa`, `editor_final`, `publisher`. The non-LLM join node `validate_sections` is Claude's discretion — it performs no LLM call so has no cost to report; wrapping it provides status visibility (useful for debugging fan-in timing) with negligible overhead. Recommendation: wrap it, emit `started`/`completed` but expect `costUsd: 0`.

**CRITICAL — no second `record_cost()` call:** `get_cost_payload(run_id)` reads the already-accumulated in-memory state from `cost.py._store`. It does NOT call `record_cost()`. This is a read-only operation. The existing `acomplete()` → `record_cost()` path remains the sole writer. (See Pitfall 1 below.)

### Pattern 2: `agent_runs` Convex Mutations (new file: `convex/agentRuns.ts`)

The `agent_runs` schema stub exists in `convex/schema.ts` (lines 291–302). It currently has fields: `workspace_id`, `runId`, `agentKey`, `status`, `startedAt?`, `completedAt?`, `costUsd?`, `durationMs?`. There is NO `tokensIn`/`tokensOut` field on the stub — the schema must be extended.

**Schema extension needed:**
```typescript
// convex/schema.ts — agent_runs additions (extend existing stub)
agent_runs: defineTable({
  workspace_id: v.string(),
  runId: v.string(),
  agentKey: v.string(),
  status: v.string(),              // "queued" | "running" | "done" | "failed"
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  costUsd: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  tokensIn: v.optional(v.number()),    // ADD
  tokensOut: v.optional(v.number()),   // ADD
  error: v.optional(v.string()),       // ADD — error message on failure
})
  .index('by_workspace', ['workspace_id'])
  .index('by_runId', ['runId']),       // already exists — use for live subscription
```

**Mutations needed:**

```typescript
// convex/agentRuns.ts (new file)
import { internalMutation, query } from './_generated/server'
import { v } from 'convex/values'

// Called by wrap_agent_node before fn() runs
export const started = internalMutation({ ... })

// Called by wrap_agent_node after fn() returns
export const completed = internalMutation({ ... })

// Called by wrap_agent_node on exception
export const failed = internalMutation({ ... })

// Upsert-on-create: queue all agent_runs rows at run start (status: "queued")
// so the graph view shows all nodes before they execute
export const queueForRun = internalMutation({ ... })

// Live subscription query — used by dashboard graph/runs views
export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return ctx.db.query('agent_runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()
  }
})
```

**Note on `internalMutation` vs `mutation`:** The pipeline calls these via HTTP using the deploy key (`Authorization: Convex {key}`) — this works with both `mutation` and `internalMutation`. Since only the pipeline (not the browser) calls `started`/`completed`/`failed`, using `internalMutation` is the correct Convex pattern. The `byRunId` query is public (called from `useQuery` in the dashboard).

### Pattern 3: React Flow DAG with Dagre Layout

**Static graph definition** (the 14-node topology is fixed for this phase — not read from DB):

```typescript
// apps/dispatch-control/app/(dashboard)/graph/_components/useGraphLayout.ts
import dagre from '@dagrejs/dagre'
import { Node, Edge } from '@xyflow/react'

const PIPELINE_NODES = [
  'calibrator', 'scout', 'advocate', 'editor_gate_1', 'chronicler',
  'researcher', 'verify_research',
  'origin_story', 'problem', 'founder_bio', 'case_study', 'game', 'bonus', 'design',
  'validate_sections', 'qa', 'editor_final', 'publisher',
]

// Edges encode the sequential spine + 7-way fan-out + fan-in
// The DESIGNAGENT_SUPPRESSED flag: read from agents table (enabled field)
// and dim the 'design' node rather than removing it from the graph

export function computeLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })
  // ... assign sizes + run layout
  return { nodes: layoutedNodes, edges }
}
```

**`AgentNode` custom node component** (key to D-02 and D-03):

```typescript
// AgentNode renders differently depending on mode:
// - At rest (no active run): shows name + model + enabled indicator + description truncated
// - During a run: color-coded border (queued=gray, running=blue+spinner, done=green, failed=red)
//                 inline cost (e.g. "$0.042") and duration (e.g. "12.3s") below the name
// - DESIGNAGENT_SUPPRESSED: same node position but 40% opacity, "suppressed" badge
```

**Live subscription:** The graph view calls `useQuery(api.agentRuns.byRunId, { runId: activeRunId })` to get all per-agent statuses for the current run. `activeRunId` comes from `useQuery(api.runs.latest, { workspace_id })` — a new query that returns the most recent run. When no run is active, the graph shows the static config view (D-03).

### Pattern 4: Per-Agent I/O Storage (Claude's Discretion — OBS-05)

**Decision: separate `agent_run_payloads` table (NOT inline on `agent_runs`)**

**Rationale:** The `agent_runs` table is subscribed live (Convex `useQuery` on `by_runId` returns all rows). If input/output snapshots were inline fields, every Convex update (every `started`/`completed` event) would re-transmit the full payload blobs to all subscribers. The Researcher agent alone produces ~5–15KB of research text. With 14 agents and a live dashboard, this creates unnecessary subscription bandwidth.

**Schema addition:**
```typescript
// convex/schema.ts — new table
agent_run_payloads: defineTable({
  workspace_id: v.string(),
  runId: v.string(),
  agentKey: v.string(),
  inputSnapshot: v.optional(v.string()),   // JSON — relevant input slice
  outputSnapshot: v.optional(v.string()),  // JSON — fields this node wrote to state
})
  .index('by_runId_agentKey', ['runId', 'agentKey']),
```

**What constitutes "input/output":** The full `DispatchState` is 30+ fields; agents only read and write a few. The wrapper should capture the relevant slice:

| Agent type | Input snapshot | Output snapshot |
|-----------|----------------|-----------------|
| Scout | `{style_brief, run_id}` | `{candidates: [...]}` (first 3, truncated to 500 chars each) |
| Calibrator | `{run_id}` | `{style_brief}` |
| Advocate | `{candidates}` | `{candidates}` (with advocateScore) |
| Editor Gate 1 | `{candidates}` | `{winning_charity, editor_decision}` |
| Researcher | `{winning_charity}` | `{research}` (truncated to 2KB) |
| Section writers | `{research, winning_charity, style_brief}` | `{origin_story}` / `{problem_statement}` / etc. (truncated to 2KB) |
| QA | `{origin_story, ...all sections}` | `{qa_corrections}` |

**Truncation strategy:** Inline text truncated to 2000 chars with `"...[truncated]"` suffix. Full text is in Sanity (for published content) or LangGraph checkpoint (for replay). The I/O panel is for operator spot-checking, not full reproduction.

**Write timing:** `agent_run_payloads` is written in the wrapper immediately after `fn()` returns, alongside `agentRuns:completed`. Since this is a separate table and not the live subscription, a write failure is non-fatal (log + continue).

**Note on Phase 22 `state["workspace_id"]`:** The `DispatchState` schema must have `workspace_id` available so the wrapper can include it in all Convex mutations. Check if Phase 22 added it — if not, the wrapper falls back to `"eisenbalm"` (the constant from `lib/workspace.ts`).

### Pattern 5: Cost Roll-Up (OBS-04)

**Per-agent cost** is already in `pipelineRuns.cost` as a JSON string with shape:
```json
{
  "total": 0.082,
  "agents": {
    "calibrator": {"tokens_in": 1200, "tokens_out": 340, "usd": 0.003, "duration_ms": 1200},
    "scout": {"tokens_in": 8200, "tokens_out": 2100, "usd": 0.021, "duration_ms": 8400},
    ...
  }
}
```
This is verified from `cost.py:112–133` (get_cost_payload shape).

**Roll-up approach:** Aggregate on the frontend from `runs` table data. No separate Convex aggregation function needed for this phase.

- **Per agent within a run:** parse `runs.cost` JSON → `agents[key].usd`
- **Per run:** `runs.cost.total`
- **Per issue:** same as per run (one run = one issue)
- **Per week/month:** query `runs` by `by_workspace` index → filter by `startedAt` range → sum `cost.total` on the frontend

This avoids a Convex aggregation query which would require reading all run documents. For the current scale (52 runs/year), frontend aggregation is trivially fast.

**Live cost accrual during a run (OBS-03):** The `agent_runs.costUsd` field accumulates per agent as the run progresses. The graph view shows the sum of all `agent_runs.costUsd` for the current run as the "live total" — the final authoritative number comes from `pipelineRuns.cost` at run end.

### Pattern 6: Audit Log Infrastructure (AUD-01)

The `audit_log` table exists (schema.ts:236–247). This phase builds:

1. **`auditLog:write` Convex internal mutation** — a single reusable function any other mutation can call:
   ```typescript
   // convex/auditLog.ts
   export const write = internalMutation({
     args: {
       workspace_id: v.string(),
       actorId: v.string(),        // Clerk userId from ctx.auth
       action: v.string(),         // e.g. "workspace.seeded", "run.created"
       resourceType: v.optional(v.string()),
       resourceId: v.optional(v.string()),
       before: v.optional(v.string()),  // JSON
       after: v.optional(v.string()),   // JSON
     },
     handler: async (ctx, args) => {
       await ctx.db.insert('audit_log', { ...args, timestamp: Date.now() })
     }
   })
   ```

2. **`auditLog:listForWorkspace` query** — for the read-only viewer:
   ```typescript
   export const listForWorkspace = query({
     args: { workspace_id: v.string(), limit: v.optional(v.number()) },
     handler: async (ctx, { workspace_id, limit }) => {
       return ctx.db.query('audit_log')
         .withIndex('by_workspace_timestamp', q => q.eq('workspace_id', workspace_id))
         .order('desc')
         .take(limit ?? 50)
     }
   })
   ```

3. **Read-only viewer** — a simple table component in the Settings or Config page showing `timestamp`, `actorId`, `action`, `resourceType`, `before`/`after` (collapsed JSON). No writes from the dashboard in Phase 23.

**This phase: seed one audit row** — when the graph page loads for the first time with a valid session, emit a `"dashboard.viewed"` event. This proves the infrastructure works before Phase 24 starts emitting real config changes.

### Anti-Patterns to Avoid

- **Do NOT call `record_cost()` in the wrapper.** `get_cost_payload()` is a read. `record_cost()` is a write. The wrapper calls `get_cost_payload()` only.
- **Do NOT add new `eventType` literals to `deliberationEvents`.** The `agent_runs` table is the dashboard's live-progress source. The `deliberationEvents` union is frozen (API_CONTRACTS.md §4.3; public deliberation layer reads it).
- **Do NOT modify `pipelineRuns` schema or function signatures.** The frozen contract: `create(runId, issueNumber, startedAt)`, `updateStatus(runId, status, ...)`. Do not add fields.
- **Do NOT inline large payloads in `agent_runs`.** Keep `agent_runs` light for live subscriptions; use `agent_run_payloads` for the I/O panel.
- **Do NOT hardcode `"eisenbalm"` in Convex mutations.** Always read `workspace_id` from the call argument or `state["workspace_id"]` in the wrapper.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DAG node positioning (x/y coordinates) | Manual coordinate calculation | `@dagrejs/dagre` layout algorithm | Dagre handles rank assignment, node separation, edge routing for arbitrary topologies; hand-rolled positioning breaks on dynamic DESIGNAGENT_SUPPRESSED changes |
| Zooming/panning/click handling on the graph canvas | Custom SVG + event listeners | `@xyflow/react` | React Flow handles all pointer events, touch support, zooming transforms, edge path rendering, and minimap; replacing it means thousands of lines for equivalent polish |
| Live-subscription delivery from Convex | WebSocket polling loop | `useQuery(api.agentRuns.byRunId, ...)` | Convex's built-in subscription invalidation is server-push; a polling loop adds latency and wastes compute |
| Cost accumulation during a run | New cost recorder | `get_cost_payload(run_id)` from `cost.py` | `acomplete()` already accumulates costs correctly; reading the in-memory store is the right pattern |

**Key insight:** The existing `cost.py` + `convex_mutation_safe` + `agent_runs` schema stub is 80% of the instrumentation work already done. Phase 23's main contribution is wiring them together.

---

## Runtime State Inventory

> Phase 23 is NOT a rename/refactor/migration phase. This section is omitted.

---

## Common Pitfalls

### Pitfall 1: Double-Counting Cost by Calling `record_cost()` in the Wrapper

**What goes wrong:** If `wrap_agent_node()` calls `record_cost()` in addition to the existing call inside `acomplete()`, every LLM call is counted twice. Budget caps fire at 50% of real threshold; donation math is wrong; OpenRouter dashboard shows $X but Convex shows $2X.

**Why it happens:** `cost.py:83–109` shows `record_cost()` is additive — calling it twice doubles the entry. The wrapper has access to cost data and it's tempting to add an instrumentation call.

**How to avoid:** The wrapper calls `get_cost_payload(run_id)` (a read from `cost.py._store`), never `record_cost()`. The cost path is: `acomplete()` → `record_cost()` (existing, unchanged) → `get_cost_payload()` (new read in wrapper after fn() returns).

**Warning signs:** `agent_runs.costUsd` for a single agent is 2× the OpenRouter reported cost for that agent's model on that run.

### Pitfall 2: `agent_runs` Live Subscription Carries Payload Blobs

**What goes wrong:** If `inputSnapshot`/`outputSnapshot` are added as inline fields to `agent_runs`, every `agentRuns:completed` mutation re-transmits multi-KB payloads to all Convex subscribers. With 14 agents in parallel, the Researcher's ~10KB research blob gets sent 7 times in rapid succession during the fan-out phase.

**How to avoid:** Use the separate `agent_run_payloads` table for I/O data. The live subscription on `agent_runs` carries only status/cost/timing fields (< 100 bytes per row).

**Warning signs:** Convex bandwidth spikes during pipeline runs; dashboard feels sluggish during the parallel phase-2 superstep.

### Pitfall 3: React Flow `ReactFlowProvider` Missing in Server Component Context

**What goes wrong:** `@xyflow/react` requires `ReactFlowProvider` in the component tree. If the graph page is a Next.js Server Component, `useNodes`/`useEdges` hooks fail. The `ReactFlow` component itself requires `'use client'`.

**How to avoid:** Keep the graph canvas as a Client Component (`'use client'`). The page route (`graph/page.tsx`) can be a Server Component that passes static agent config (fetched from Convex via server-side query) as props to the Client Component canvas. The live subscription (`useQuery`) runs in the Client Component.

**Warning signs:** `Error: useReactFlow() must be within a ReactFlowProvider` in production build.

### Pitfall 4: Dagre Produces Wrong Layout When `validate_sections` Fan-In Is Missing an Edge

**What goes wrong:** The fan-in for the 7 parallel writers converges at `validate_sections`. If the edge from `design` → `validate_sections` is missing (because `DESIGNAGENT_SUPPRESSED = true` and the node is conditionally absent from `builder.add_node()`), dagre may rank `validate_sections` at the wrong depth or produce a gap in the layout.

**How to avoid:** In Phase 23, the graph is a hardcoded static topology (not read from `graph/builder.py` at runtime — that's Phase 28 / graph-as-data). Hardcode the 14-node + edge set in the frontend with the `design` node always present but dimmed when `enabled=false` in the `agents` table. The graph is a visualization of the topology; DESIGNAGENT_SUPPRESSED dims the node, it does not remove it.

**Warning signs:** A gap between `verify_research` and `validate_sections` in the rendered graph when design is suppressed.

### Pitfall 5: `workspace_id` Missing from `wrap_agent_node` Convex Calls

**What goes wrong:** If `state["workspace_id"]` is not in `DispatchState` (Phase 22 may or may not have added it), the wrapper falls back to the hardcoded constant or omits it entirely — causing Convex to reject mutations with schema validator errors.

**How to avoid:** Check `graph/state.py` for `workspace_id` field. If absent, the wrapper reads it from the environment (`os.environ.get("WORKSPACE_ID", "eisenbalm")`). Document this as a known limitation to clean up in Phase 28.

### Pitfall 6: `validate_sections` Join Node Emitting Spurious Cost

**What goes wrong:** `validate_sections` is a non-LLM Python function. If it is wrapped and `get_cost_payload(run_id)` is called after it completes, the returned cost reflects the CUMULATIVE run cost for all agents that have run so far (since `get_cost_payload` returns the total for the run). The wrapper must read only the delta for the specific `agentKey`.

**How to avoid:** `get_cost_payload(run_id)["agents"].get(agent_key, {})` is keyed per agent. `validate_sections` has no entry in the `agents` dict (it never calls `acomplete()`), so `costUsd` will correctly be `0` for it.

---

## Code Examples

### Convex `agentRuns:started` mutation
```typescript
// convex/agentRuns.ts
import { internalMutation, query } from './_generated/server'
import { v } from 'convex/values'

export const started = internalMutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    agentKey: v.string(),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Upsert: the row may already exist as "queued" (if queueForRun was called at run start)
    const existing = await ctx.db
      .query('agent_runs')
      .withIndex('by_runId', q => q.eq('runId', args.runId))
      .filter(q => q.eq(q.field('agentKey'), args.agentKey))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { status: 'running', startedAt: args.startedAt })
    } else {
      await ctx.db.insert('agent_runs', { ...args, status: 'running' })
    }
  }
})
```

### React Flow AgentNode custom node (skeleton)
```typescript
// apps/dispatch-control/app/(dashboard)/graph/_components/AgentNode.tsx
'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type AgentNodeData = {
  agentKey: string
  displayName: string
  model?: string
  enabled: boolean
  description?: string
  // Live status (undefined when no run active):
  status?: 'queued' | 'running' | 'done' | 'failed'
  costUsd?: number
  durationMs?: number
}

export function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  const statusColors = {
    queued: 'border-neutral-300 bg-neutral-50',
    running: 'border-blue-400 bg-blue-50 animate-pulse',
    done: 'border-green-400 bg-green-50',
    failed: 'border-red-400 bg-red-50',
  }
  const borderClass = data.status
    ? statusColors[data.status]
    : data.enabled ? 'border-neutral-200 bg-white' : 'border-neutral-100 bg-neutral-50 opacity-40'

  return (
    <div className={cn('rounded-lg border-2 p-3 w-44 cursor-pointer', borderClass,
      selected && 'ring-2 ring-neutral-900 ring-offset-1')}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1.5">
        {data.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
        <span className="text-xs font-semibold text-neutral-800 truncate">{data.displayName}</span>
      </div>
      {/* At rest: show config */}
      {!data.status && (
        <p className="mt-1 text-[10px] text-neutral-400 truncate">{data.model}</p>
      )}
      {/* During run: show cost + duration */}
      {data.status && data.status !== 'queued' && (
        <p className="mt-1 text-[10px] text-neutral-600">
          {data.costUsd != null ? `$${data.costUsd.toFixed(4)}` : '—'}
          {data.durationMs != null ? ` · ${(data.durationMs / 1000).toFixed(1)}s` : ''}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
```

### `wrap_agent_node` registration in builder.py
```python
# graph/builder.py — patch to apply wrapper
from eisenbalm_pipeline.lib.agent_wrapper import wrap_agent_node

# Before:
# builder.add_node("scout", scout)
# After:
builder.add_node("scout", wrap_agent_node("scout", scout))
builder.add_node("calibrator", wrap_agent_node("calibrator", calibrator))
# ... repeat for all 14–15 nodes
builder.add_node("validate_sections", wrap_agent_node("validate_sections", validate_sections))
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LangGraph callbacks (`BaseCallbackHandler`) | Node-level wrapper functions | React Flow / LangGraph ecosystem guidance, 2024+ | Callbacks are designed for LangChain chains, not LangGraph nodes; wrappers are more explicit and don't depend on LangGraph internal dispatch |
| `reactflow` (v11) package name | `@xyflow/react` | January 2024 (v12 rebrand) | Package must be `@xyflow/react`, not `reactflow` — `reactflow` is now a compatibility alias but the primary package name has changed |
| Dagre (`dagre` package, deprecated) | `@dagrejs/dagre` (scoped, maintained fork) | 2023 | `dagre` on npm is abandoned; `@dagrejs/dagre` is the maintained scoped fork under the `dagrejs` organization |

**Deprecated/outdated:**
- `reactflow`: Use `@xyflow/react` instead. The `reactflow` package is a redirect alias; new projects should use the scoped name.
- `dagre` (unscoped): Use `@dagrejs/dagre ^3.0.0` instead. The unscoped package is no longer maintained.

---

## Open Questions

1. **Does `DispatchState` have a `workspace_id` field after Phase 22?**
   - What we know: Phase 22 added `config: Optional[RunConfig]` to state; `workspace_id` is not confirmed present.
   - What's unclear: If absent, the wrapper must read it from env instead of state.
   - Recommendation: Read `graph/state.py` at plan time; if absent, add `workspace_id: Optional[str]` as a new state field (set at run start in `api/runs.py`).

2. **Should `queueForRun` pre-populate all `agent_runs` rows as "queued" at run start?**
   - What we know: Pre-populating lets the graph view show all nodes immediately in grey "queued" state before execution starts, making D-02 cleaner.
   - What's unclear: Whether the complexity of a 14-row insert at run start is worth the UX benefit.
   - Recommendation: Yes — pre-populate at run start (in `api/runs.py` alongside `pipelineRuns:create` and `runs:create`). Call `agentRuns:queueForRun` with the full node list. This makes the graph immediately show the pipeline shape when a run starts rather than nodes appearing one-by-one.

3. **Which page hosts the cost roll-up view (OBS-04)?**
   - What we know: `finance/page.tsx` is Phase 27 (Stripe reconciliation); `runs/[runId]/page.tsx` can show per-run cost breakdown; the nav has no separate "cost" item.
   - What's unclear: Whether per-week/month aggregation belongs on the Runs list page or a dedicated tab.
   - Recommendation: Per-run cost on the run detail page; weekly/monthly aggregation as a collapsible section at the top of the Runs list page. No new nav item needed in Phase 23.

4. **Does `convex_mutation_safe` need `workspace_id` passed separately or can it be inferred?**
   - What we know: `convex_mutation_safe(path, args)` takes an arbitrary `args` dict (convex_client.py:74–88); `workspace_id` must be in `args` for the Convex schema validators.
   - Recommendation: Always pass `workspace_id` explicitly in the wrapper's args dict; read from `state.get("workspace_id", os.environ.get("WORKSPACE_ID", "eisenbalm"))`.

---

## Environment Availability

All dependencies are either already installed in `dispatch-control/package.json` or are new npm packages with no system prerequisites. The Python pipeline runs on Railway (Linux) where all deps are managed via `pyproject.toml`.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@xyflow/react` | Graph view (D-01/02/03/04) | Not yet installed | 12.11.0 | — |
| `@dagrejs/dagre` | DAG auto-layout | Not yet installed | 3.0.0 | Manual coordinates (fragile) |
| `convex ^1.38.0` | All Convex queries | Already installed | 1.38.x | — |
| `@clerk/nextjs ^7.5.7` | Auth | Already installed | 7.5.7 | — |
| `lucide-react` | Node icons | Already installed | 1.14.0 | — |
| Python `httpx` | convex_mutation_safe | Already present in pipeline | — | — |
| Python `cost.py` | `get_cost_payload()` | Already present | — | — |

**Missing dependencies with no fallback:**
- `@xyflow/react` and `@dagrejs/dagre` must be installed before graph view implementation.

**Missing dependencies with fallback:**
- None — all fallbacks are either the library itself or existing code.

---

## Validation Architecture

> `workflow.nyquist_validation` is not explicitly set to false; treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest ^3.2.0` (already configured in `dispatch-control/vitest.config.ts`) |
| Config file | `apps/dispatch-control/vitest.config.ts` |
| Quick run command | `pnpm --filter dispatch-control test:unit` |
| Full suite command | `pnpm --filter dispatch-control test` |
| Python tests | `pytest packages/pipeline/tests/` (existing harness) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OBS-01 | Graph renders agent nodes with config data from `agents` table | unit (component) | `pnpm --filter dispatch-control test:unit -- AgentNode` | ❌ Wave 0 |
| OBS-02 | Runs list query returns all `runs` rows for workspace, sorted by `startedAt` desc | integration (Convex) | `pnpm --filter dispatch-control test -- runs.test` | ❌ Wave 0 |
| OBS-03 | `agent_runs:byRunId` subscription returns live status; `agentRuns:started` → `running` in Convex | integration | `pnpm --filter dispatch-control test -- agentRuns.test` | ❌ Wave 0 |
| OBS-03 | `wrap_agent_node()` emits `agentRuns:started` before fn() and `agentRuns:completed` after | unit (Python) | `pytest packages/pipeline/tests/test_agent_wrapper.py -x` | ❌ Wave 0 |
| OBS-04 | Cost roll-up: `parseCostJson(runs.cost).total` matches sum of `agent_runs.costUsd` for that run | unit | `pnpm --filter dispatch-control test:unit -- costRollup` | ❌ Wave 0 |
| OBS-04 | No double-counting: `record_cost()` called exactly once per `acomplete()` call | unit (Python) | `pytest packages/pipeline/tests/test_cost_double_count.py -x` | ❌ Wave 0 |
| OBS-05 | Node click opens IO panel; panel loads from `agent_run_payloads:byRunIdAgentKey` | unit (component) | `pnpm --filter dispatch-control test:unit -- AgentIOPanel` | ❌ Wave 0 |
| AUD-01 | `auditLog:write` inserts a row with correct shape; `auditLog:listForWorkspace` returns it | integration (Convex) | `pnpm --filter dispatch-control test -- auditLog.test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter dispatch-control test:unit` (fast, < 30s)
- **Per wave merge:** `pnpm --filter dispatch-control test && pytest packages/pipeline/tests/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/dispatch-control/__tests__/AgentNode.test.tsx` — OBS-01 node rendering
- [ ] `apps/dispatch-control/__tests__/AgentIOPanel.test.tsx` — OBS-05 panel
- [ ] `apps/dispatch-control/__tests__/costRollup.test.ts` — OBS-04 cost aggregation util
- [ ] `apps/dispatch-control/__tests__/agentRuns.test.ts` — OBS-03 Convex query shape
- [ ] `apps/dispatch-control/__tests__/auditLog.test.ts` — AUD-01 infrastructure
- [ ] `packages/pipeline/tests/test_agent_wrapper.py` — OBS-03 wrapper emit behavior
- [ ] `packages/pipeline/tests/test_cost_double_count.py` — OBS-04 no-double-count assertion
- [ ] `apps/dispatch-control/__tests__/setup.ts` — shared test utilities (mock convex, mock clerk)

---

## Project Constraints (from CLAUDE.md)

Directives from `./CLAUDE.md` that are binding on Phase 23:

1. **Tech stack locked:** Next.js 14+ (App Router on Vercel), Sanity v3, FastAPI on Railway, LangGraph, OpenRouter, Supabase (now Railway Postgres), Convex, Stripe. Do not substitute.
2. **Schema files in `convex/schema.ts`** — do not modify frozen field names. `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog` are frozen. Adding fields to `agent_runs` is additive and acceptable.
3. **API_CONTRACTS.md §4 is frozen** — `pipelineRuns:create`, `pipelineRuns:updateStatus` signatures unchanged. Do not add `workspace_id` to `pipelineRuns`.
4. **Naming conventions:** `camelCase` for TypeScript identifiers; `kebab-case` for literal union values (e.g., `"awaiting-review"`); `*At` suffix for timestamp fields.
5. **Convex per-table file pattern:** one `.ts` file per table in `convex/` (e.g., `agentRuns.ts`, `auditLog.ts`). Do not add multiple table mutations to a single file.
6. **GSD workflow enforcement:** Use GSD entry points (`/gsd:execute-phase`) for all file modifications; no direct edits outside a GSD workflow unless user explicitly asks.
7. **No Eisenbalm-specific logic in the control plane:** Graph node labels come from the `agents` table, not hardcoded strings. The wrapper and dashboard should work for any 14-node pipeline.
8. **`workspace_id` on every new Convex table** — every `defineTable()` in Phase 23 schema extensions must include `workspace_id: v.string()`.
9. **ASCII section-header comments** in large files (e.g., `convex/schema.ts`) per observed convention.
10. **`convex/_generated/ai/guidelines.md` must be read before writing any Convex code.** (Note: file was not found at expected path during this research — the planner should verify this path before writing Convex function files.)

---

## Sources

### Primary (HIGH confidence)

- `convex/schema.ts` (direct read) — exact `agent_runs`, `runs`, `audit_log`, `agents` table shapes; confirmed NO `tokensIn`/`error` fields on `agent_runs` stub
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` (direct read) — `get_cost_payload()` return shape; `AgentCost` TypedDict; `record_cost()` additive accumulation; `get_recorder()` API
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` (direct read) — exact 14+1 node wiring; `SECTION_WRITERS` tuple; `DESIGNAGENT_SUPPRESSED` flag; `validate_sections` join node; `verify_research` node
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` (direct read) — `convex_mutation_safe(path, args)` signature; `convex_mutation(http, path, args)` signature; fire-and-forget pattern
- `convex/pipelineRuns.ts` (direct read) — frozen `create`, `updateStatus`, `byRunId` function signatures
- `convex/agents.ts` (direct read) — `upsert`, `listForWorkspace` signatures
- `convex/runs.ts` (direct read) — `create`, `setConfigSnapshot`, `byRunId` signatures
- `apps/dispatch-control/package.json` (direct read) — exact installed dependencies; `@xyflow/react` NOT yet installed
- npm registry — `@xyflow/react 12.11.0` (latest), `@dagrejs/dagre 3.0.0` (latest), confirmed React 19 peer dep compatibility

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` — §3 "LangGraph Callback Handler" section; `wrap_agent_node` reference implementation; "no second cost recorder" decision
- `.planning/research/PITFALLS.md` — Pitfall 3.1 cost double-counting; Pitfall 7.1 workspace_id discipline
- `.planning/research/STACK.md` — dispatch-control toolchain; note that `@xyflow/react` is flagged as a "NEW dependency to confirm" (this research confirms it)
- `.planning/research/SUMMARY.md` — four convergent findings; phase 23 scope definition

### Tertiary (LOW confidence — not needed; findings above are sufficient)

- N/A — all critical claims are backed by direct code reads or npm registry verification.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry verified; exact peer deps confirmed
- Architecture (wrapper pattern): HIGH — reference implementation in ARCHITECTURE.md §3; cost.py API verified by direct read
- Convex schema and mutations: HIGH — direct schema.ts read; existing file patterns verified
- I/O payload strategy: MEDIUM — the separate-table recommendation is grounded in Convex subscription bandwidth reasoning; actual payload sizes estimated from agent code knowledge (not measured)
- Pitfalls: HIGH — all tied to specific line citations in actual code

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable ecosystem; npm package versions unlikely to change meaningfully in 30 days)
