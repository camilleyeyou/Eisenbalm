# Phase 23: Node Wrappers + Read-Only Dashboard - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Instrument every LangGraph agent node with `wrap_agent_node()` so each node emits
`agent_runs` lifecycle events (`started` / `completed` / `failed`) to Convex — reading
the already-accumulated per-call cost from `cost.py` (NO second cost recorder) — and
build the **read-only** operator dashboard in `apps/dispatch-control`: the pipeline
graph view, full run history, a live run view with per-agent status + cost, per-agent
input/output inspection, cost roll-ups, and the audit-log infrastructure.

**Explicitly in scope:**
- `wrap_agent_node()` wrapping the agent nodes in `graph/builder.py`; emits queued→running→done/failed to `agent_runs` with timestamps + cost-so-far
- Cost surfaced by reading existing `cost.py` per-agent totals — no new recorder
- Read-only dashboard views: Graph, Runs (history + detail), live run, cost roll-ups, per-agent I/O inspection
- Audit-log infrastructure (shared write helper + read-only viewer; table already exists)
- Convex queries/subscriptions for the above (all `workspace_id`-scoped)

**Explicitly NOT in scope (owned by later phases):**
- Any write/control action from the dashboard — trigger, cancel, edit, review (Phases 24–26)
- Prompt editing / versioning / diff / rollback UI (Phase 24)
- Run control / scheduler / kill switch / re-roll / budget caps (Phase 25)
- Review gate / charity registry behavior (Phase 26)
- Stripe reconciliation / notifications (Phase 27)
- Full "graph-as-data" (editable edges from DB) — Phase 28 / productization

</domain>

<decisions>
## Implementation Decisions

### Graph view (discussed in detail — the dashboard home view)
- **D-01: Real visual DAG.** Render the pipeline as nodes connected by edges with
  auto-layout, faithfully showing the sequential spine (Calibrator → Scout → Advocate →
  Editor gate 1 → Chronicler → Researcher → verify_research) AND the 7-writer parallel
  fan-out (origin_story / problem / founder_bio / case_study / game / bonus / design →
  validate_sections) → QA → Editor Final → Publisher. This is the dashboard's home view
  ("dashboard mirrors the real pipeline graph", brief). React Flow / `@xyflow` is the
  default candidate; researcher confirms exact library + auto-layout approach.
- **D-02: Live status paints directly onto the nodes.** Each node changes color by state
  (`queued` / `running` / `done` / `failed`), a spinner marks the currently-running node,
  and **cost + duration render inline on the node**. Status must be readable from the graph
  alone, updating live via Convex subscription with no page refresh (OBS-03). The parallel
  fan-out shows multiple writer nodes in `running` simultaneously.
- **D-03: Nodes show a config summary at rest** (no run in flight): agent name + its current
  config from the `agents` table — **model, enabled flag, description** (OBS-01). Disabled /
  suppressed agents (e.g. DesignAgent when `DESIGNAGENT_SUPPRESSED`) render visually dimmed.
- **D-04: Clicking a node opens the per-agent input/output + error/retry + cost panel**
  (OBS-05). The graph is the primary **entry point to run inspection**. (The same panel may
  also be reachable from the run-detail screen — Claude's discretion — but node-click is the
  locked access pattern.)

### Claude's Discretion
The other three candidate areas were not selected for discussion; capture as sensible
defaults grounded in the brief + requirements:

- **Per-agent I/O storage depth & shape (OBS-05).** The *access pattern* is locked (node
  click → panel). The researcher/planner decide: full-raw vs truncated/summarized payloads,
  WHERE payloads live (an added field on `agent_runs` vs a separate table — note `agent_runs`
  currently has no payload field), and what constitutes a node's "input/output" (full
  `DispatchState` delta vs the relevant slice). Be mindful that research blobs and full
  section text can be large — pick a storage strategy that won't bloat the live-subscription
  documents (e.g. store payloads separately or truncate inline + link to full).
- **Live-run presentation beyond the graph & cost roll-up display (OBS-03/04).** Whether to
  reuse the public deliberation-layer styling or build a new compact operator view; how cost
  roll-ups present (tables vs charts) and where aggregation happens (Convex query vs frontend).
  Roll-ups span per agent → per run → per issue → per week/month (OBS-04). Note: "per issue"
  ≈ per run for now. Always read already-captured cost — never add a second recorder.
- **Audit-log scope this phase (AUD-01).** Build the audit **infrastructure**: a shared
  audit-write helper (actor + timestamp + before/after), the table already exists from Phase 21,
  and a read-only audit viewer. The actual config / prompt / review / kill-switch emissions
  land in their OWNING phases (24/25/26) because those actions don't exist yet in Phase 23 —
  do NOT synthesize action paths just to demo a row. Goal language is "audit infrastructure
  is in place."
- **`wrap_agent_node()` internals.** Failure semantics (catch → emit `failed` with error
  message → re-raise so LangGraph handling is unchanged), how retries surface to `agent_runs`
  (OBS-05 "any error/retry"), and which nodes the wrapper applies to — agent nodes get wrapped;
  the non-LLM join node `validate_sections` (and any pure structural nodes) are Claude's
  discretion on whether they emit.
- Graph library + auto-layout algorithm (dagre/elk/built-in), responsive/mobile behavior,
  empty / no-runs state, node icons, exact panel layout.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.0 spec & reconciliation (read first)
- `docs/MISSION_CONTROL_BRIEF.md` — Canonical v2.0 spec. §5 (technical architecture + data model: `runs`, `agent_runs`, `audit_log`), §6 (productization bones / `workspace_id`), §8 (resolved decisions). Graph-as-data is later; this phase reads a fixed graph.
- `docs/CURRENT_STATE.md` — Phase 0 reconciliation: per-call cost capture ALREADY exists (real OpenRouter tokens+USD in `acomplete` → `cost.py` → `pipelineRuns.cost`). Spend observability is surfacing, not instrumenting.

