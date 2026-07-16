---
phase: 46-signal-editor-candidate-verification
plan: 06
type: execute
wave: 4
depends_on: ["46-04", "46-05"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
  - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py
  - packages/pipeline/tests/test_builder_wiring.py
  - packages/pipeline/tests/test_pipeline_real_mode.py
autonomous: true
requirements: [SGE-04]

must_haves:
  truths:
    - "The compiled graph has exactly 20 named nodes in the D-01 order: calibrator → signal_editor → scout → verify_candidates → advocate"
    - "The old calibrator→scout and scout→advocate edges are gone; the new chain replaces them"
    - "The full-graph e2e test still runs green (signal_editor + verify_candidates externals mocked) — it does NOT silently break on the rewire"
    - "api/runs.py pre-registers signal_editor + verify_candidates so the live-progress rail shows all 20 steps upfront"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/builder.py"
      provides: "20-node graph with the two new nodes on the pre-fan-out spine"
      contains: "add_node(\"signal_editor\""
    - path: "packages/pipeline/tests/test_builder_wiring.py"
      provides: "20-node + new-edge assertions"
      contains: "20"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/graph/builder.py"
      to: "calibrator→signal_editor→scout→verify_candidates→advocate"
      via: "add_node + rewired add_edge"
      pattern: "add_edge\\(\"signal_editor\", \"scout\"\\)"
    - from: "packages/pipeline/tests/test_pipeline_real_mode.py"
      to: "signal_editor.acomplete + verify_candidates externals"
      via: "_build_patches mocks (Pitfall 3)"
      pattern: "signal_editor.acomplete"
---

<objective>
Wire the two new nodes into the graph in the D-01 order, keep the two silent-drift consumers (api/runs.py agent_keys, agent_wrapper _INPUT_KEYS) in sync, and update the two existing tests the rewire touches so the wave stays green.

Purpose: SGE-04 (the graph runs 20 nodes end-to-end). RESEARCH Pitfall 2 (api/runs.py hardcoded agent_keys) + Pitfall 3 (test_pipeline_real_mode e2e breaks the moment builder.py rewires) — both MUST land in the SAME plan as the rewire or the wave's tests break.
Output: rewired builder.py, updated runs.py + agent_wrapper.py, updated test_builder_wiring.py + test_pipeline_real_mode.py.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/46-signal-editor-candidate-verification/46-CONTEXT.md
@.planning/phases/46-signal-editor-candidate-verification/46-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
@packages/pipeline/src/eisenbalm_pipeline/api/runs.py
@packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py
@packages/pipeline/tests/test_builder_wiring.py
@packages/pipeline/tests/test_pipeline_real_mode.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewire builder.py + sync api/runs.py agent_keys + agent_wrapper _INPUT_KEYS</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/builder.py, packages/pipeline/src/eisenbalm_pipeline/api/runs.py, packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py — the 18-node wiring: node registration block (~L102-128), the `calibrator→scout` (~L132) and `scout→advocate` (~L133) edges, and how `verify_research` is added as a bare `wrap_agent_node` bottleneck (D-02 precedent for verify_candidates)
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py ~L320 — the hardcoded `agent_keys` list (RESEARCH Pitfall 2)
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py ~L33-48 — the `_INPUT_KEYS` whitelist (RESEARCH Pitfall 9)
    - packages/pipeline/src/eisenbalm_pipeline/agents/signal_editor.py + agents/verify_candidates.py (from 46-04/46-05) — the import targets
  </read_first>
  <action>
    1. `graph/builder.py`:
       - Add imports: `from eisenbalm_pipeline.agents.signal_editor import signal_editor` and `from eisenbalm_pipeline.agents.verify_candidates import verify_candidates`.
       - Register both nodes: `builder.add_node("signal_editor", wrap_agent_node("signal_editor", signal_editor))` and `builder.add_node("verify_candidates", wrap_agent_node("verify_candidates", verify_candidates))` (verify_candidates is wrapped exactly like verify_research — a bare non-LLM bottleneck).
       - REPLACE the edges: remove `builder.add_edge("calibrator", "scout")` and `builder.add_edge("scout", "advocate")`; add the D-01 chain: `builder.add_edge("calibrator", "signal_editor")`, `builder.add_edge("signal_editor", "scout")`, `builder.add_edge("scout", "verify_candidates")`, `builder.add_edge("verify_candidates", "advocate")`. Leave the START→calibrator edge and everything from advocate onward UNCHANGED. No change to the 7-writer fan-out or validate_sections join (D-03).
    2. `api/runs.py`: insert `"signal_editor"` immediately before `"scout"` and `"verify_candidates"` immediately after `"scout"` in the hardcoded `agent_keys` list (~L320) so agentRuns:queueForRun pre-registers all 20 steps for the live-progress rail.
    3. `lib/agent_wrapper.py`: add `"signal_editor": ["style_brief"]` and `"verify_candidates": ["candidates"]` to `_INPUT_KEYS` so the two new nodes get a meaningful inputSnapshot instead of the `["run_id"]` default (Pitfall 9).
  </action>
  <acceptance_criteria>
    - `grep -q 'add_node("signal_editor"' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` and `grep -q 'add_node("verify_candidates"' ...` both match
    - `grep -q 'add_edge("calibrator", "signal_editor")' builder.py`, `grep -q 'add_edge("signal_editor", "scout")' builder.py`, `grep -q 'add_edge("scout", "verify_candidates")' builder.py`, `grep -q 'add_edge("verify_candidates", "advocate")' builder.py` ALL match
    - `grep -q 'add_edge("calibrator", "scout")' builder.py` and `grep -q 'add_edge("scout", "advocate")' builder.py` NO LONGER match (old edges removed)
    - `grep -q "signal_editor" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` and `grep -q "verify_candidates" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` both match in the agent_keys list
    - `grep -q '"signal_editor": \["style_brief"\]' packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` and `grep -q '"verify_candidates": \["candidates"\]' ...` both match
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from langgraph.checkpoint.memory import MemorySaver; from eisenbalm_pipeline.graph.builder import build_graph; g=build_graph(MemorySaver()); n=set(g.get_graph().nodes) - {'__start__','__end__'}; assert 'signal_editor' in n and 'verify_candidates' in n, n; print('NODES', len(n))"</automated>
  </verify>
  <done>The graph compiles with signal_editor + verify_candidates on the spine in D-01 order; the two hardcoded consumer lists are in sync.</done>
</task>

<task type="auto">
  <name>Task 2: Update test_builder_wiring.py (20 nodes) + test_pipeline_real_mode.py mocks</name>
  <files>packages/pipeline/tests/test_builder_wiring.py, packages/pipeline/tests/test_pipeline_real_mode.py</files>
  <read_first>
    - packages/pipeline/tests/test_builder_wiring.py — the source-scan skip-guard + edge assertion style
    - packages/pipeline/tests/test_pipeline_real_mode.py — `_ACOMPLETE_PATCH_TARGETS` (~L307), `_mock_acomplete` response_format switch (~L253-299), `_scout_candidates()` (~L71) as the template for `_signal_leads()`, `_build_patches` (~L324) web_search/convex/httpx mocks
    - RESEARCH Pitfall 3 (the e2e test attempts real network calls for the new nodes unless patched)
  </read_first>
  <action>
    1. `test_builder_wiring.py`:
       - Add source-scan assertions: `add_node("signal_editor"` present, `add_node("verify_candidates"` present, all four new edges present (`calibrator→signal_editor`, `signal_editor→scout`, `scout→verify_candidates`, `verify_candidates→advocate`), and the two old edges (`calibrator→scout`, `scout→advocate`) ABSENT.
       - Add a live-introspection test: compile `build_graph(MemorySaver())` and assert the node set (excluding `__start__`/`__end__`) has EXACTLY 20 members and contains both new node names (D-03). Account for the `DESIGNAGENT_SUPPRESSED` toggle: assert 20 when design is present (the default), matching the existing SECTION_WRITERS logic.
    2. `test_pipeline_real_mode.py` (Pitfall 3 — must be same wave as the rewire):
       - Import `SignalEditorOutput` from `eisenbalm_pipeline.agents.signal_editor`.
       - Add `"eisenbalm_pipeline.agents.signal_editor.acomplete"` to `_ACOMPLETE_PATCH_TARGETS`.
       - Add a `_signal_leads() -> SignalEditorOutput` builder (mirror `_scout_candidates()`) returning 3 valid leads (all 11 fields; at least one brandRiskFlag=false/recommended, none brandRiskFlag=true+recommended) and add `if response_format is SignalEditorOutput: return _signal_leads(), usage` to `_mock_acomplete`.
       - In `_build_patches`, add: `patch("eisenbalm_pipeline.agents.signal_editor.web_search", AsyncMock(return_value=fake_results))`, `patch("eisenbalm_pipeline.agents.signal_editor.convex_mutation_safe", convex_mock)`, `patch("eisenbalm_pipeline.agents.signal_editor.convex_query_safe", AsyncMock(return_value=[]))`, `patch("eisenbalm_pipeline.agents.signal_editor.groq_query", AsyncMock(return_value=[]))`; and for verify_candidates: `patch("eisenbalm_pipeline.agents.verify_candidates.web_search", AsyncMock(return_value=[]))`, `patch("eisenbalm_pipeline.agents.verify_candidates.convex_mutation_safe", convex_mock)`, and patch its httpx domain check to a live/2xx result (e.g. `patch("eisenbalm_pipeline.agents.verify_candidates._check_domain_live", AsyncMock(return_value=True))`) so no candidate is killed in the wiring smoke.
       - Do NOT change the existing assertions except to keep them passing; `test_full_graph_runs_to_publisher` must still reach publisher.
  </action>
  <acceptance_criteria>
    - `grep -q "signal_editor.acomplete" packages/pipeline/tests/test_pipeline_real_mode.py` matches inside `_ACOMPLETE_PATCH_TARGETS`
    - `grep -q "_signal_leads" packages/pipeline/tests/test_pipeline_real_mode.py` and `grep -q "SignalEditorOutput" ...` both match
    - `grep -q "verify_candidates" packages/pipeline/tests/test_pipeline_real_mode.py` matches (external mocks added)
    - test_builder_wiring asserts a 20-node count (`grep -q "20" packages/pipeline/tests/test_builder_wiring.py`)
    - `cd packages/pipeline && uv run pytest tests/test_builder_wiring.py tests/test_pipeline_real_mode.py -q` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_builder_wiring.py tests/test_pipeline_real_mode.py -q</automated>
  </verify>
  <done>Builder wiring test asserts 20 nodes + the new/removed edges; the full-graph e2e still reaches publisher with the two new nodes mocked.</done>
</task>

</tasks>

<verification>
- `build_graph(MemorySaver())` compiles with 20 nodes in D-01 order
- `cd packages/pipeline && uv run pytest tests/test_builder_wiring.py tests/test_pipeline_real_mode.py -q` green
- api/runs.py agent_keys + agent_wrapper _INPUT_KEYS both list the two new nodes
</verification>

<success_criteria>
- SGE-04: graph runs 20 nodes end-to-end — signal_editor before scout, verify_candidates between scout and advocate; old edges removed
- No silent drift: api/runs.py pre-registration + agent_wrapper input snapshots cover both new nodes
- The e2e wiring test does not regress
</success_criteria>

<output>
After completion, create `.planning/phases/46-signal-editor-candidate-verification/46-06-SUMMARY.md`
</output>
