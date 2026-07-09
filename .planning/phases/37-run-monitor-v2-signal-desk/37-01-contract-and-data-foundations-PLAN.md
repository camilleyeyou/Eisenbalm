---
phase: 37-run-monitor-v2-signal-desk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
  - packages/pipeline/tests/agents/test_editor.py
  - convex/schema.ts
  - convex/agentRuns.ts
  - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/cost.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py
  - apps/dispatch-control/__tests__/agentRuns.test.ts
autonomous: true
requirements: [MON-01, SIG-02]
must_haves:
  truths:
    - "The Gate-1 editor-decision deliberation event carries the editor's confidence value (previously computed then discarded)"
    - "agent_runs rows can store a per-node retryCount; genuine acomplete regenerate-retries light it, legacy rows read 0"
    - "docs/API_CONTRACTS.md §37 documents all three Phase 37 data-contract changes before any code lands"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§37 contract for retryCount field, editor-decision confidence, adjudication bridge endpoint"
      contains: "## §37"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/editor.py"
      provides: "editor_confidence persisted into state + editor-decision payload"
      contains: "editor_confidence"
    - path: "convex/schema.ts"
      provides: "agent_runs.retryCount optional field"
      contains: "retryCount"
    - path: "convex/agentRuns.ts"
      provides: "completed mutation accepts optional retryCount"
      contains: "retryCount"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py"
      to: "convex/agentRuns.ts completed mutation"
      via: "agentRuns:completed retryCount arg"
      pattern: "retryCount"
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/editor.py"
      to: "deliberationEvents editor-decision payload"
      via: "_editor_decision_payload confidence key"
      pattern: "confidence"
---

<objective>
Land the three contract-first data foundations Phase 37 consumers depend on, per the four research scoping corrections. No UI in this plan.

1. **Contract §37** (docs/API_CONTRACTS.md) — documents ALL Phase 37 shape changes up front (agent_runs.retryCount, editor-decision confidence, the adjudication bridge endpoint). CLAUDE.md hard rule: the contract precedes the code.
2. **Gate-1 confidence persistence** (SIG-02) — `editor_gate_1` computes `decision.confidence` today then discards it. Persist it: add `editor_confidence` to DispatchState, return it, and emit it (+ `runnerUpNotes`) in the editor-decision payload.
3. **agent_runs.retryCount** (MON-01) — additive optional field, populated HONESTLY from the only genuine retry signal that exists (the one-shot regenerate-on-schema-miss inside `acomplete()`), threaded through the existing `record_cost` → cost-payload → wrapper path. NO new node-retry infrastructure — legacy rows and non-retrying nodes read 0.

Purpose: every downstream Phase 37 screen reads these; they must exist and be correct first.
Output: amended contract + additive Convex schema/mutation + additive pipeline state/payload/plumbing, all RED-first.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/37-run-monitor-v2-signal-desk/37-CONTEXT.md
@.planning/phases/37-run-monitor-v2-signal-desk/37-RESEARCH.md

<interfaces>
<!-- Executor: use these exact shapes. Do NOT explore for them. -->

editor.py TODAY (packages/pipeline/src/eisenbalm_pipeline/agents/editor.py):
- `_editor_decision_payload(state)` returns exactly `{"winner": winning["name"], "rationale": state["editor_decision"]}` (~L226).
- `editor_gate_1` local `decision: EditorDecision` has `decision.confidence: float` (0.0-1.0), `decision.runnerUpNotes: str`.
- `editor_gate_1` return dict (~L402) spreads `**state` plus winning_charity/editor_decision/runner_up_notes/deliberation_transcript/model_versions. `confidence` is NEVER added → discarded.

DispatchState (packages/pipeline/src/eisenbalm_pipeline/graph/state.py:162), plain sequential fields:
```python
    deliberation_transcript: Optional[str]
    editor_decision: Optional[str]
    runner_up_notes: Optional[str]     # editor_confidence goes right after this
```

