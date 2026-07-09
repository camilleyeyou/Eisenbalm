# Phase 37: Run Monitor v2 + Signal Desk - Research

**Researched:** 2026-07-09
**Domain:** Convex/FastAPI/LangGraph observability surfaces (React Flow forensic spine + Gate-1 adjudication UI) over existing v2.0/v3.0 data
**Confidence:** HIGH (every finding below is sourced from direct code inspection, not inference)

## Summary

This phase builds two dashboard screens over data that already exists — no new pipeline agents, no topology change. The v1 `run-monitor/graph` view (React Flow + dagre, already top-to-bottom) is a solid foundation to rebuild into the vertical forensic spine; `agent_runs`/`agent_run_payloads` already carry cost/latency/I-O; `rerun_agent` and the resume endpoint already exist. However, direct source inspection turned up **four load-bearing corrections to the CONTEXT.md premises** that change how several tasks must be scoped:

1. **`retryCount` (D-03) has no existing data source.** There is no per-node retry mechanism anywhere in the pipeline. `_wrapper.py`'s `attempts` (referenced in CONTEXT.md) belongs to `AgentToolCallLimitExceeded` — the Scout/Researcher tool-call iteration limit (AGT-18), a completely different concept from agent-node retries. `lib/agent_wrapper.py::wrap_agent_node` (the ACTUAL file that writes `agent_runs`) has zero retry logic: on any exception it emits `agentRuns:failed` once and re-raises, ending the run. The only real "retry" in the codebase is a silent one-shot regenerate-on-schema-miss inside `acomplete()` (`lib/openrouter_client.py`), which is invisible to `agent_runs` today. The planner must decide: (a) wire that regenerate-retry signal through to `agentRuns:completed` (small, real, additive plumbing), or (b) ship the field defaulting to 0 for every row until a real retry mechanism exists, and say so explicitly. Do not assume "attempts" is already surfaced — it isn't, for this meaning of the word.
2. **The Gate-1 decision panel's `confidence` value is never written to Convex.** `_editor_decision_payload` (the actual `emit_event="editor-decision"` payload builder in `editor.py`) only emits `{winner, rationale}`. `confidence` is computed locally inside `editor_gate_1`, used only to decide whether to interrupt, and then discarded (never added to `state`, never returned). SIG-02 as scoped requires an additive change: return `editor_confidence` (and ideally `runner_up_notes`, which IS already in state) from `editor_gate_1`, thread it through `_editor_decision_payload`, and amend `docs/API_CONTRACTS.md §3.4` and the DispatchState contract (§7) before touching code (contract-first).
3. **`pitchLog` does not carry `advocateScore`/`advocateArgument`/`primaryConcern`.** Those fields exist only in the `deliberationEvents` row with `eventType: 'advocate-argument'` (payload JSON, keyed by `charityId`). The Signal Desk candidate slate (SIG-01) must join `pitchLog.byRunId` with `deliberationEvents.byRunIdAndType('advocate-argument')` on `charityId`, then `JSON.parse` the payload — it is not a single-table read as CONTEXT.md's D-10 implies.
4. **`status === 'awaiting-review'` is ambiguous between "paused at Gate 1" and "finished, awaiting publish decision"** — both write paths use the identical status literal (confirmed in `editor.py` and `publisher/__init__.py`). Phase 30's own `AwaitingYouInbox.tsx` comment says "no distinguishing field exists" — that is not quite right: the Gate-1 write never sets `completedAt`; the Publisher's finished-run write always does. `status === 'awaiting-review' && completedAt == null` is a reliable, already-available reactive signal for "enter Signal Desk adjudication mode."

