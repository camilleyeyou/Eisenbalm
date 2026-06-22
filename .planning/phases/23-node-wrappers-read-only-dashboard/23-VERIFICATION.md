---
phase: 23-node-wrappers-read-only-dashboard
verified: 2026-06-22T00:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 23: Node Wrappers + Read-Only Dashboard Verification Report

**Phase Goal:** Every LangGraph agent node is wrapped by `wrap_agent_node()`; the wrapper emits `agent_runs:started`/`completed`/`failed` to Convex (reading already-accumulated cost from `cost.py` — no second recorder); the operator dashboard shows the pipeline graph, full run history, a live run view with per-agent status and cost, and per-agent input/output inspection; audit infrastructure is in place.
**Verified:** 2026-06-22
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each of the 18 agent nodes emits started/completed/failed events to agent_runs; dashboard graph shows queued→running→done/failed live | VERIFIED | `wrap_agent_node()` confirmed in all 18 `builder.add_node()` calls; `agentRuns.ts` exports `started`/`completed`/`failed` as `internalMutation`; `PipelineGraph.tsx` subscribes via `useQuery(api.agentRuns.byRunId, runId ? {runId} : 'skip')` |
| 2 | Cost roll-up matches already-captured per-call cost; no second record_cost call | VERIFIED | AST scan confirms zero `record_cost` imports or calls in `agent_wrapper.py`; `get_cost_payload` (read-only) is the only cost access; `CostRollup.tsx` + `RunDetail.tsx` read `runs.cost` via `parseCostJson` — no separate recorder |
| 3 | Operator can open any past run and inspect per-agent input/output payload and any error or retry | VERIFIED | `AgentIOPanel.tsx` queries `api.agentRuns.payloadByRunIdAgentKey` on node click; `RunDetail.tsx` shows per-agent table with `error` column; `savePayload` mutation writes truncated I/O snapshots to `agent_run_payloads` |
| 4 | Pipeline graph view shows each agent as a node with current config (model, enabled flag, description) sourced from Convex | VERIFIED | `PipelineGraph.tsx` calls `useQuery(api.agents.listForWorkspace)`; `AgentNode.tsx` renders `model`, `description`, and dims + badges `enabled=false` nodes; `agents` table has `model`, `enabled`, `description` fields |
| 5 | Every config/prompt change, review decision, and kill-switch flip emits a row to audit_log with actor, timestamp, and before/after | VERIFIED (infrastructure) | `auditLog.ts` exports `write` internalMutation and `listForWorkspace` query; `AuditLogViewer.tsx` renders rows with timestamp/actor/action/before/after; actual emissions deferred to Phases 24-26 by design — empty state message correctly states this |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/agentRuns.ts` | 5 internalMutations + 2 queries | VERIFIED | `queueForRun`, `started`, `completed`, `failed`, `savePayload` (all internalMutation); `byRunId`, `payloadByRunIdAgentKey` (query); 242 lines, substantive |
| `convex/auditLog.ts` | write mutation + listForWorkspace query | VERIFIED | `write` internalMutation, `listForWorkspace` public query; newest-first ordering via `by_workspace_timestamp` index |
| `convex/schema.ts` | agent_runs extended + agent_run_payloads table | VERIFIED | `tokensIn`, `tokensOut`, `error` optional fields added; `agent_run_payloads` table with `by_runId_agentKey` compound index |
| `apps/dispatch-control/lib/costRollup.ts` | parseCostJson + sumRunsCost | VERIFIED | Both exported; handles null/undefined/invalid JSON gracefully |
| `packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` | wrap_agent_node HOF, read-only cost | VERIFIED | 179 lines; `wrap_agent_node`, `_resolve_workspace`, `_snapshot_input`, `_snapshot_output`; only calls `get_cost_payload`; AST confirms zero `record_cost` usage |
| `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` | All 18 nodes wrapped | VERIFIED | `grep -c "wrap_agent_node("` = 18; all sequential spine + 7 section writers + design + validate_sections + post-fan-in spine |
| `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` | queueForRun at run start | VERIFIED | `agentRuns:queueForRun` called after `runs:create`, before `load_run_config`; agent key list composed from `SECTION_WRITERS` import |
| `apps/dispatch-control/app/(dashboard)/graph/_components/PipelineGraph.tsx` | React Flow DAG with live Convex subscriptions | VERIFIED | 3 useQuery subscriptions wired; dagre layout; AgentNode rendered; AgentIOPanel slide-over on node click |
| `apps/dispatch-control/app/(dashboard)/graph/_components/AgentNode.tsx` | Config-at-rest + live status rendering | VERIFIED | Renders model, description, enabled badge; status-colored border; inline cost/duration during run |
| `apps/dispatch-control/app/(dashboard)/graph/_components/AgentIOPanel.tsx` | Per-agent I/O inspection panel | VERIFIED | Queries `payloadByRunIdAgentKey` on-demand; renders inputSnapshot, outputSnapshot, error block, metrics |
| `apps/dispatch-control/app/(dashboard)/graph/_components/pipelineTopology.ts` | Static 18-node, 23-edge DAG | VERIFIED | 97 lines; 18 PIPELINE_NODES, 23 PIPELINE_EDGES (7 fan-out + 7 fan-in + 9 spine) |
| `apps/dispatch-control/app/(dashboard)/runs/_components/RunsTable.tsx` | Run history table | VERIFIED | Reads `api.runs.listForWorkspace`; columns: status/trigger/triggeredBy/startedAt/durationMs/cost; each row links to `/runs/{runId}` |
| `apps/dispatch-control/app/(dashboard)/runs/_components/CostRollup.tsx` | Weekly/monthly aggregate spend | VERIFIED | Filters by 7d/30d window; calls `sumRunsCost`; collapsible details card |
| `apps/dispatch-control/app/(dashboard)/runs/_components/RunDetail.tsx` | Per-run detail with OBS-04 reconciliation | VERIFIED | `useQuery(api.runs.byRunId)` + `useQuery(api.agentRuns.byRunId)`; per-agent table; reconciliation panel (per-agent sum vs runs.cost.total, red delta alert) |
| `apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx` | Read-only audit log viewer | VERIFIED | `useQuery(api.auditLog.listForWorkspace)`; renders timestamp/actor/action/resource/before/after with collapsible JSON; no write controls |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `wrap_agent_node` | `agentRuns:started/completed/failed/savePayload` | `convex_mutation_safe()` | WIRED | 4 mutation calls present in `wrapped()` closure |
| `builder.py` all 18 nodes | `wrap_agent_node` | `builder.add_node("key", wrap_agent_node("key", fn))` | WIRED | 18 calls confirmed by grep count |
| `api/runs.py` | `agentRuns:queueForRun` | `convex_mutation(...)` | WIRED | Called after run creation, before `load_run_config` |
| `PipelineGraph.tsx` | `agents.listForWorkspace` | `useQuery(api.agents.listForWorkspace, { workspace_id })` | WIRED | Config at rest drives `agentMap` in useMemo |
| `PipelineGraph.tsx` | `agentRuns.byRunId` | `useQuery(api.agentRuns.byRunId, runId ? {runId} : 'skip')` | WIRED | Live status drives `runMap`; Convex skip pattern for no active run |
| `AgentIOPanel.tsx` | `agentRuns.payloadByRunIdAgentKey` | `useQuery(api.agentRuns.payloadByRunIdAgentKey, ...)` | WIRED | On-demand query on node click (not subscribed) |
| `RunsTable.tsx` | `runs.listForWorkspace` | `useQuery(api.runs.listForWorkspace, { workspace_id })` | WIRED | Real-time subscription |
| `CostRollup.tsx` | `parseCostJson` + `sumRunsCost` | `import { parseCostJson, sumRunsCost } from '@/lib/costRollup'` | WIRED | Client-side aggregation |
| `RunDetail.tsx` | `api.runs.byRunId` + `api.agentRuns.byRunId` | dual `useQuery` | WIRED | Both subscriptions drive header and per-agent table |
| `AuditLogViewer.tsx` | `auditLog.listForWorkspace` | `useQuery(api.auditLog.listForWorkspace, {...})` | WIRED | Live subscription; empty state when no emissions yet |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PipelineGraph.tsx` | `agents` | `useQuery(api.agents.listForWorkspace)` | Yes — reads `agents` Convex table | FLOWING |
| `PipelineGraph.tsx` | `agentRuns` | `useQuery(api.agentRuns.byRunId)` | Yes — reads `agent_runs` table via `by_runId` index | FLOWING |
| `AgentIOPanel.tsx` | `payload` | `useQuery(api.agentRuns.payloadByRunIdAgentKey)` | Yes — reads `agent_run_payloads` table via `by_runId_agentKey` compound index | FLOWING |
| `RunsTable.tsx` | `runs` | `useQuery(api.runs.listForWorkspace)` | Yes — reads `runs` table via `by_workspace` index | FLOWING |
| `CostRollup.tsx` | `runs` / `weekCost` / `monthCost` | `useQuery` → `sumRunsCost` / `parseCostJson` | Yes — reads `runs.cost` JSON and aggregates without second recorder | FLOWING |
| `RunDetail.tsx` | `run` + `agentRuns` | dual `useQuery` | Yes — reads `runs` and `agent_runs` tables; reconciliation panel computes `perAgentSum` from `cost.agents` | FLOWING |
| `AuditLogViewer.tsx` | `rows` | `useQuery(api.auditLog.listForWorkspace)` | Yes — reads `audit_log` table (empty until Phase 24 emissions, expected behavior) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `wrap_agent_node` has no `record_cost` import or call | AST walk on `agent_wrapper.py` | Zero occurrences; only `get_cost_payload` present | PASS |
| All 18 `builder.add_node()` calls wrapped | `grep -c "wrap_agent_node("` in builder.py | Count = 18 | PASS |
| All 11 phase commits present in git log | `git log --oneline` grepped for commit hashes | All 11 commits (baea19c through 9b9c328) found | PASS |
| `runs:listForWorkspace` query exists in convex/runs.ts | `grep -n "listForWorkspace"` | Export confirmed at line 80 | PASS |
| `AuditLogViewer` rendered in settings page | `grep -n "AuditLogViewer"` settings/page.tsx | Imported and rendered at line 31 | PASS |
| `agents` table has `model`, `enabled`, `description` | `grep -n "model\|enabled\|description"` schema.ts | All three fields confirmed | PASS |
| `force-dynamic` on all Convex-subscribed pages | grep all four page.tsx files | `export const dynamic = 'force-dynamic'` present in graph, runs, runs/[runId], settings | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| OBS-01 | 23-03 | Pipeline graph view showing each agent as a node with current config (model, enabled, description) | SATISFIED | `PipelineGraph.tsx` + `AgentNode.tsx` + `agents.listForWorkspace` subscription; `agents` table fields confirmed |
| OBS-02 | 23-04 | Full run history (status, trigger source, who triggered, duration, cost) + open any run | SATISFIED | `RunsTable.tsx` with all 6 columns; each row links to `/runs/{runId}`; `RunDetail.tsx` at detail page |
| OBS-03 | 23-01, 23-02 | Live run watch: queued→running→done/failed with live token/cost, no page refresh | SATISFIED | `wrap_agent_node` emits lifecycle events; `agentRuns.byRunId` is Convex subscription; `PipelineGraph` updates live via Convex reactivity |
| OBS-04 | 23-01, 23-02, 23-04 | Cost rolled up per agent → run → week/month reading already-captured per-call cost; no second cost recorder | SATISFIED | `parseCostJson`/`sumRunsCost` read `runs.cost`; `CostRollup.tsx` aggregates; `RunDetail.tsx` reconciliation panel; AST confirms no `record_cost` in wrapper |
| OBS-05 | 23-01, 23-02, 23-03 | Per-agent input/output inspection + error/retry for a run | SATISFIED | `AgentIOPanel.tsx` queries `agent_run_payloads` on node click; error block shown for `status=failed`; `savePayload` writes truncated I/O snapshots |
| AUD-01 | 23-01, 23-04 | Every config/prompt change, review decision, and kill-switch flip recorded in audit log with actor, timestamp, before/after | SATISFIED (infrastructure) | `auditLog.ts` `write` + `listForWorkspace` exist; `AuditLogViewer.tsx` renders full row structure; emissions deferred to Phases 24-26 per plan design — this is correct phasing, not a gap |

