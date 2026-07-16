---
phase: 46-signal-editor-candidate-verification
plan: 06
subsystem: pipeline-graph
tags: [langgraph, graph-wiring, convex, testing]

# Dependency graph
requires:
  - phase: 46-04
    provides: "agents/signal_editor.py — @agent_node signal_editor (callable, not yet graph-wired)"
  - phase: 46-05
    provides: "agents/verify_candidates.py — bare non-LLM node; editor_gate_1 all-candidates-killed recovery path"
provides:
  - "graph/builder.py — 20-node compiled graph: calibrator -> signal_editor -> scout -> verify_candidates -> advocate -> ... (D-01)"
  - "api/runs.py agentRuns:queueForRun agent_keys list synced (both new nodes pre-registered)"
  - "lib/agent_wrapper.py _INPUT_KEYS whitelist synced (both new nodes get meaningful inputSnapshot)"
  - "test_builder_wiring.py — 9 new source-scan + live-introspection tests proving the 20-node D-01 wiring"
  - "test_pipeline_real_mode.py full-graph e2e mocks both new nodes' externals — stays green through the rewire"
affects: [46-07, 47-story-brief-stage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two independent hardcoded consumer lists (api/runs.py agent_keys, agent_wrapper._INPUT_KEYS) must be updated in the SAME commit as any graph/builder.py node-set change — neither is derived from builder.py, both silently drift otherwise (RESEARCH Pitfalls 2/9)"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py
    - packages/pipeline/tests/test_builder_wiring.py
    - packages/pipeline/tests/test_pipeline_real_mode.py

key-decisions:
  - "Also mocked verify_candidates._check_registration (not explicitly named in the plan's action list) — the _scout_candidates() e2e fixture carries no charityNavigatorUrl/guidestarUrl fields, so without this mock every candidate would trip D-12's 'no registration record found at all' definitive-kill rule and the full-graph e2e would divert into editor_gate_1's all-candidates-killed interrupt path instead of reaching publisher. This is a Rule 1 (bug) fix scoped entirely inside the plan's own 'no candidate is killed in the wiring smoke' truth criterion."

requirements-completed: [SGE-04]

# Metrics
duration: ~12min
completed: 2026-07-16
---

# Phase 46 Plan 06: Graph Wiring & Consumer Sync Summary

**Rewired `graph/builder.py` to the D-01 chain (`calibrator → signal_editor → scout → verify_candidates → advocate`), compiling to exactly 20 nodes, and kept the two silent-drift consumers (`api/runs.py` agent_keys, `agent_wrapper._INPUT_KEYS`) plus the two rewire-sensitive tests (`test_builder_wiring.py`, `test_pipeline_real_mode.py`) in sync in the same wave.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-16
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `graph/builder.py` now registers `signal_editor` (wrapped like every other LLM `@agent_node`) and `verify_candidates` (wrapped as a bare non-LLM bottleneck, mirroring `verify_research`'s precedent), and the old `calibrator→scout` / `scout→advocate` edges are replaced by the D-01 chain `calibrator → signal_editor → scout → verify_candidates → advocate`. Live introspection (`build_graph(MemorySaver()).get_graph().nodes`) confirms exactly 20 named nodes (excluding LangGraph's synthetic `__start__`/`__end__`).
- `api/runs.py`'s hardcoded `agentRuns:queueForRun` `agent_keys` list and `lib/agent_wrapper.py`'s `_INPUT_KEYS` whitelist — the two consumers RESEARCH flagged as silently drifting from `builder.py` — both now list the two new nodes in the correct D-01 position, so the live-progress rail pre-registers all 20 steps and both nodes get a real `inputSnapshot` instead of the `["run_id"]` default.
- `test_builder_wiring.py` gained 9 new tests: 6 source-scan assertions (2 new-node registrations, 4 new edges present, 2 old edges absent) plus one live-introspection test asserting the compiled graph has exactly 20 nodes including both new names.
- `test_pipeline_real_mode.py`'s full-graph e2e (`test_full_graph_runs_to_publisher`) now mocks every external `signal_editor`/`verify_candidates` touches — `acomplete` (via a new `_signal_leads()` fixture builder mirroring `_scout_candidates()`), `web_search`, `convex_mutation_safe`, `convex_query_safe`, `groq_query` for signal_editor; `web_search`, `convex_mutation_safe`, `_check_domain_live`, and (deviation, see below) `_check_registration` for verify_candidates — so the rewired graph reaches `publisher` without a real network call, exactly as it did pre-rewire.
- Full pipeline suite: 615 passed / 37 skipped / 0 failed (baseline was 606 passed / 37 skipped at 46-05 — the +9 matches the 9 new `test_builder_wiring.py` tests exactly, zero regressions).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire builder.py + sync api/runs.py agent_keys + agent_wrapper _INPUT_KEYS** - `eda30ff` (feat)
2. **Task 2: Update test_builder_wiring.py (20 nodes) + test_pipeline_real_mode.py mocks** - `1b1bf3e` (test)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` - Import + register `signal_editor`/`verify_candidates`; replace `calibrator→scout`/`scout→advocate` edges with the D-01 four-edge chain
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` - `agent_keys` list (agentRuns:queueForRun pre-registration) gains `"signal_editor"` before `"scout"` and `"verify_candidates"` after `"scout"`
- `packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` - `_INPUT_KEYS` gains `"signal_editor": ["style_brief"]` and `"verify_candidates": ["candidates"]`
- `packages/pipeline/tests/test_builder_wiring.py` - 9 new tests: node registration (x2), new edges (x4), old edges removed (x2), live 20-node compiled-graph assertion (x1)
- `packages/pipeline/tests/test_pipeline_real_mode.py` - `SignalEditorOutput` import, `_signal_leads()` fixture builder, `_mock_acomplete` branch, `_ACOMPLETE_PATCH_TARGETS` entry, and 7 new external-call patches in `_build_patches` (4 for signal_editor, 3 for verify_candidates — see Deviations for why a 4th verify_candidates patch was needed)

## Decisions Made
- Followed the plan's exact D-01 insertion order and D-02 node-wrapping split (LLM `@agent_node` for `signal_editor`, bare `wrap_agent_node`-only bottleneck for `verify_candidates`) with no deviation.
- Left the two hardcoded consumer lists as plain Python literals (not derived from `builder.py`) — consistent with the existing pattern; RESEARCH's Pitfall 2/9 fix is "keep them in sync," not "refactor to a single source of truth," which is out of this plan's scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mocked `verify_candidates._check_registration` in the e2e patch list (not explicitly named in the plan's action bullet)**
- **Found during:** Task 2, first `pytest tests/test_pipeline_real_mode.py` run design/trace (caught before running, via code inspection of `_apply_kill_rule` and the `_scout_candidates()` fixture — no failing test was actually observed, since the fix was applied proactively)
- **Issue:** The plan's Task 2 action list only named 3 verify_candidates patches (`web_search`, `convex_mutation_safe`, `_check_domain_live`). But `_scout_candidates()` (the e2e fixture Scout's mocked `acomplete` returns) produces `CharityCandidate` objects with no `charityNavigatorUrl`/`guidestarUrl` fields — the Pydantic `CharityCandidate` schema in `agents/scout.py` doesn't even define those fields (only the `graph/state.py` TypedDict does). Without a registration patch, `_check_registration` would return `(None, False)` for every candidate, tripping D-12's "no registration record found at all" definitive-kill rule and killing all 3 candidates — diverting the e2e run into `editor_gate_1`'s all-candidates-killed `awaiting-review`/`interrupt()` recovery path (built in 46-05) instead of reaching `publisher`, directly violating this plan's own must-have truth: "no candidate is killed in the wiring smoke."
- **Fix:** Added `patch("eisenbalm_pipeline.agents.verify_candidates._check_registration", AsyncMock(return_value=("https://example.org/registration", True)))` to `_build_patches`, alongside the domain-live patch.
- **Files modified:** `packages/pipeline/tests/test_pipeline_real_mode.py`
- **Verification:** `uv run pytest tests/test_builder_wiring.py tests/test_pipeline_real_mode.py -q` — 18 passed / 1 skipped; `test_full_graph_runs_to_publisher` reaches `publisher` and asserts `sanity_issue_id` populated.
- **Committed in:** `1b1bf3e` (part of Task 2 commit)

## Issues Encountered

None beyond the deviation above, which was caught by code inspection before any test run failed (no wasted fix-attempt cycles).

## Known Stubs

None. Both new nodes are fully wired production code; the e2e test mocks are standard wiring-smoke-test patches (identical in kind to every other agent's mocks in this file), not stubs shipping to any UI.

## Next Phase Readiness

- SGE-04 (graph runs 20 nodes end-to-end) is now provably true via live introspection, not just claimed.
- Plan 46-07 (checkpoint resume + integration gate) can build its pause/resume test spanning `signal_editor → scout → verify_candidates` directly on top of this wiring — the chain is live, both nodes' state fields (`story_leads`, `verification_records`, JSON-safe per D-20) flow through the compiled graph exactly as 46-04/46-05 built them.
- No blockers for 46-07.

## Self-Check

- [x] `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` contains `add_node("signal_editor"`, `add_node("verify_candidates"`, and all four new/two-removed edge assertions verified via grep
- [x] `build_graph(MemorySaver())` compiles to exactly 20 nodes (verified via direct `uv run python -c "..."` introspection, printed `NODES 20`)
- [x] `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` agent_keys list contains both new keys in the correct position
- [x] `packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` `_INPUT_KEYS` contains both new entries
- [x] `packages/pipeline/tests/test_builder_wiring.py` — 13/13 tests pass (4 pre-existing + 9 new)
- [x] `packages/pipeline/tests/test_pipeline_real_mode.py` — 18 passed / 1 skipped (Phase-6 opt-in test unaffected)
- [x] Full pipeline suite: `uv run pytest tests/ -q` — 615 passed / 37 skipped / 0 failed (606→615, +9 matches new tests exactly, zero regressions)
- [x] Commits `eda30ff`, `1b1bf3e` both present in `git log`

## Self-Check: PASSED

Both modified-file sets confirmed present on disk with the expected content; both task commits (`eda30ff`, `1b1bf3e`) confirmed in `git log`; full pipeline suite green with zero regressions.

---
*Phase: 46-signal-editor-candidate-verification*
*Plan: 06-graph-wiring-and-consumer-sync*
*Completed: 2026-07-16*