acomplete (packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py): structured path does a one-shot regenerate on schema-miss (~L199-212) and on invoke-error (~L196-198), then calls `record_cost(run_id, agent_id, tokens_in=..., tokens_out=..., usd=...)` (~L221). Plain-string path calls record_cost at ~L235. Returns `(parsed, usage)`.

cost.py (packages/pipeline/src/eisenbalm_pipeline/lib/cost.py):
- `AgentCost` TypedDict: `{tokens_in, tokens_out, usd, duration_ms}` (~L44).
- `record_cost(run_id, agent_name, *, tokens_in=0, tokens_out=0, usd=0.0, duration_ms=0)` accumulates into `_store[run_id][agent_name]` (~L142).
- `get_cost_payload(run_id)` returns `{"total": ..., "agents": {agentKey: {tokens_in, tokens_out, usd, duration_ms}}}` (~L171).

agent_wrapper.py completed emit (packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py:159):
```python
agent_cost = get_cost_payload(run_id)["agents"].get(agent_key, {})
await convex_mutation_safe("agentRuns:completed", {
    "workspace_id": ws, "runId": run_id, "agentKey": agent_key,
    "completedAt": int(time.time() * 1000),
    "costUsd": agent_cost.get("usd", 0.0),
    "durationMs": agent_cost.get("duration_ms", 0),
    "tokensIn": agent_cost.get("tokens_in", 0),
    "tokensOut": agent_cost.get("tokens_out", 0),
})
```

convex/agentRuns.ts `completed` internalMutation (~L95): args `{workspace_id, runId, agentKey, completedAt, costUsd, durationMs, tokensIn, tokensOut}` — patch-or-insert upsert on (runId, agentKey).

convex/schema.ts `agent_runs` table (~L322): existing optional fields costUsd/durationMs/tokensIn/tokensOut/error. API_CONTRACTS highest existing section is §36; add §37.
</interfaces>
</context>

<sequencing_note>
This phase's waves run SEQUENTIALLY in the main checkout — NO worktrees (Phase 35 worktree-strand lesson; Phase 36 did this successfully). This is Wave 1; nothing else in Phase 37 may start until it lands on master.
</sequencing_note>

<tasks>