All 6 requirements from ROADMAP.md Phase 23 entry are covered. Requirement IDs declared in plan frontmatter:
- 23-01-PLAN.md: OBS-03, OBS-04, OBS-05, AUD-01
- 23-02-PLAN.md: OBS-03, OBS-04, OBS-05
- 23-03-PLAN.md: OBS-01, OBS-03, OBS-05
- 23-04-PLAN.md: OBS-02, OBS-04, AUD-01

Union = {OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, AUD-01} — exactly matches ROADMAP.md Phase 23 requirements. No orphaned requirements.

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `AuditLogViewer.tsx` empty state | "No audit events yet — actions are recorded starting in Phase 24" | Info | Not a stub — audit infrastructure is fully wired; actual operator action emissions are correctly deferred to Phases 24-26 when those controls are built. The query is live and will populate when Phase 24 ships. |
| `AgentNode.tsx`, `PipelineGraph.tsx` | Shows empty canvas when no agents seeded and no active run | Info | Expected behavior for a fresh workspace; data flows correctly when tables are populated |

No blockers or warnings found. The audit viewer empty state is a correct phased implementation, not a stub.

### Human Verification Required

**1. Live run graph update without page refresh**
- **Test:** Trigger a pipeline run via `POST /run`; observe the graph page in a browser
- **Expected:** All 18 nodes appear as grey "queued" immediately; nodes transition to "running" (animated spinner, blue border) and then "done" (green border) as each agent completes; no manual page refresh needed
- **Why human:** Requires a live Convex deployment and a real pipeline run to verify the real-time Convex subscription repaint

