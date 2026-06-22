---
phase: 23-node-wrappers-read-only-dashboard
plan: "02"
subsystem: pipeline-instrumentation, convex-lifecycle
tags: [pipeline, agent-wrapper, convex, cost, observability, OBS-03, OBS-04, OBS-05]
dependency_graph:
  requires:
    - "23-01 (agentRuns Convex mutations: queueForRun/started/completed/failed/savePayload)"
  provides:
    - "wrap_agent_node() higher-order wrapper emitting lifecycle events to Convex"
    - "All 18 builder.add_node() calls wrapped with wrap_agent_node()"
    - "queueForRun emission at run start in api/runs.py"
    - "Per-agent input/output snapshots via agentRuns:savePayload"
  affects:
    - "packages/pipeline/src/eisenbalm_pipeline/graph/builder.py"
    - "packages/pipeline/src/eisenbalm_pipeline/api/runs.py"
tech_stack:
  added: []
  patterns:
    - "Higher-order function wrapping async LangGraph node functions"
    - "Read-only cost access: get_cost_payload() never record_cost() (Pitfall 1 guard)"
    - "workspace_id resolution: state > WORKSPACE_ID env > 'eisenbalm' literal"
    - "Per-agent input key whitelist to avoid multi-KB blob serialization"
    - "TDD: failing tests first, then GREEN implementation"
key_files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py
    - packages/pipeline/tests/test_agent_wrapper.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
decisions:
  - "record_cost never imported or invoked — AST-verified; only get_cost_payload() is called (read-only)"
  - "validate_sections wrapped (non-LLM join node): emits started/completed with costUsd=0.0 for debug visibility"
  - "Input snapshots use per-agent key whitelist (not full state) to avoid sending multi-KB research blobs"
  - "queueForRun insertion placed after runs:create and before load_run_config to keep node sets in sync"
  - "SECTION_WRITERS imported from builder to keep queued-node list in lockstep with DESIGNAGENT_SUPPRESSED"
metrics:
  duration: "10 min"
  completed_date: "2026-06-22"
  tasks: 2
  files: 4
---

# Phase 23 Plan 02: Node Wrappers + Run-Start Queuing Summary

`wrap_agent_node()` instruments every LangGraph node with queued→running→done/failed lifecycle events, cost-so-far, and I/O snapshots to Convex. All 18 builder nodes wrapped; run-start pre-populates agent_runs as queued.

## What Was Built

**Task 1 — agent_wrapper.py (TDD):**

- `wrap_agent_node(agent_key, fn)` returns an async callable that:
  1. Emits `agentRuns:started` before awaiting `fn(state)`
  2. On success: emits `agentRuns:completed` (with `get_cost_payload` read-only cost) + `agentRuns:savePayload` (truncated I/O snapshot)
  3. On exception: emits `agentRuns:failed` with `str(exc)`, then bare `raise` (LangGraph semantics unchanged)
- `_resolve_workspace(state)`: state > `WORKSPACE_ID` env > `"eisenbalm"` fallback
- `_snapshot_input(agent_key, state)`: per-agent key whitelist (e.g. scout→`["style_brief"]`) → JSON truncated to 2000 chars
- `_snapshot_output(result)`: full result dict → JSON truncated to 2000 chars
- Module docstring states "READ-ONLY cost: calls get_cost_payload only; never record_cost (Pitfall 1)"
- 3 async pytest tests (success path, failure path, no-cost node) — all pass

**Task 2 — builder.py + api/runs.py wiring:**

- `builder.py`: imports `wrap_agent_node`; all 18 `builder.add_node()` calls wrapped — calibrator through publisher, including the conditional `design` node inside `if not _SUPPRESSED:`
- `api/runs.py`: imports `SECTION_WRITERS` from builder; after `runs:create`, emits `agentRuns:queueForRun` with the full agent key list composed as `["calibrator","scout","advocate","editor_gate_1","chronicler","researcher","verify_research", *SECTION_WRITERS, "validate_sections","qa","editor_final","publisher"]`
- No `add_edge` calls changed (13 edges unchanged)
- 13 builder/graph/wrapper tests pass; Pydantic serialisation warnings are pre-existing (out of scope)

## Deviations from Plan

None - plan executed exactly as written.

## Acceptance Criteria Verification

- `grep -c "record_cost" agent_wrapper.py` = 4 (all in comments — AST confirms no import or call)
- `grep -c "get_cost_payload" agent_wrapper.py` = 3 (import line + one call + comment)
- All 4 literal mutations present: `agentRuns:started`, `agentRuns:completed`, `agentRuns:failed`, `agentRuns:savePayload`
- `WORKSPACE_ID` and `"eisenbalm"` present
- `def wrap_agent_node` present; except block contains bare `raise`
- `uv run pytest tests/test_agent_wrapper.py -x` exits 0 (3 passed)
- `wrap_agent_node(` count in builder.py = 18
- builder.py contains import of `wrap_agent_node`
- api/runs.py contains `agentRuns:queueForRun` and imports `SECTION_WRITERS`
- 13 builder/graph/wrapper tests pass (no regressions)

## Known Stubs

None — all lifecycle events wire to real Convex mutations from Plan 23-01. Cost data flows from the existing `record_cost()` path via `get_cost_payload()`. The I/O snapshot uses real state fields.

## Self-Check: PASSED

Files exist:
- packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py (FOUND)
- packages/pipeline/tests/test_agent_wrapper.py (FOUND)
- packages/pipeline/src/eisenbalm_pipeline/graph/builder.py (modified, FOUND)
- packages/pipeline/src/eisenbalm_pipeline/api/runs.py (modified, FOUND)

Commits exist:
- e2e49e1 (Task 1: agent_wrapper.py + tests) (FOUND)
- 6e5bf36 (Task 2: builder.py + runs.py wiring) (FOUND)