**Primary recommendation:** Treat CONTEXT.md's locked decisions as correct on WHAT to build, but verify every "already exists" claim about WHERE the data lives against the four corrections above before writing tasks — several of D-02/D-03/D-11's "just surface it" framings actually require small, real, additive plumbing changes in the Python agents, not pure frontend work.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Forensic spine surface & node model (MON-01/02)**
- D-01: Rebuild the existing `run-monitor/graph` view in place into the vertical forensic spine ("Run Monitor v2" = upgrade v1, not a new route). The `run-monitor/runs/[runId]` list and `run-monitor/runs/[runId]/review` page stay. The spine reads `agent_runs` (by_runId) for the node timeline.
- D-02: Agents = dots, code gates = marigold diamonds. `verify_research` and `validate_sections` are already `wrap_agent_node`-wrapped and emit `agent_runs` rows — the spine distinguishes them as diamonds via a known gate-key set (`{verify_research, validate_sections}`) rather than a schema change. Each node shows cost (`costUsd`), latency (`durationMs`), model chip (from `model_versions`/payload), and retry count.
- D-03: Add `retryCount: v.optional(v.number())` to `agent_runs` (additive), populated by the agent wrapper (`_wrapper.py` already surfaces `attempts` on retry) — legacy rows render 0. Contract-first: amend `docs/API_CONTRACTS.md` before the schema/wrapper change. This is the only schema change in the phase.
- D-04: Handoff inspector (MON-02) renders `agent_run_payloads` input/output snapshots human-readably first (upstream output → this node's input/output → downstream input, formatted), with the raw JSON snapshot behind a toggle. No new payload capture — reuse the Phase 23 `inputSnapshot`/`outputSnapshot` (truncated ~2000 chars; note the truncation in the UI).

**7-writers strength score & re-run (MON-03)**
- D-05: Deterministic QA-derived strength score, 0-100 per section. Start at 100, subtract a severity-weighted penalty per OPEN `qaCorrections` finding in that section (error ≫ warning > info — exact weights Claude's discretion, e.g. error −25 / warning −8 / info −2), floor at 0. A colored bar (green/amber/red by threshold). Deterministic and explainable — no LLM scoring, no new pipeline call.
- D-06: Per-section re-run reuses the existing `rerun_agent` endpoint (the Phase 33 D-15 target) — one row per writer section, each individually re-runnable.
- D-07: Flag counts = open `qaCorrections` per section grouped by severity (consistent with the Review Desk/Voice Pass open-finding predicate). The 7-writers node maps section rows to writer agentKeys.

**Drift strip (MON-04)**
- D-08: Client-side aggregation over the trailing 8 completed runs — no new table. For each of the last 8 runs (plus the current), aggregate its `agent_runs` rows (Σ `costUsd`, Σ `durationMs` or run wall-clock from first-start→last-complete). Compare the current run's cost + duration against the trailing-8 mean with an over/under indicator. If profiling later shows this is too heavy, a run-summary rollup is the fallback — but ship the client aggregate first (existing data, zero migration).

**Signal Desk + Gate 1 adjudication (SIG-01/02/03)**
- D-09: Build out the `signal-desk` stub (`app/(dashboard)/signal-desk/page.tsx` exists) as the Gate 1 candidate slate + decision panel + adjudication — a surface distinct from the forensic Run Monitor (Run Monitor = "what happened"; Signal Desk = "the charity decision").
- D-10: Candidate slate from existing data (SIG-01): `pitchLog` scoutSummary + advocateScore + expandable advocateArgument + `primaryConcern` ALWAYS visible and NEVER truncated (the roadmap's explicit anti-truncation rule). Read via the existing pitchLog Convex query (by_runId).
- D-11: Decision panel (SIG-02): winner + a confidence meter + editor reasoning IN FULL, sourced from the `deliberationEvents` editor-gate-1 / editor-decision row payload (winner, confidence, reasoning). Never truncated.
- D-12: Adjudication on Gate 1 interrupt (SIG-03): when the run is paused at Gate 1 (`graph.aget_state` has `state.next` non-empty — the resume endpoint's own paused-check), the Signal Desk enters side-by-side adjudication. The operator picks a candidate and types a reason; the pick + reason resume the run via the existing `POST /run/{run_id}/resume` (which passes `Command(resume={editorSelection: charityName})`).
- D-13: Clerk-guarded adjudication bridge. The resume endpoint is `_require_trigger_secret`-guarded (server-to-server), but the dashboard is Clerk-guarded. Add a Clerk-JWT-guarded control endpoint (e.g. `POST /issues/{run_id}/adjudicate` in `api/control.py` or `runs.py`) that (a) records the operator's pick + reason as an audit row (`_emit_audit`, "nothing silent") and a deliberation/decision event, then (b) invokes the resume path server-side with the chosen `charityName`. Extend the resume pick to carry the operator `reason` for the log. Contract-first: amend `docs/API_CONTRACTS.md` before the endpoint. The operator NEVER handles the trigger secret.

### Claude's Discretion
- Exact strength-score penalty weights + color thresholds; model-chip source field; spine layout/scroll mechanics; diamond vs dot visual treatment within the 1c system.
- Drift-strip aggregation window edge cases (fewer than 8 prior runs → compare against what exists; label the n); mean vs median.
- The adjudication bridge endpoint's exact path/shape and whether it reuses `runs.py::resume_run` internals or calls it; how the operator reason is stored (audit row + deliberationEvents editor-decision vs a dedicated field).
- Whether the 7-writers node maps sections→writer agentKeys via the existing section/agent map or a new lookup. **Research finding: it's a direct 1:1 match already — see Architecture Patterns below. No new lookup needed.**
- Signal Desk chrome, confidence-meter visual, expandable-argument interaction.

### Deferred Ideas (OUT OF SCOPE)
- **Prompt Lab Evals + Eval Center** — Phase 38.
- **Registry coverage-memory strip** — Phase 39.
- **hookClaim/hookVerified data model** — still deferred; Signal Desk uses pitchLog as-is (the Phase 33 D-12 hook card upgrades later if that model ever lands).
- **Run-summary rollup table for drift** — considered, not chosen (D-08 client-aggregates existing data); revisit only if the trailing-8 aggregation is too heavy in practice.
- **`nodeType` schema field for dot/diamond** — considered, not chosen (D-02 uses a known gate-key set); revisit if the gate set grows.
- **The design brief's fuller Signal Desk vision** (candidate gate badges REAL/OBSCURE/SPECIFIC/TELLABLE, verification strip domain/EIN/press) — this is the deferred Signal Editor agent + candidate gates from V3-DEF-02, described in the stale `docs/design/dispatch-control-v2/README.md`. It does NOT exist in the pipeline (no such agent/gate nodes in `graph/builder.py`). CONTEXT.md's D-10 already correctly scopes Signal Desk down to pitchLog+deliberationEvents-only. Do not build the gate-badge system.
- Similarly, the design brief describes **3 code-gate diamonds** ("Verify Candidates, Verify Research, Validate Sections") — "Verify Candidates" does not exist in the graph. CONTEXT.md's D-02 already correctly narrows this to the 2 real gates (`verify_research`, `validate_sections`).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MON-01 | Vertical forensic spine — dots/diamonds, per-node cost/latency/model/retry | v1 `PipelineGraph.tsx`/`AgentNode.tsx`/`pipelineTopology.ts` already exist with dagre TB (vertical) layout and 18-node topology incl. `verify_research`/`validate_sections`; `agent_runs` already has cost/duration; retryCount needs real plumbing (see Pitfall 1); model chip needs a source decision (see Pitfall 6) |
| MON-02 | Handoff inspector (upstream→node→downstream, human-readable + raw JSON toggle) | `AgentIOPanel.tsx` + `agent_run_payloads`/`payloadByRunIdAgentKey` already exist (Phase 23 OBS-05); needs upstream/downstream context added (currently only shows the clicked node's own I/O) |
| MON-03 | 7-writers expand to per-section strength bars + flag counts + individual re-run | QA `sectionName` values (`origin_story`, `problem`, `founder_bio`, `case_study`, `game`, `bonus`) match `SECTION_WRITERS`/`RE_ROLLABLE` agentKeys exactly — no new mapping; `isOpenFinding` (Phase 33) is the canonical open-finding predicate to reuse; `POST /runs/{run_id}/agents/{agent_key}/rerun` already exists and is exactly the re-run action needed |
| MON-04 | Drift strip vs trailing 8 runs | `runs.listForWorkspace` gives the run list to filter/sort; **`runs.cost`/`runs.durationMs` are declared but never populated by any write path (confirmed) — do not read them.** Use `pipelineRuns:byRunId` per trailing run instead (reliably populated); `lib/costRollup.ts::parseCostJson` is directly reusable |
| SIG-01 | Candidate slate (pitchLog + advocateScore/argument + primaryConcern, never truncated) | Requires a join: `pitchLog.byRunId` + `deliberationEvents.byRunIdAndType('advocate-argument')` keyed by `charityId` — advocate data is NOT in pitchLog (see Pitfall 3) |
| SIG-02 | Decision panel — winner, confidence meter, reasoning in full | `confidence` is not persisted anywhere in Convex today — requires an additive change to `editor_gate_1` + `_editor_decision_payload` + DispatchState + contract amendment (see Pitfall 2) |
| SIG-03 | Gate-1 interrupt → adjudication → resume with logged reason | `status==='awaiting-review' && completedAt==null` on `pipelineRuns`/`runs` is the reliable reactive signal (see Pitfall 4); resume endpoint exists but is trigger-secret-guarded and has no `reason` field — needs a Clerk-guarded bridge that audit-logs then calls resume server-side |

## Standard Stack

No new libraries are needed. Everything both screens require is already installed and wired.

### Core (already present — verified via package.json / v1 code)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@xyflow/react` | already installed | React Flow canvas for the spine | v1 `PipelineGraph.tsx` already uses it; MON-01 is a rebuild-in-place, not a new integration |
| `@dagrejs/dagre` | already installed | Auto-layout, `rankdir: 'TB'` | Already vertical top-to-bottom — matches the "vertical forensic spine" requirement with zero layout-direction change |
| `convex/react` (`useQuery`) | already installed | Live subscriptions for both screens | Established pattern across every dashboard screen |
| FastAPI + LangGraph | already installed | `resume_run`, `rerun_agent`, graph state | No new endpoints beyond the one adjudication bridge (D-13) |

**Installation:** None required — this phase adds zero new npm/pip packages.

**Version verification:** N/A — no new packages to pin.

## Architecture Patterns

### Recommended Project Structure (extends existing, does not restructure)
```
apps/dispatch-control/app/(dashboard)/
├── run-monitor/
│   ├── graph/page.tsx                      # rebuilt IN PLACE (D-01) — same route
│   │   └── _components/
│   │       ├── PipelineGraph.tsx           # add vertical-spine chrome, gate diamonds, retry/model chips
│   │       ├── AgentNode.tsx               # add diamond variant, retryCount badge, model chip
│   │       ├── AgentIOPanel.tsx            # extend to upstream/downstream handoff (MON-02) + toggle
│   │       ├── pipelineTopology.ts         # add GATE_KEYS = {verify_research, validate_sections}
│   │       ├── useGraphLayout.ts           # unchanged (TB already vertical)
│   │       └── WriterExpansion.tsx         # NEW — 7-writers node → per-section strength rows (MON-03)
│   │       └── DriftStrip.tsx              # NEW — trailing-8 comparison (MON-04)
│   └── runs/[runId]/  (review page)        # UNCHANGED per D-01
└── signal-desk/
    ├── page.tsx                            # build out from PlaceholderScreen (D-09)
    └── _components/
        ├── CandidateSlate.tsx              # NEW — pitchLog + advocate-argument join (SIG-01)
        ├── DecisionPanel.tsx                # NEW — winner/confidence/reasoning (SIG-02)
        └── AdjudicationPanel.tsx            # NEW — side-by-side pick+reason→resume (SIG-03)

packages/pipeline/src/eisenbalm_pipeline/
├── agents/editor.py                        # ADD: return editor_confidence in state; extend payload builder
├── graph/state.py                          # ADD: editor_confidence: Optional[float] field (plain, sequential node — no reducer needed)
├── lib/agent_wrapper.py                    # ADD: retryCount plumbing IF real retry signal is wired (see Pitfall 1)
└── api/control.py or runs.py               # ADD: POST /issues/{run_id}/adjudicate (D-13 bridge)

convex/
├── schema.ts                                # ADD: agent_runs.retryCount (additive, D-03)
└── agentRuns.ts                             # ADD: retryCount arg to `completed` mutation
```

### Pattern 1: Component-per-row subscription for the drift strip (MON-04)
**What:** React hooks (`useQuery`) cannot be called a variable number of times inside one component body. To read `pipelineRuns:byRunId` for each of the trailing 8 runIds, render one small child component per runId, each with its own `useQuery` call.
**When to use:** Any time you need N independent Convex subscriptions for a dynamically-sized list.
**Example:**
```tsx
// Source: existing dashboard convention — see runControl.test.tsx / ReviewQueue.tsx
// pattern of rendering per-row subscriptions inside a shared parent.
function DriftStrip({ trailingRunIds, currentRunId }: { trailingRunIds: string[]; currentRunId: string }) {
  return (
    <div className="flex gap-1">
      {trailingRunIds.map(id => <DriftBar key={id} runId={id} />)}
      <DriftBar runId={currentRunId} highlighted />
    </div>
  )
}
function DriftBar({ runId, highlighted }: { runId: string; highlighted?: boolean }) {
  const run = useQuery(api.pipelineRuns.byRunId, { runId })  // reliably populated, unlike runs.cost
  const cost = parseCostJson(run?.cost).total
  // ...render bar using cost + run?.durationMs
}
```
Alternative if a single round-trip is preferred: add one new trivial Convex query (e.g. `pipelineRuns:byRunIds` accepting `runId: v.array(v.string())`) — this is a **new query function**, not a new table, and is consistent with D-08's "no new table" constraint.

### Pattern 2: Section-agentKey mapping is already 1:1 (MON-03 / D-07)
**What:** QA's `_extract_sections()` (agents/qa/__init__.py) produces section IDs `origin_story`, `problem`, `founder_bio`, `case_study`, `game`, `bonus` — these are byte-identical to `SECTION_WRITERS`/`RE_ROLLABLE` agentKeys used by `rerun_agent`. No new lookup table is needed; `qaCorrections.sectionName` can be used directly as the re-roll `agent_key` path param.
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py:104-111
return {
    "origin_story": _body_to_text(origin.get("body", "") or ""),
    "problem":      _body_to_text(problem.get("body", "") or ""),
    "founder_bio":  _body_to_text(founder.get("body", "") or ""),
    "case_study":   _body_to_text(case_st.get("body", "") or ""),
    "game":         game.get("description", "") or "",
    "bonus":        _body_to_text(bonus.get("body", "") or ""),
}
```

### Pattern 3: Reuse the shared open-finding predicate (D-05/D-07)
```ts
// Source: apps/dispatch-control/lib/galley/findingState.ts (Phase 33 Pitfall 9)
export function isOpenFinding(row: {
  accepted?: boolean
  resolution?: 'accepted' | 'dismissed' | null
}): boolean {
  return row.accepted !== true && row.resolution == null
}
```
Filter `qaCorrections.byRunId(runId)` through this before grouping by `sectionName`/`severity` for both the strength score (D-05) and flag counts (D-07). Do NOT re-derive `accepted !== true` inline (documented Pitfall — misses `resolution: 'dismissed'`).

### Pattern 4: Gate-1-paused reactive signal (SIG-03 / D-12)
```ts
// pipelineRuns.byRunId already returns { status, completedAt, awaitingHumanAt, ... }
const run = useQuery(api.pipelineRuns.byRunId, { runId })
const isPausedAtGate1 = run?.status === 'awaiting-review' && run?.completedAt == null
```
This is reliable because the ONLY two write sites that ever set `status: 'awaiting-review'` are:
- `editor.py` (Gate 1 interrupt) — writes `{status: 'awaiting-review', awaitingHumanAt}`, never `completedAt`.
- `publisher/__init__.py` (finished-pipeline review gate) — writes `{status: 'awaiting-review', completedAt, durationMs, cost, sanityIssueId}`, always with `completedAt`.

And there is exactly one `interrupt()` call site in the entire graph (`agents/editor.py`, inside `editor_gate_1`) — confirmed via full-repo grep of `graph/builder.py` and every agent module. No other node can produce this state.

### Anti-Patterns to Avoid
- **Reading `runs.cost`/`runs.durationMs` for anything.** Confirmed by exhaustive grep: these fields are declared in `convex/schema.ts` and read by `CostRollup.tsx`/`RunDetail.tsx`/`RunsTable.tsx`/`ReviewQueue.tsx`, but no mutation anywhere ever sets them (`runs:updateStatus`'s args don't even accept `cost`/`durationMs`, and `pipelineRuns:updateStatus`'s mirror-into-`runs` block only copies `status` and `completedAt`). This looks like a pre-existing, unrelated bug in the OBS-04/RUN-06 cost rollup — out of this phase's scope to fix, but the drift strip must not build on the same broken assumption. Use `pipelineRuns.cost`/`pipelineRuns.durationMs` instead (confirmed populated).
- **Assuming `agent_runs` retries already happen.** They don't. See Pitfall 1.
- **Threading the operator's adjudication `reason` into the LangGraph `Command(resume=...)` payload.** The `deliberationEvents.eventType` union is FROZEN (explicit comment in `convex/deliberationEvents.ts`) — do not add a new literal. Log the reason via `audit_log` (free-form `action`/`before`/`after` strings) instead.
- **Building the design brief's gate-badge (REAL/OBSCURE/SPECIFIC/TELLABLE) Signal Desk.** That's V3-DEF-02, explicitly deferred. The stale design README predates this codebase's actual candidate-selection implementation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Vertical DAG layout | A custom layout algorithm | `@dagrejs/dagre` with `rankdir: 'TB'` (already configured in `useGraphLayout.ts`) | Already exists, already vertical, zero change needed |
| Open-finding filtering | A new `resolution == null` check per screen | `lib/galley/findingState.ts::isOpenFinding` | Single source of truth (Phase 33 Pitfall 9); re-deriving inline is a documented anti-pattern |
| Cost JSON parsing | A new parser for `pipelineRuns.cost`/`runs.cost` JSON | `apps/dispatch-control/lib/costRollup.ts::parseCostJson` | Already handles the `{total, agents}` shape and malformed-JSON fallback |
| Per-section re-run | A new re-run endpoint | `POST /runs/{run_id}/agents/{agent_key}/rerun` (`control.py::rerun_agent`) | Already does the checkpoint-fork + `aupdate_state(as_node=...)` + Sanity re-write dance correctly (Pitfall 2 in that code: never calls `ainvoke(None)` after) |
| Resuming a paused run | A new resume mechanism | `POST /run/{run_id}/resume` (`runs.py::resume_run`) | Already does the `state.next`-emptiness paused-check and `Command(resume=...)` re-invoke |

**Key insight:** Every mechanical piece this phase needs (layout, filtering, cost parsing, re-run, resume) already exists and is tested. The actual net-new work is: (1) small additive Python state/payload plumbing (confidence, retryCount — if pursued), (2) a new thin Clerk-guarded bridge endpoint, and (3) frontend composition/visual work. Resist the temptation to re-implement any of the above from scratch.

## Common Pitfalls

### Pitfall 1: `retryCount` has no real data source yet
**What goes wrong:** Shipping a schema field that always reads 0, silently, forever — and the operator learns to distrust the retry chip because it never lights up even when a node clearly took multiple LLM attempts.
**Why it happens:** CONTEXT.md's D-03 conflates two unrelated concepts: (a) `AgentToolCallLimitExceeded.attempts` in `agents/_wrapper.py` — the Scout/Researcher tool-call iteration count (AGT-18), only relevant to 2 of ~15 agentKeys, and only fires on a hard *failure*; and (b) the actual node-lifecycle wrapper that writes `agent_runs` — `lib/agent_wrapper.py::wrap_agent_node` — which has **zero retry logic**: any exception → `agentRuns:failed` → re-raise → run ends. The only real retry that could plausibly map to "did this node need a second attempt" is the silent one-shot regenerate-on-schema-miss inside `lib/openrouter_client.py::acomplete()` (invoke-error retry + schema-miss retry, each capped at one), but its result carries no flag back to the caller today.
**How to avoid:** Decide explicitly in planning: either (a) plumb a real 0/1 "needed regenerate" signal out of `acomplete()` → through each agent's return → through `wrap_agent_node` → into `agentRuns:completed`, or (b) ship the field as always-0 and document that clearly as a placeholder for a future retry mechanism. Do not describe this as "already surfaced."
**Warning signs:** Any task description that says "read the existing attempts value" without specifying which of the two unrelated mechanisms it means.

### Pitfall 2: Gate-1 `confidence` does not exist in Convex
**What goes wrong:** Building a "confidence meter" UI against a `deliberationEvents` payload field that is never written, so the meter is permanently empty/zero for every run, old and new.
**Why it happens:** `agents/editor.py::_editor_decision_payload` (the function wired via `@agent_node(emit_event="editor-decision", payload_builder=_editor_decision_payload)`) returns exactly `{"winner": ..., "rationale": ...}`. `confidence` is a local variable inside `editor_gate_1`, used only for the interrupt-decision math, and is never added to the returned state dict or the payload. This matches `docs/API_CONTRACTS.md §3.4`'s documented contract exactly — it is not a doc/code drift, it's a genuine, always-been-there gap.
**How to avoid:** Add `editor_confidence: Optional[float]` to `DispatchState` (plain field, no Annotated reducer needed — `editor_gate_1` runs once, sequentially, not in the parallel fan-out), return it from `editor_gate_1`, read it in `_editor_decision_payload`, and amend `API_CONTRACTS.md §3.4` + §7 first (contract-first, per CLAUDE.md). `runner_up_notes` is already in state (`state["runner_up_notes"]`) and can be added to the payload with zero additional plumbing.
**Warning signs:** Any assumption that `deliberationEvents` rows for `eventType: 'editor-decision'` already contain more than `{winner, rationale}`.

### Pitfall 3: `pitchLog` does not carry Advocate data
**What goes wrong:** Querying `pitchLog.byRunId` expecting `advocateScore`/`advocateArgument`/`primaryConcern` fields and getting `undefined` for all of them.
**Why it happens:** `pitchLog`'s schema (`convex/schema.ts` ~L110) only has `charityName`, `charityLocation`, `charityWebsite`, `assetRange`, `focusArea`, `scoutSummary`, `selected`. The Advocate's data is written separately by `agents/advocate.py` to `deliberationEvents` with `eventType: 'advocate-argument'`, `charityId` set, and `payload` = `json.dumps({charityName, score, argument, keyStrengths, primaryConcern})`.
**How to avoid:** SIG-01's candidate slate must fetch both `pitchLog.byRunId(runId)` and `deliberationEvents.byRunIdAndType(runId, 'advocate-argument')`, then join client-side on `charityId` (or `charityName` as fallback — advocate.py itself has a documented history of name-matching fragility, see its "positional alignment... fallback to slugified-name map" comment; charityId is safer where both rows have it).
**Warning signs:** Any component that renders advocate score/argument/concern reading only from a `pitchLog` row.

### Pitfall 4: `status === 'awaiting-review'` is ambiguous — but disambiguable
**What goes wrong:** Treating every `awaiting-review` run as either "needs Gate-1 adjudication" or "needs final review/publish," when both states share the exact same status literal.
**Why it happens:** Both `editor.py` (Gate-1 interrupt) and `publisher/__init__.py` (finished-pipeline review gate) write `pipelineRuns:updateStatus` with `status: 'awaiting-review'`. Phase 30's `AwaitingYouInbox.tsx` explicitly documents this ambiguity in a comment and punts disambiguation to this phase.
**How to avoid:** Use `completedAt` as the disambiguator — set only by the Publisher's write, never by the Gate-1 write. `status === 'awaiting-review' && completedAt == null` ⇒ Gate-1-paused (enter Signal Desk adjudication). `status === 'awaiting-review' && completedAt != null` ⇒ finished, awaiting Review Desk decision (existing Phase 26/31/34 flow, unchanged).
**Warning signs:** Any new UI branch that keys off `status` alone without also checking `completedAt`.

### Pitfall 5: `runs.cost` / `runs.durationMs` are dead fields
**What goes wrong:** The drift strip (or any new code) reads `run.cost`/`run.durationMs` off a `runs` table row and gets `undefined` for every run, silently.
**Why it happens:** Confirmed by exhaustive grep across `convex/*.ts` and every Python call site: no mutation ever writes to these two fields on the `runs` table. `runs:create`'s args don't accept them; `runs:updateStatus`'s args don't accept them (`{runId, status, completedAt, errorMessage, pipelineSecret}` only); `pipelineRuns:updateStatus`'s "mirror into runs" block only copies `status` and `completedAt`. This appears to be a pre-existing bug affecting `CostRollup.tsx`/`RunDetail.tsx`/`RunsTable.tsx`/`ReviewQueue.tsx`/`runs:monthToDateCost` (RUN-06) today — out of scope to fix here, but must not be propagated into new MON-04 code.
**How to avoid:** For the drift strip, read `pipelineRuns:byRunId(runId).cost` / `.durationMs` per trailing run (these ARE reliably populated by the Publisher and by the failure/cancel paths) instead of `runs.cost`.
**Warning signs:** Copy-pasting `parseCostJson(run.cost)` from `CostRollup.tsx`/`RunsTable.tsx` without checking which table `run` came from.

### Pitfall 6: `editor_gate1` vs `editor_gate_1` naming mismatch in `model_versions`
**What goes wrong:** A model-chip lookup that does `state.model_versions[agentKey]` returns `undefined` specifically for the Gate-1 node.
**Why it happens:** Every LLM-calling agent writes `model_versions[<key>]` using a key that matches its `graph/builder.py` node/agentKey exactly (`calibrator`, `scout`, `advocate`, `chronicler`, `researcher`, `qa`, `editor_final`, and each of the 7 section writers) — except `editor.py`, which writes `model_versions["editor_gate1"]` (no underscore before `1`) while the node/agentKey is `editor_gate_1` (underscore). Confirmed via grep across every `agents/*.py` file.
**How to avoid:** If the model chip is sourced from `model_versions` (see Pitfall 7 below for the alternative), special-case `editor_gate_1 → editor_gate1` in the lookup, or fix the naming in `editor.py` while touching that file for the confidence plumbing (Pitfall 2) anyway.
**Warning signs:** A model chip that's blank specifically on the Editor Gate 1 node while every other node shows one.

### Pitfall 7: Model chip has no free lunch — recommend `agents.model` (config-at-rest), not per-run `model_versions`
**What goes wrong:** Trying to add a genuinely-per-run-accurate model field requires a NEW schema field on `agent_runs` (e.g. `model: v.optional(v.string())`), which contradicts CONTEXT.md D-03's explicit statement that `retryCount` is "the only schema change in the phase."
**Why it happens:** `state['model_versions']` (the per-run resolved model, AGT-17) lives only in the LangGraph Python state/checkpoint — it is never written to Convex. The `agents` table's `model` field (already read by `PipelineGraph.tsx` today) is the CURRENT active config, not necessarily what a specific historical run actually used if the config changed since.
**How to avoid:** Given the "one schema change" constraint, the pragmatic default is to keep using `agents.listForWorkspace`'s `model` field (already wired in v1) as the model chip source, accepting it reflects current config rather than exact historical model. Flag this explicitly as a known imprecision rather than silently accepting it. If the planner decides per-run accuracy matters enough to justify a second additive field, that's a legitimate call — but it should be an explicit decision, not a side effect of assuming `model_versions` is already exposed.
**Warning signs:** Any implementation that reads `agent_run_payloads.outputSnapshot` and greps for a model string inside the truncated (~2000 char) JSON blob — fragile, since `model_versions` may not survive truncation depending on key ordering in the ~2000-char window.

### Pitfall 8: 3-gate / candidate-gate-badge Signal Desk vision is stale
**What goes wrong:** Building toward the fuller `docs/design/dispatch-control-v2/README.md` vision (3 code-gate diamonds including "Verify Candidates"; Signal Desk gate badges REAL/OBSCURE/SPECIFIC/TELLABLE; verification strip domain/EIN/press) because the design doc is the "binding" canonical reference.
**Why it happens:** That design brief predates this codebase's actual candidate-selection implementation. There is no "Verify Candidates" node in `graph/builder.py` (only `verify_research` and `validate_sections` exist as code-gate nodes), and there is no REAL/OBSCURE/SPECIFIC/TELLABLE gate system anywhere in the pipeline — that's the deferred Signal Editor agent from `V3-DEF-02` in REQUIREMENTS.md.
**How to avoid:** CONTEXT.md's D-02 and D-10 already correctly scope this phase down to what actually exists (2 gates; pitchLog+deliberationEvents-only candidate data). Trust CONTEXT.md's locked decisions over the design brief where they conflict — the design brief is aspirational/historical, CONTEXT.md is the current, negotiated scope.
**Warning signs:** A task or plan step that references "Verify Candidates" as a node, or `hookClaim`/gate badges/EIN verification as data to render.

## Code Examples

### Existing v1 graph query wiring (extend, don't replace)
```tsx
// Source: apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx:63-73
const agents = useQuery(api.agents.listForWorkspace, { workspace_id })
const latestRun = useQuery(api.runs.latest, { workspace_id })
const runId = latestRun?.runId
const agentRuns = useQuery(api.agentRuns.byRunId, runId ? { runId } : 'skip')
```

### Existing agent_runs write path (where retryCount would be added)
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py:140-171
try:
    result = await fn(state)
except Exception as exc:
    await convex_mutation_safe("agentRuns:failed", {..., "error": str(exc)})
    raise
agent_cost = get_cost_payload(run_id)["agents"].get(agent_key, {})
await convex_mutation_safe("agentRuns:completed", {
    "workspace_id": ws, "runId": run_id, "agentKey": agent_key,
    "completedAt": int(time.time() * 1000),
    "costUsd": agent_cost.get("usd", 0.0),
    "durationMs": agent_cost.get("duration_ms", 0),
    "tokensIn": agent_cost.get("tokens_in", 0),
    "tokensOut": agent_cost.get("tokens_out", 0),
    # retryCount would be added here if plumbed through (Pitfall 1)
})
```

### Existing resume endpoint (D-12/D-13 build around this, do not replace)
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/runs.py:425-467
@router.post("/run/{run_id}/resume")
async def resume_run(request: Request, run_id: str, body: ResumeBody) -> dict:
    _require_trigger_secret(request)   # server-to-server only — bridge must not expose this to the browser
    graph = _require_graph(request)
    config = {"configurable": {"thread_id": run_id}}
    state = await graph.aget_state(config)
    if not state or not state.next:
        raise HTTPException(status_code=409, detail=f"Run {run_id} is not paused (state.next is empty)")
    resume_payload = {"editorSelection": body.selection.charityName}
    # ... asyncio.create_task(graph.ainvoke(Command(resume=resume_payload), config=config))
```
`ResumeBody` is `{selection: {charityName: str}}` — no `reason` field. D-13's bridge should NOT try to thread `reason` through `Command(resume=...)` (the frozen `deliberationEvents` union can't carry a new eventType for it either) — log it via `audit_log` instead, then call this same resume path (either by importing and calling `resume_run`'s logic directly since it's in the same FastAPI process, or via an internal HTTP call).

### Existing re-run endpoint (D-06 — already does exactly what MON-03 needs)
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/control.py:467-591
@router.post("/runs/{run_id}/agents/{agent_key}/rerun")
async def rerun_agent(request, run_id, agent_key, claims = Depends(_require_clerk_jwt_control)) -> dict:
    if agent_key not in RE_ROLLABLE:  # RE_ROLLABLE = set(SECTION_WRITERS)
        raise HTTPException(422, ...)
    if run_row.get("status") == "running":
        raise HTTPException(409, "re-roll only on a finished/awaiting-review run")
    # fork checkpoint -> run bare node fn -> aupdate_state(as_node=agent_key) -> re-write Sanity draft
    # NEVER calls ainvoke(None) afterward (would re-run validate_sections/qa/editor_final/publisher)
```

## State of the Art

| Old Approach (elsewhere in the industry) | Current Approach (this codebase, Phase 23) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for run status | Convex `useQuery` live subscriptions | Phase 21-23 | No polling needed anywhere in either new screen |
| Manual DAG layout | `@dagrejs/dagre` auto-layout | Phase 23 | Vertical spine is a styling/data upgrade, not a layout rewrite |

**Deprecated/outdated:** None relevant — this phase builds on the most recent (Phase 23/33/34) dashboard conventions, which are all still current.

## Open Questions

1. **How should `retryCount` actually be populated (Pitfall 1)?**
   - What we know: no existing signal cleanly maps to "this agent node was retried."
   - What's unclear: whether the planner wants to invest in wiring `acomplete()`'s regenerate-retry count through, or ship the field inert.
   - Recommendation: make this an explicit task-level decision in the plan, not an assumption. If wired, the natural touch points are `openrouter_client.acomplete()` (return a `retries: int` in the usage dict), each agent's return dict, and `wrap_agent_node`'s `agentRuns:completed` call.

2. **Should the model chip be per-run-accurate (`model_versions`, needs a 2nd schema field) or config-at-rest (`agents.model`, zero schema cost)?**
   - What we know: `agents.model` is already wired into v1 and is technically imprecise for old runs after a config change; `model_versions` is per-run-accurate but not in Convex today and would need an additive `agent_runs.model` field (contradicts D-03's "only schema change" framing).
   - What's unclear: how much the operator cares about historical accuracy vs. current simplicity.
   - Recommendation: default to `agents.model` (zero new schema, matches D-03's constraint) unless the planner explicitly decides accuracy is worth a second additive field.

3. **Batched vs. per-row Convex queries for the drift strip (MON-04)?**
   - What we know: 8 individual `pipelineRuns:byRunId` subscriptions (component-per-row) requires zero new backend code; a single `pipelineRuns:byRunIds` query requires one new, trivial Convex function.
   - What's unclear: whether 8 parallel subscriptions are considered "too heavy" per D-08's own escape hatch language.
   - Recommendation: ship the 8-subscription version first (matches D-08's "ship the client aggregate first" spirit most literally); add a batched query only if it proves necessary.

## Environment Availability

Skipped — this phase adds zero new external dependencies (no new npm packages, no new services, no new CLIs). Everything needed (React Flow, dagre, Convex, FastAPI, LangGraph) is already installed and deployed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (frontend) | Vitest (`apps/dispatch-control`), `convex-test` for Convex-layer mutation/query tests |
| Framework (pipeline) | pytest (`packages/pipeline`, `pytest-asyncio`) |
| Config file | `apps/dispatch-control/vitest.config.ts`; `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command (frontend) | `pnpm --filter dispatch-control test:unit -- <pattern>` |
| Quick run command (pipeline) | `cd packages/pipeline && uv run pytest -x -q -k <pattern>` |
| Full suite command (frontend) | `pnpm --filter dispatch-control test:unit` then `pnpm --filter dispatch-control build` (build catches type errors vitest misses — see CLAUDE.md/memory note) |
| Full suite command (pipeline) | `cd packages/pipeline && uv run pytest -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MON-01 | Spine renders dots/diamonds with cost/latency/model/retry chips | unit (component) | `pnpm --filter dispatch-control test:unit -- AgentNode` | ✅ `AgentNode.test.tsx` exists (extend it) |
| MON-01 | `pipelineTopology.ts` gate-key set / node list stays in sync with `graph/builder.py` | unit | `pnpm --filter dispatch-control test:unit -- pipelineTopology` | ✅ `pipelineTopology.test.ts` exists (extend for gate keys) |
| MON-02 | Handoff inspector shows upstream/downstream + raw-JSON toggle | unit (component) | new test file | ❌ Wave 0 — `AgentIOPanel.test.tsx` |
| MON-03 | Strength score computed correctly from open findings; re-run wired | unit | new test file + reuse `isOpenFinding` tests | ❌ Wave 0 — `WriterExpansion.test.tsx`; `qaCorrectionsResolution.test.ts` exists as a pattern reference |
| MON-04 | Drift strip compares current vs trailing-8 correctly, including n<8 case | unit | new test file | ❌ Wave 0 — `DriftStrip.test.tsx` |
| SIG-01 | Candidate slate joins pitchLog + advocate-argument correctly; primaryConcern never truncated | unit | new test file | ❌ Wave 0 — `CandidateSlate.test.tsx` |
| SIG-02 | Decision panel renders confidence/reasoning in full (no truncation) | unit | new test file | ❌ Wave 0 — `DecisionPanel.test.tsx` (also gate the Python-side plumbing: `test_editor_gate_1_resume.py` pattern extends to assert `editor_confidence` in state/payload) |
| SIG-03 | Gate-1-paused detection (`status==='awaiting-review' && !completedAt`); adjudication bridge audit-logs then resumes | integration (Python) + unit (frontend) | `cd packages/pipeline && uv run pytest -x -q -k adjudicate`; `pnpm --filter dispatch-control test:unit -- AdjudicationPanel` | ❌ Wave 0 — new `test_adjudication_bridge.py` (pattern: `test_editor_gate_1_resume.py`); new `AdjudicationPanel.test.tsx` |
| D-03 (retryCount) | `agentRuns:completed` accepts and stores `retryCount`; legacy rows read 0 | unit (Convex) | `pnpm --filter dispatch-control test:unit -- agentRuns` | ✅ `agentRuns.test.ts` exists (extend it — pattern already covers started/completed/failed/queueForRun) |

### Sampling Rate
- **Per task commit:** targeted `-k`/`--` pattern run (frontend or pipeline, whichever was touched)
- **Per wave merge:** full `pnpm --filter dispatch-control test:unit` + `pnpm --filter dispatch-control build`; full `cd packages/pipeline && uv run pytest -x -q`
- **Phase gate:** both full suites green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/dispatch-control/__tests__/AgentIOPanel.test.tsx` — covers MON-02 (no existing test file for this component)
- [ ] `apps/dispatch-control/__tests__/WriterExpansion.test.tsx` — covers MON-03
- [ ] `apps/dispatch-control/__tests__/DriftStrip.test.tsx` — covers MON-04
- [ ] `apps/dispatch-control/__tests__/CandidateSlate.test.tsx` — covers SIG-01
- [ ] `apps/dispatch-control/__tests__/DecisionPanel.test.tsx` — covers SIG-02
- [ ] `apps/dispatch-control/__tests__/AdjudicationPanel.test.tsx` — covers SIG-03 (frontend half)
- [ ] `packages/pipeline/tests/test_adjudication_bridge.py` — covers SIG-03 (backend half); use `test_editor_gate_1_resume.py` as the structural pattern
- [ ] `packages/pipeline/tests/agents/test_editor.py` extension — assert `editor_confidence` lands in returned state + `_editor_decision_payload` output (Pitfall 2)
- Framework install: none needed — all frameworks already present.

## Sources

### Primary (HIGH confidence — direct source inspection)
- `convex/schema.ts` (full read) — `agent_runs`, `agent_run_payloads`, `pitchLog`, `deliberationEvents`, `qaCorrections`, `pipelineRuns`, `runs`, `audit_log` table definitions
- `convex/agentRuns.ts`, `convex/pitchLog.ts`, `convex/qaCorrections.ts`, `convex/deliberationEvents.ts`, `convex/pipelineRuns.ts`, `convex/runs.ts`, `convex/auditLog.ts` — every read/write mutation and query referenced above
- `packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` and `lib/agent_wrapper.py` — both wrapper layers, confirmed which one writes `agent_runs` and that neither has retry logic
- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` (full read) — `EditorDecision`, `_editor_decision_payload`, interrupt/resume flow, confirmed `confidence` is never persisted
- `packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py` — confirmed advocate data goes to `deliberationEvents`, not `pitchLog`
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` — confirmed section-ID naming matches `SECTION_WRITERS` exactly
- `packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py` — confirmed the one-shot regenerate-retry mechanism and that it returns no retry-count signal
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py`, `graph/state.py` — confirmed topology, single `interrupt()` site, `model_versions` reducer
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py`, `api/control.py` — `resume_run`, `rerun_agent`, `_emit_audit`, `_require_clerk_jwt_control`, `_require_trigger_secret`
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/*.tsx`, `apps/dispatch-control/app/(dashboard)/signal-desk/page.tsx` — v1 implementation and stub
- `apps/dispatch-control/lib/galley/findingState.ts`, `apps/dispatch-control/lib/costRollup.ts` — reusable shared helpers
- `apps/dispatch-control/components/AwaitingYouInbox.tsx` — prior-art comment on the awaiting-review ambiguity this phase resolves
- `docs/API_CONTRACTS.md` §3.4, §3B.4 — documented contract shapes, confirmed to match actual code exactly (no drift)

### Secondary (MEDIUM confidence)
- `docs/design/dispatch-control-v2/README.md` — design intent for both screens; cross-checked against actual code and found to describe some not-yet-built (and now permanently deferred) elements (3rd gate, candidate-gate badges)

### Tertiary (LOW confidence)
- None — every finding in this document was verified against source code, not inferred.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all verified installed and in use
- Architecture: HIGH — every pattern cited is read directly from the current codebase
- Pitfalls: HIGH — each pitfall is backed by a direct grep/read showing the actual (not assumed) behavior

**Research date:** 2026-07-09
**Valid until:** 30 days (stable, internal-only codebase; no external API drift risk since no new dependencies)