**2. AgentIOPanel I/O snapshot display**
- **Test:** After any run completes, click a node on the graph page
- **Expected:** Slide-over panel opens showing Input Snapshot and Output Snapshot as pretty-printed JSON; metrics row shows cost, duration, tokensIn, tokensOut
- **Why human:** Requires real agent_run_payloads rows in Convex from an actual run

**3. Cost reconciliation delta detection**
- **Test:** In RunDetail for a run where per-agent sum and runs.cost.total differ by more than $0.0001
- **Expected:** Red "Discrepancy" column appears between the two cost columns
- **Why human:** Requires a run with an actual discrepancy to trigger the alert path; no such run exists in a fresh workspace

### Gaps Summary

No gaps. All 5 success criteria from ROADMAP.md are verifiably implemented:

1. All 18 `builder.add_node()` calls use `wrap_agent_node()`; lifecycle mutations are real (not stubbed); `PipelineGraph` subscribes live to `agentRuns.byRunId`.
2. `get_cost_payload` is the only cost access in `agent_wrapper.py` (AST-confirmed); `CostRollup` and `RunDetail` read `runs.cost` without a second recorder.
3. `AgentIOPanel` queries `agent_run_payloads` on node click; `RunDetail` shows per-agent error column; both data sources are fully wired to Convex.
4. `PipelineGraph` subscribes to `agents.listForWorkspace`; `AgentNode` renders `model`, `enabled`, `description`.
5. `auditLog.ts` infrastructure (write + listForWorkspace) is in place; `AuditLogViewer` is rendered and wired; no audit emissions yet is correct phasing — that work is Phase 24-26.

Test suite confirmation (from SUMMARY.md, pre-verified by executor): 59 vitest tests passing (dispatch-control), 288 pytest tests passing (pipeline). All 11 phase commits confirmed present in git log.

---

_Verified: 2026-06-22_
_Verifier: Claude (gsd-verifier)_