### Research (v2.0 milestone)
- `.planning/research/ARCHITECTURE.md` — `runs` / `agent_runs` table design; "no second cost recorder" decision; frozen `pipelineRuns`/`deliberationEvents`.
- `.planning/research/SUMMARY.md` — `runs` augments frozen `pipelineRuns`; `workspace_id` on every table.
- `.planning/research/PITFALLS.md` — No second cost recorder; no Eisenbalm-specific control-plane logic; `workspace_id` discipline.
- `.planning/research/STACK.md` — dispatch-control toolchain (Next 15 / React 19 / Tailwind v4 / shadcn / convex / lucide); a graph-rendering library (e.g. React Flow) would be a NEW dependency to confirm here.

### Prior phase context
- `.planning/phases/21-auth-app-shell-convex-schema/21-CONTEXT.md` — App shell + Clerk + the 11 tables; `agent_runs`/`runs`/`audit_log`/`agents` shapes; Graph is the home view; read-only-this-phase boundary.
- `.planning/phases/22-config-externalization/22-CONTEXT.md` — `agents` table now carries model/temperature/top_p/max_tokens/description; config snapshot on `runs`; `state["config"]` pattern.

### Existing code / contracts
- `convex/schema.ts` — `agent_runs` (workspace_id, runId, agentKey, status, startedAt, completedAt, costUsd, durationMs — NO payload field yet), `runs`, `audit_log`, `agents` definitions + index/upsert conventions. Read `convex/_generated/ai/guidelines.md` first.
- `convex/pipelineRuns.ts` — frozen run record + per-table mutation/query file pattern to mirror for `agentRuns.ts` / `auditLog.ts`.
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — the exact 14-node wiring (`add_node`/`add_edge`); where `wrap_agent_node()` is applied; `DESIGNAGENT_SUPPRESSED` flag + `validate_sections` join node.
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` — `CostRecorder` / `get_recorder` / per-agent `AgentCost` (tokens_in/out, usd, duration_ms) keyed by run_id+agent. The wrapper READS from here.
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` — `convex_mutation_safe` / `convex_query` helpers for emitting `agent_runs` events.
- `docs/API_CONTRACTS.md` — §4 `pipelineRuns` is FROZEN; `runs`/`agent_runs` are additive on `runId`; §7 `DispatchState` (input/output payload source).
- `apps/dispatch-control/app/(dashboard)/graph/page.tsx`, `runs/page.tsx`, `finance/page.tsx` — placeholder pages these views replace; `components/AppSidebar.tsx`, `lib/nav.ts` for nav integration.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`cost.py` per-agent recorder** — already accumulates tokens/usd/duration per (run_id, agent). `wrap_agent_node()` reads it on node completion; no new instrumentation.
- **`convex_client.py` helpers** — `convex_mutation_safe` (fire-and-forget, log-on-fail — matches the brief's "Convex mutation failure is non-fatal" stance) and `convex_query`.
- **Schema stubs from Phase 21** — `agent_runs`, `runs`, `audit_log`, `agents` tables + `by_workspace` / `by_runId` indexes already exist; this phase fleshes `agent_runs` (likely adds a payload field) + adds mutation/query files.
- **dispatch-control shell** — Clerk auth, sidebar nav, `ConvexClientProvider`, placeholder Graph/Runs/Finance pages ready to fill; `workspace.ts` default-workspace constant.

### Established Patterns
- LangGraph nodes wired via `builder.add_node(name, fn)` — `wrap_agent_node` likely wraps `fn` at registration time so all 14 are covered uniformly.
- Convex per-table file pattern (`pipelineRuns.ts`, `stripeOrders.ts`) → add `agentRuns.ts`, `auditLog.ts`.
- Convex live subscriptions via `useQuery` on the frontend (real-time, no refresh) — the live-run + graph status mechanism.
- ASCII section-header comments + deterministic/idempotent upserts in `convex/schema.ts`.

### Integration Points
- `graph/builder.py` — single chokepoint to apply the wrapper across all agent nodes.
- `convex/schema.ts` — extend `agent_runs` (payload/error fields) if I/O stored inline.
- `apps/dispatch-control` Graph + Runs routes — replace placeholders; add a graph library dependency.
- `agent_runs.runId` ↔ frozen `pipelineRuns.runId` ↔ `runs.runId` join key ties live agent events to run history + cost.

</code_context>

<specifics>
## Specific Ideas

- The Graph view is the dashboard home and the primary navigation surface: it shows config
  at rest, live status during a run, and is the click-through entry to per-agent I/O
  inspection. Build it as the centerpiece, not a static diagram.
- Keep the control plane brand-agnostic: "a configurable graph of agents that produces a
  scheduled content artifact" — the graph renders whatever nodes/edges the pipeline defines,
  not hardcoded Eisenbalm-specific labels beyond what `agents` data provides.

</specifics>

<deferred>
## Deferred Ideas

- Editable graph topology / "graph-as-data" from DB — Phase 28 / productization.
- Any dashboard write action (trigger, cancel, edit prompt, review/publish, kill switch) —
  Phases 24–26; this phase is strictly read-only + instrumentation + audit infra.
- Actual audit-log emissions for config/prompt/review/kill-switch actions — land in the
  owning phases (24/25/26) where those actions are built.
- Budget caps / cost projection using `model_pricing` — Phase 25/27.

</deferred>

---

*Phase: 23-node-wrappers-read-only-dashboard*
*Context gathered: 2026-06-21*
