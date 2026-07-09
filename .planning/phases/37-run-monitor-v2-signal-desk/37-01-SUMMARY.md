---
phase: 37-run-monitor-v2-signal-desk
plan: 01
subsystem: api
tags: [convex, langgraph, fastapi, cost-tracking, contract-first]

# Dependency graph
requires:
  - phase: 23-forensics-live-progress
    provides: agent_runs table + wrap_agent_node lifecycle emission
  - phase: 5-agent-quality
    provides: editor_gate_1 interrupt flow + acomplete() cost recording
provides:
  - "§37 contract amendment (docs/API_CONTRACTS.md) covering retryCount, editor-decision confidence, and the adjudication bridge endpoint shape"
  - "DispatchState.editor_confidence + editor-decision payload confidence/runnerUpNotes (SIG-02 foundation)"
  - "agent_runs.retryCount populated honestly from the real acomplete() regenerate-retry signal (MON-01 foundation)"
affects: [37-02-adjudication-bridge, 37-03-run-monitor-spine-handoff, 37-04-run-monitor-strength-drift, 37-05-signal-desk]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first: docs/API_CONTRACTS.md §37 written before any schema/agent/endpoint code, matching §31-§36 house style"
    - "Honest additive plumbing: retryCount surfaces the real 0/1 acomplete() regenerate signal — no new retry infrastructure invented"

key-files:
  created: []
  modified:
    - docs/API_CONTRACTS.md
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
    - packages/pipeline/tests/agents/test_editor.py
    - convex/schema.ts
    - convex/agentRuns.ts
    - apps/dispatch-control/__tests__/agentRuns.test.ts
    - packages/pipeline/src/eisenbalm_pipeline/lib/cost.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py
    - packages/pipeline/tests/test_cost_double_count.py
    - packages/pipeline/tests/lib/test_openrouter_cost_capture.py
    - packages/pipeline/tests/test_agent_wrapper.py

key-decisions:
  - "retryCount sources honestly from acomplete()'s existing one-shot invoke-error retry and schema-miss regenerate (via a new `retries` field threaded through cost.py's AgentCost/record_cost/get_cost_payload) — no new node-retry mechanism was introduced, matching the Research Pitfall 1 correction"
  - "editor_confidence is a plain sequential DispatchState field (no Annotated reducer) since editor_gate_1 runs once, not in the phase-2 parallel fan-out"
  - "The adjudication bridge endpoint shape (§37.3) is documented in the contract only in this plan — its implementation is deferred to 37-02 per the plan's scope boundary"

# Metrics
duration: 20min
completed: 2026-07-09
requirements-completed: [MON-01, SIG-02]
---

# Phase 37 Plan 01: Contract and Data Foundations Summary