<task type="auto">
  <name>Task 1: Amend docs/API_CONTRACTS.md with §37 (contract-first — precedes all Phase 37 code)</name>
  <read_first>
    - docs/API_CONTRACTS.md (§3.4 editor-decision ~L681-690; §7 DispatchState ~L1916-1947; §36 tail ~L3302-3517 for the additive-changes house style)
    - .planning/phases/37-run-monitor-v2-signal-desk/37-RESEARCH.md (Pitfalls 1, 2, 4, 5)
  </read_first>
  <action>
    Append a new top-level section `## §37 — Run Monitor v2 + Signal Desk (Phase 37)` after §36, matching the §35/§36 additive-house style (intro paragraph: "all changes additive; no field renames"). Add these subsections with the EXACT shapes downstream plans implement:

    - **§37.1 — `agent_runs.retryCount` (additive optional)**: `retryCount: v.optional(v.number())` on the `agent_runs` table and as an optional arg on `agentRuns:completed`. Semantics: count of genuine LLM regenerate-retries for that node in that run (the one-shot regenerate-on-schema-miss / invoke-error inside `acomplete()`); legacy rows and non-retrying nodes = 0/absent. State explicitly: NO new node-retry mechanism is introduced (Research Pitfall 1) — this surfaces the retry signal that already occurs inside `acomplete()`.
    - **§37.2 — editor-decision payload gains `confidence` + `runnerUpNotes` (amends §3.4)**: the `deliberationEvents:insert` `editor-decision` payload becomes `{winner, rationale, confidence, runnerUpNotes}` where `confidence` is the float `EditorDecision.confidence` (0.0-1.0) previously discarded (Research Pitfall 2). Also record: `DispatchState` (§7) gains `editor_confidence: Optional[float]` (plain sequential field, no reducer).
    - **§37.3 — `POST /issues/{run_id}/adjudicate` (Clerk-guarded adjudication bridge)**: request body `{selection: {charityName: str}, reason: str}`; guarded by `_require_clerk_jwt_control` (NOT the trigger secret); behavior: (a) 409 unless the run is paused-at-Gate-1, (b) `_emit_audit` the operator pick + reason ("nothing silent"), (c) invoke the existing resume machinery server-side with the chosen `charityName`. The operator NEVER handles the trigger secret; `reason` is logged via `audit_log` only (the `deliberationEvents.eventType` union is FROZEN — Research anti-pattern).
    - **§37.4 — Read-model notes (no new tables/queries)**: (a) the MON-04 drift strip aggregates `pipelineRuns:byRunId(runId).cost`/`.durationMs` per trailing run — `runs.cost`/`runs.durationMs` are declared-but-never-written dead fields, do NOT read them (Research Pitfall 5). (b) SIG-01's candidate slate is a client-side JOIN of `pitchLog:byRunId` (scoutSummary) + `deliberationEvents:byRunIdAndType('advocate-argument')` (payload JSON `{charityName, score, argument, keyStrengths, primaryConcern}`, row keyed by `charityId`) — advocate data is NOT in pitchLog (Research Pitfall 3). (c) Gate-1-paused detection: `status === 'awaiting-review' && completedAt == null` (Research Pitfall 4).
  </action>
  <verify>
    <automated>grep -q "## §37" docs/API_CONTRACTS.md && grep -q "retryCount" docs/API_CONTRACTS.md && grep -q "/issues/{run_id}/adjudicate" docs/API_CONTRACTS.md && grep -q "editor_confidence" docs/API_CONTRACTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "## §37" docs/API_CONTRACTS.md` returns 1
    - All present: `grep -q "retryCount" docs/API_CONTRACTS.md`, `grep -q "editor_confidence" docs/API_CONTRACTS.md`, `grep -q "/issues/{run_id}/adjudicate" docs/API_CONTRACTS.md`, `grep -q "confidence" docs/API_CONTRACTS.md`
    - The §37 text names `pipelineRuns:byRunId` for drift (not `runs.cost`): `grep -q "pipelineRuns:byRunId" docs/API_CONTRACTS.md`
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Persist Gate-1 editor confidence (SIG-02 foundation)</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py (`_editor_decision_payload` ~L226; `editor_gate_1` return ~L402)
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py (DispatchState ~L162-177)
    - packages/pipeline/tests/agents/test_editor.py (existing EditorDecision-based tests)
  </read_first>
  <behavior>
    - Test: `_editor_decision_payload(state)` output includes key `confidence` equal to `state["editor_confidence"]` and key `runnerUpNotes` equal to `state["runner_up_notes"]`, while STILL including `winner` and `rationale`.
    - Test: after `editor_gate_1` runs (no-interrupt path, deterministic winner), the returned state dict has `editor_confidence` set to the `EditorDecision.confidence` float (e.g. 0.9).
  </behavior>
  <action>
    1. In graph/state.py add `editor_confidence: Optional[float]` to the DispatchState TypedDict immediately after `runner_up_notes: Optional[str]` (plain field — `editor_gate_1` runs once sequentially, no Annotated reducer).
    2. In editor.py `editor_gate_1`, add `"editor_confidence": decision.confidence` to the returned dict (alongside `runner_up_notes`).
    3. In editor.py `_editor_decision_payload`, return `{"winner": winning.get("name", "<unknown>"), "rationale": state.get("editor_decision", ""), "confidence": state.get("editor_confidence"), "runnerUpNotes": state.get("runner_up_notes", "")}`.
    4. Add the two tests above to tests/agents/test_editor.py (reuse the existing FakeOpenRouter/EditorDecision fixtures already in the file).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_editor.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "editor_confidence" packages/pipeline/src/eisenbalm_pipeline/graph/state.py`
    - `grep -q "editor_confidence" packages/pipeline/src/eisenbalm_pipeline/agents/editor.py`
    - `grep -q '"confidence"' packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` AND `grep -q '"runnerUpNotes"' packages/pipeline/src/eisenbalm_pipeline/agents/editor.py`
    - `cd packages/pipeline && uv run pytest tests/agents/test_editor.py -x -q` exits 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add honest agent_runs.retryCount plumbing (MON-01 foundation)</name>
  <read_first>
    - convex/schema.ts (`agent_runs` table ~L322)
    - convex/agentRuns.ts (`completed` internalMutation ~L95-136)
    - apps/dispatch-control/__tests__/agentRuns.test.ts (existing started/completed/failed cases)
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py (~L190-238 retry + record_cost)
    - packages/pipeline/src/eisenbalm_pipeline/lib/cost.py (AgentCost ~L44; record_cost ~L142; get_cost_payload ~L171)
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py (completed emit ~L159-171)
  </read_first>
  <behavior>
    - Convex test: `agentRuns:completed` called with `retryCount: 1` stores 1 on the row; called WITHOUT `retryCount` leaves it undefined (legacy compat) and the row still upserts.
  </behavior>
  <action>
    Convex side:
    1. convex/schema.ts: add `retryCount: v.optional(v.number()),  // Phase 37 §37.1 — genuine LLM regenerate-retries, legacy = 0/absent` to the `agent_runs` table.
    2. convex/agentRuns.ts `completed`: add `retryCount: v.optional(v.number())` to args; in BOTH the patch and insert branches include the field conditionally: `...(args.retryCount !== undefined ? { retryCount: args.retryCount } : {})`.
    3. apps/dispatch-control/__tests__/agentRuns.test.ts: add the behavior test above (follow the existing completed-case convex-test pattern in the file).

    Pipeline side (honest source — thread the acomplete regenerate signal through the existing cost path, NO new infra):
    4. cost.py: add `retries: int` to the `AgentCost` TypedDict; add `retries: int = 0` kwarg to `record_cost` and accumulate `existing.get("retries", 0) + retries`; include `retries` in the per-agent dict emitted by `get_cost_payload`.
    5. openrouter_client.py `acomplete`: track a local `retries = 0`; set `retries = 1` when EITHER the invoke-error retry (~L196) OR the schema-miss regenerate (~L199) path executes; pass `retries=retries` into the structured-path `record_cost(...)` call (~L221). The plain-string path passes `retries=0`.
    6. agent_wrapper.py completed emit: add `"retryCount": agent_cost.get("retries", 0)` to the `agentRuns:completed` payload dict.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- agentRuns</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "retryCount" convex/schema.ts` AND `grep -q "retryCount" convex/agentRuns.ts`
    - `grep -q "retries" packages/pipeline/src/eisenbalm_pipeline/lib/cost.py`
    - `grep -q "retries" packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py`
    - `grep -q "retryCount" packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py`
    - `pnpm --filter dispatch-control test:unit -- agentRuns` exits 0
    - `cd packages/pipeline && uv run pytest tests/ -x -q -k "cost or wrapper or editor"` exits 0 (no regression in cost/wrapper plumbing)
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest -x -q` green (confidence + cost/wrapper additions)
- `pnpm --filter dispatch-control test:unit` green (agentRuns retryCount)
- `pnpm --filter dispatch-control build` exits 0 (schema/mutation type-check)
- docs/API_CONTRACTS.md §37 present with all three shapes documented BEFORE any consumer plan runs
</verification>

<success_criteria>
- §37 exists in the contract and documents retryCount, editor-decision confidence, and the adjudication bridge endpoint
- editor-decision payload now carries confidence + runnerUpNotes; DispatchState carries editor_confidence
- agent_runs.retryCount stores honestly-sourced retries; legacy rows read 0; no new retry infrastructure added
- Both suites green + dispatch-control build exits 0
</success_criteria>

<output>
After completion, create `.planning/phases/37-run-monitor-v2-signal-desk/37-01-SUMMARY.md`
</output>