**Contract-first §37 amendment plus two small, honest additive plumbing changes: Gate-1 editor confidence now survives into the `editor-decision` Convex payload, and `agent_runs.retryCount` is populated from the real (not invented) `acomplete()` regenerate-retry signal.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-09
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- `docs/API_CONTRACTS.md` §37 documents all three Phase 37 data-contract changes (retryCount, editor-decision confidence/runnerUpNotes, the `POST /issues/{run_id}/adjudicate` bridge shape) before any downstream plan touches code
- `DispatchState.editor_confidence` persists `EditorDecision.confidence` (previously computed by `editor_gate_1` purely to decide whether to interrupt, then silently discarded); `_editor_decision_payload` now emits `confidence` + `runnerUpNotes` alongside `winner`/`rationale`
- `agent_runs.retryCount` is additive on both `convex/schema.ts` and the `completed` mutation; the pipeline sources it honestly from the one existing genuine retry signal — the one-shot invoke-error retry and schema-miss regenerate inside `acomplete()` — threaded through `cost.py`'s `AgentCost`/`record_cost`/`get_cost_payload` and into `wrap_agent_node`'s `completed` emit. Legacy rows and non-retrying nodes read 0/absent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend docs/API_CONTRACTS.md with §37** - `0325fac` (docs)
2. **Task 2: Persist Gate-1 editor confidence (SIG-02 foundation)** - `fc4aa74` (test, TDD RED→GREEN in one commit per plan's task grouping)
3. **Task 3: Add honest agent_runs.retryCount plumbing (MON-01 foundation)** - `0bc0672` (feat, TDD RED→GREEN across Convex + pipeline layers)

**Plan metadata:** (this commit) `docs: complete 37-01 plan`

_Note: Tasks 2 and 3 were executed test-first (RED confirmed via targeted `pytest`/`vitest` runs before implementation) but each task's test+implementation pair was committed together per the plan's `files_modified` grouping, not as separate RED/GREEN commits._

## Files Created/Modified
- `docs/API_CONTRACTS.md` - New §37 section (four subsections: retryCount, editor-decision confidence, adjudication bridge, read-model notes); amended §7 DispatchState list and the inline editor-decision payload example
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` - `editor_confidence: Optional[float]` added to `DispatchState`
- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` - `editor_gate_1` returns `editor_confidence`; `_editor_decision_payload` emits `confidence` + `runnerUpNotes`
- `packages/pipeline/tests/agents/test_editor.py` - Two new assertions (payload shape + `editor_gate_1` return value)
- `convex/schema.ts` - `agent_runs.retryCount: v.optional(v.number())`
- `convex/agentRuns.ts` - `completed` mutation accepts optional `retryCount`, conditionally spread into both patch and insert branches
- `apps/dispatch-control/__tests__/agentRuns.test.ts` - New `describe` block covering retryCount stored + legacy-omitted behavior
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` - `AgentCost.retries`; `record_cost(..., retries: int = 0)` accumulates
- `packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py` - `acomplete`'s structured path tracks a local `retries` flag (set on invoke-error retry OR schema-miss regenerate) and passes it to `record_cost`
- `packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` - `completed` emit includes `"retryCount": agent_cost.get("retries", 0)`
- `packages/pipeline/tests/test_cost_double_count.py`, `tests/lib/test_openrouter_cost_capture.py`, `tests/test_agent_wrapper.py` - RED-first coverage for the retries plumbing at each layer

## Decisions Made
- retryCount's data source is the exact one identified by Phase 37 research (Pitfall 1): the existing `acomplete()` one-shot invoke-error retry / schema-miss regenerate, NOT the unrelated `AgentToolCallLimitExceeded.attempts` concept. No new node-retry mechanism was added — `wrap_agent_node`'s exception→`agentRuns:failed`→re-raise path is untouched.
- `editor_confidence` is a plain sequential field (no `Annotated` reducer) since `editor_gate_1` executes once, sequentially — consistent with how `runner_up_notes`/`editor_decision` are already typed.
- Retained the plain-string `acomplete()` path's implicit `retries=0` (the default kwarg) rather than passing it explicitly, since no retry logic exists on that path.

## Deviations from Plan

None - plan executed exactly as written. All three tasks, their `must_haves`, and their acceptance criteria were implemented verbatim per the plan's interfaces section.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan touches contract docs, pipeline Python, and Convex schema/mutations only; no new environment variables or dashboard configuration.

## Next Phase Readiness

All three foundations Plans 37-02 through 37-05 depend on are in place:
- §37 contract is the binding reference for the adjudication bridge endpoint (37-02), the retryCount UI chip (37-03), and the confidence meter (37-05)
- `editor_confidence` is now readable off `deliberationEvents`'s `editor-decision` payload for Signal Desk's decision panel (37-05, SIG-02)
- `agent_runs.retryCount` is now populated (honestly, from real data) for the Run Monitor v2 forensic spine's per-node retry chip (37-03, MON-01)

Full verification suites green:
- `cd packages/pipeline && uv run pytest -x -q` → 497 passed, 36 skipped
- `pnpm --filter dispatch-control test:unit` → 424 passed, 2 todo (48 files passed, 1 skipped)
- `pnpm --filter dispatch-control build` → exit 0

No blockers for Wave 2 (37-02 adjudication bridge, depends on this plan's §37.3 contract).

---
*Phase: 37-run-monitor-v2-signal-desk*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 10 modified/created files confirmed present on disk; all 3 task commit hashes (`0325fac`, `fc4aa74`, `0bc0672`) confirmed present in `git log`.
