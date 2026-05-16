---
phase: 05-agent-quality
plan: 14
type: execute
wave: 7
depends_on:
  - "05-05"
  - "05-06"
  - "05-07"
  - "05-08"
  - "05-09"
  - "05-10"
  - "05-11"
  - "05-12"
  - "05-13"
files_modified:
  - packages/pipeline/tests/test_pipeline_real_mode.py
  - packages/pipeline/tests/lib/test_cost.py
  - packages/pipeline/tests/agents/test_tool_limits.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
autonomous: true
requirements_addressed:
  - AGT-17
  - AGT-18
must_haves:
  truths:
    - "test_pipeline_real_mode.py runs the full graph against mocked OpenRouter + Tavily + Convex + Sanity and verifies the end-to-end three-datastore write order"
    - "AGT-17 verified: state['model_versions'] contains entries for calibrator, editor_gate1, qa, editor_final by run completion (the 4 voice-critical agents)"
    - "AGT-18 verified: a forced-overrun test asserts AgentToolCallLimitExceeded raises and @agent_node emits deliberationEvents eventType='agent-tool-limit-exceeded'"
    - "Cost cap soft warn @ 70% verified: CostRecorder emits deliberationEvents eventType='cost-warning' (Plan 05-03 mechanism)"
    - "Cost cap hard halt @ 100% verified: CostCapExceeded raised; pipelineRuns.status='failed' written"
    - "EISENBALM_STUB_MODE default is 'false' (D-22 flip); 'true' still works for the Phase 4 PIP-06 regression smoke"
  artifacts:
    - path: "packages/pipeline/tests/test_pipeline_real_mode.py"
      provides: "End-to-end real-mode smoke; runs against mocked OpenRouter+Tavily but exercises all agent code paths"
      min_lines: 150
    - path: "packages/pipeline/tests/lib/test_cost.py"
      provides: "CostRecorder.check_cap soft-warn + hard-cap tests"
      min_lines: 80
    - path: "packages/pipeline/tests/agents/test_tool_limits.py"
      provides: "Scout (max=8) + Researcher (max=12) tool-limit enforcement test"
      min_lines: 60
  key_links:
    - from: "tests/test_pipeline_real_mode.py"
      to: "graph.builder.build_graph() + langgraph compile"
      via: "exercises the full real-mode graph from Calibrator to Editor Final"
      pattern: "build_graph"
    - from: "lib/openrouter_client.py default"
      to: "EISENBALM_STUB_MODE default 'false' (D-22 flip)"
      via: "env-var default value change"
      pattern: "EISENBALM_STUB_MODE"
---

<objective>
Land Phase 5's proof-of-completion: a real-mode integration test plus dedicated tool-limit + cost-cap tests that mechanically prove AGT-17, AGT-18, and OPS-* validation rows (D-08 / D-22). This is the second-to-last plan; Plan 05-15 (Andrew smoke + font whitelist approval) closes the phase.

Three concerns:

1. **End-to-end real-mode smoke (`test_pipeline_real_mode.py`):** Runs the full graph from Calibrator through Editor Final with `EISENBALM_STUB_MODE=false`, but with `acomplete` + `web_search` + `convex_mutation_safe` + `groq_query` + `write_charity` + `_fetch_text` all patched to deterministic mocks. This is NOT a live-API test (those run against Railway under Andrew's eye, Plan 05-15). It is a unit-scope graph-execution test that verifies the wiring — every agent runs, the three-datastore write order holds, modelVersions is populated for the four voice-critical agents, and the graph completes without exceptions.

2. **Cost cap mechanics test (`tests/lib/test_cost.py`):** Direct tests of `CostRecorder.check_cap()` (Plan 05-03 added). Test 1: total at 70% of cap → emits `deliberationEvents` eventType='cost-warning' once. Test 2: total at 100% → raises `CostCapExceeded`. Test 3: warn fires only once even after multiple `check_cap()` calls.

3. **Tool-limit enforcement test (`tests/agents/test_tool_limits.py`):** Scout and Researcher each have their own per-agent tests already (Plans 05-06 + 05-09) — this test reaches further: it verifies that when `AgentToolCallLimitExceeded` propagates up to `@agent_node`, the wrapper correctly emits a `deliberationEvents` row with `eventType='agent-tool-limit-exceeded'` (Plan 05-01 schema patch). The exception path through the wrapper is the integration surface the per-agent tests do not cover.

4. **EISENBALM_STUB_MODE flip (D-22):** `lib/openrouter_client.py` default value for `EISENBALM_STUB_MODE` flips from `true` → `false`. The toggle still works in both directions; existing PIP-06 stub-mode regression test passes by setting the env var explicitly to `true`. Verify by reading the line in `lib/openrouter_client.py` and confirming the default is `false`.

Output: 3 new/updated test files + 1 line change in `lib/openrouter_client.py`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/cost.py
@packages/pipeline/src/eisenbalm_pipeline/lib/errors.py
@packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
@packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py
@docs/API_CONTRACTS.md

<interfaces>
<!-- CostRecorder + CostCapExceeded (Plan 05-03 lib/cost.py extension) -->
```python
class CostCapExceeded(Exception): ...

class CostRecorder:
    async def check_cap(self) -> None:
        """Soft alert at 70% of PIPELINE_COST_CAP_USD; hard halt at 100%."""
```

<!-- AgentToolCallLimitExceeded (Plan 05-03 lib/errors.py) -->
```python
class AgentToolCallLimitExceeded(Exception): ...
```

<!-- @agent_node exception handling (Phase 4 _wrapper.py — locked) -->
<!-- Per Phase 4 D-27, any exception in agent body becomes:
       - pipelineRuns:updateStatus with status='failed'
       - errorMessage = f'{agentId}: {ExceptionClass}: {msg}'
       - re-raise to LangGraph -->
<!-- Phase 5 ADDS: when the exception class is AgentToolCallLimitExceeded,
     ALSO write deliberationEvents:insert with eventType='agent-tool-limit-exceeded'
     (post-05-01 schema). Plan 05-14 verifies this end-to-end. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Flip EISENBALM_STUB_MODE default to 'false' in lib/openrouter_client.py</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py (whole file — find the env-var read)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-22 (default flip)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md (Phase 4 D-17 — how the toggle was used)
  </read_first>

  <action>
  Locate the `EISENBALM_STUB_MODE` env-var read in `lib/openrouter_client.py`. It will look like one of these patterns:

  ```python
  STUB_MODE = os.environ.get("EISENBALM_STUB_MODE", "true").lower() == "true"
  ```

  OR

  ```python
  if os.environ.get("EISENBALM_STUB_MODE", "true") == "true":
      ...
  ```

  Change the DEFAULT VALUE from `"true"` to `"false"`. The post-change line MUST read:

  ```python
  STUB_MODE = os.environ.get("EISENBALM_STUB_MODE", "false").lower() == "true"
  ```

  Do NOT change the logic — only the default. Both `EISENBALM_STUB_MODE=true` and `EISENBALM_STUB_MODE=false` (and unset → false) must continue to work.

  If the env-var read lives in a different module (e.g. `lib/cost.py` or `agents/_wrapper.py`), update the default there as well. There MUST be exactly ONE place where the default lives — if there are multiple, consolidate to `lib/openrouter_client.py` and document the consolidation in the SUMMARY.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && grep -E 'EISENBALM_STUB_MODE.*"false"' src/eisenbalm_pipeline/lib/openrouter_client.py | grep -q . && ! grep -E 'EISENBALM_STUB_MODE.*"true"' src/eisenbalm_pipeline/lib/openrouter_client.py | grep -q . && echo OK</automated>
  </verify>

  <acceptance_criteria>
    - `lib/openrouter_client.py` `EISENBALM_STUB_MODE` default is the string `"false"` (verifiable by grep)
    - No place in the codebase has `EISENBALM_STUB_MODE.*"true"` as a default fallback (any explicit `=true` env-set in tests is fine)
    - Setting `EISENBALM_STUB_MODE=true` explicitly still routes calls through `stubs/fake_openrouter.py` (existing Phase 4 PIP-06 test still passes)
  </acceptance_criteria>

  <done>
  Stub mode default flipped per D-22. Real-mode is the new default.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create tests/lib/test_cost.py — soft warn @ 70% + hard cap @ 100%</name>
  <files>packages/pipeline/tests/lib/test_cost.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/cost.py (Plan 05-03 added check_cap + CostCapExceeded)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Cost Cap Enforcement" lines 1318-1381
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-08 (soft-warn 70%, hard 100%)
  </read_first>

  <behavior>
    - Test 1 (test_no_warn_below_threshold): record costs totaling 60% of cap; assert no `deliberationEvents:insert` with eventType='cost-warning' fires.
    - Test 2 (test_warn_at_70_percent): record costs totaling 70% of cap; assert exactly ONE `cost-warning` event emitted with payload including totalUsd, percentOfCap, perAgent.
    - Test 3 (test_warn_emits_only_once): call check_cap() three times at 70%+; assert only ONE warning emitted (warn-once flag).
    - Test 4 (test_hard_cap_raises_cost_cap_exceeded): record costs totaling 100% of cap; assert CostCapExceeded raised.
    - Test 5 (test_env_var_override): set PIPELINE_COST_CAP_USD=5.0 and PIPELINE_COST_WARN_PCT=0.5; assert warn fires at $2.50.
  </behavior>

  <action>
  CREATE `packages/pipeline/tests/lib/test_cost.py`:

  ```python
  """Phase 5 CostRecorder.check_cap tests — Plan 05-14.

  Validation: D-08 soft warn @ 70% + hard halt @ 100%, AGT-17 cost obs surface.
  """
  from __future__ import annotations

  import os
  from unittest.mock import AsyncMock, patch

  import pytest

  from eisenbalm_pipeline.lib.cost import CostCapExceeded, CostRecorder


  def _make_recorder(run_id: str = "run-test") -> CostRecorder:
      return CostRecorder(run_id)


  @pytest.mark.asyncio
  async def test_no_warn_below_threshold(monkeypatch) -> None:
      """D-08: at <70% of cap, no warning event emitted."""
      monkeypatch.setenv("PIPELINE_COST_CAP_USD", "10.0")
      monkeypatch.setenv("PIPELINE_COST_WARN_PCT", "0.7")
      recorder = _make_recorder()
      recorder.record("calibrator", tokens_in=0, tokens_out=0, usd=5.0)  # 50%

      mock_convex = AsyncMock()
      with patch(
          "eisenbalm_pipeline.lib.cost.convex_mutation_safe", mock_convex,
      ):
          await recorder.check_cap()

      warn_calls = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "deliberationEvents:insert"
          and c.args[1].get("eventType") == "cost-warning"
      ]
      assert len(warn_calls) == 0


  @pytest.mark.asyncio
  async def test_warn_at_70_percent(monkeypatch) -> None:
      """D-08: at 70% of cap, ONE cost-warning event emitted."""
      monkeypatch.setenv("PIPELINE_COST_CAP_USD", "10.0")
      monkeypatch.setenv("PIPELINE_COST_WARN_PCT", "0.7")
      recorder = _make_recorder()
      recorder.record("calibrator", tokens_in=0, tokens_out=0, usd=7.0)

      mock_convex = AsyncMock()
      with patch(
          "eisenbalm_pipeline.lib.cost.convex_mutation_safe", mock_convex,
      ):
          await recorder.check_cap()
          # Allow async tasks to run
          import asyncio
          await asyncio.sleep(0)

      warn_calls = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "deliberationEvents:insert"
          and c.args[1].get("eventType") == "cost-warning"
      ]
      assert len(warn_calls) == 1


  @pytest.mark.asyncio
  async def test_warn_emits_only_once(monkeypatch) -> None:
      """D-08: warning fires once even on repeated check_cap() calls above threshold."""
      monkeypatch.setenv("PIPELINE_COST_CAP_USD", "10.0")
      monkeypatch.setenv("PIPELINE_COST_WARN_PCT", "0.7")
      recorder = _make_recorder()
      recorder.record("calibrator", tokens_in=0, tokens_out=0, usd=8.0)

      mock_convex = AsyncMock()
      with patch(
          "eisenbalm_pipeline.lib.cost.convex_mutation_safe", mock_convex,
      ):
          await recorder.check_cap()
          await recorder.check_cap()
          await recorder.check_cap()
          import asyncio
          await asyncio.sleep(0)

      warn_calls = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "deliberationEvents:insert"
          and c.args[1].get("eventType") == "cost-warning"
      ]
      assert len(warn_calls) == 1


  @pytest.mark.asyncio
  async def test_hard_cap_raises(monkeypatch) -> None:
      """D-08: at 100% of cap, CostCapExceeded raised."""
      monkeypatch.setenv("PIPELINE_COST_CAP_USD", "10.0")
      monkeypatch.setenv("PIPELINE_COST_WARN_PCT", "0.7")
      recorder = _make_recorder()
      recorder.record("calibrator", tokens_in=0, tokens_out=0, usd=10.0)

      with patch(
          "eisenbalm_pipeline.lib.cost.convex_mutation_safe", AsyncMock(),
      ):
          with pytest.raises(CostCapExceeded):
              await recorder.check_cap()


  @pytest.mark.asyncio
  async def test_env_var_override(monkeypatch) -> None:
      """D-08: env vars PIPELINE_COST_CAP_USD + PIPELINE_COST_WARN_PCT honored."""
      monkeypatch.setenv("PIPELINE_COST_CAP_USD", "5.0")
      monkeypatch.setenv("PIPELINE_COST_WARN_PCT", "0.5")
      recorder = _make_recorder()
      recorder.record("calibrator", tokens_in=0, tokens_out=0, usd=2.5)

      mock_convex = AsyncMock()
      with patch(
          "eisenbalm_pipeline.lib.cost.convex_mutation_safe", mock_convex,
      ):
          await recorder.check_cap()
          import asyncio
          await asyncio.sleep(0)

      warn_calls = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "deliberationEvents:insert"
          and c.args[1].get("eventType") == "cost-warning"
      ]
      assert len(warn_calls) == 1
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/lib/test_cost.py -x -v 2>&1 | tail -30</automated>
  </verify>

  <acceptance_criteria>
    - `pytest tests/lib/test_cost.py -x` exits 0 with 5 tests passing
    - `test_no_warn_below_threshold` asserts zero warning events at 50% of cap
    - `test_warn_at_70_percent` asserts exactly ONE cost-warning event
    - `test_hard_cap_raises` asserts `CostCapExceeded`
    - `test_env_var_override` asserts env-var-based threshold customization
  </acceptance_criteria>

  <done>
  Cost cap mechanics validated mechanically.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create tests/agents/test_tool_limits.py — wrapper-level overrun events</name>
  <files>packages/pipeline/tests/agents/test_tool_limits.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py (decorator exception path — Phase 4 locked)
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py (max_tool_calls=8)
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py (max_tool_calls=12)
    - packages/pipeline/src/eisenbalm_pipeline/lib/errors.py (AgentToolCallLimitExceeded)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-21 (overrun emits deliberationEvents eventType='agent-tool-limit-exceeded')
  </read_first>

  <behavior>
    - Test 1 (test_scout_max_tool_calls_constant): Assert Scout's `max_tool_calls=8` attribute reachable via decorator (`scout._max_tool_calls == 8`).
    - Test 2 (test_researcher_max_tool_calls_constant): `researcher._max_tool_calls == 12`.
    - Test 3 (test_wrapper_emits_tool_limit_event_on_overrun): Force a Scout overrun; assert `convex_mutation_safe('deliberationEvents:insert', ...)` called with `eventType='agent-tool-limit-exceeded'` AND `pipelineRuns:updateStatus` with `status='failed'`.
  </behavior>

  <action>
  Note: Phase 4 `_wrapper.py` may NOT yet emit the `agent-tool-limit-exceeded` event automatically. If not, this task ALSO patches the wrapper to do so. Check `agents/_wrapper.py` first.

  CREATE `packages/pipeline/tests/agents/test_tool_limits.py`:

  ```python
  """Phase 5 iteration-limit tests — Plan 05-14.

  Validation: AGT-18 (max_tool_calls enforcement + wrapper event emission).
  Per-agent tests in test_scout.py and test_researcher.py cover the in-body
  raise; this file covers the @agent_node wrapper's behavior on overrun.
  """
  from __future__ import annotations

  from unittest.mock import AsyncMock, patch

  import pytest

  from eisenbalm_pipeline.agents.researcher import researcher
  from eisenbalm_pipeline.agents.scout import scout
  from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded


  def test_scout_max_tool_calls_constant() -> None:
      """AGT-18: Scout decorator carries max_tool_calls=8."""
      assert scout._max_tool_calls == 8


  def test_researcher_max_tool_calls_constant() -> None:
      """AGT-18: Researcher decorator carries max_tool_calls=12."""
      assert researcher._max_tool_calls == 12


  @pytest.mark.asyncio
  async def test_wrapper_emits_tool_limit_event_on_overrun(
      sample_dispatch_state,
  ) -> None:
      """AGT-18: when AgentToolCallLimitExceeded propagates, the @agent_node
      wrapper emits a deliberationEvents row with eventType='agent-tool-limit-exceeded'
      AND writes pipelineRuns.status='failed' (Phase 4 D-27 + Plan 05-01 schema)."""
      from eisenbalm_pipeline.agents import scout as scout_mod

      # Force overrun by patching SCOUT_QUERIES to 9 entries (> max_tool_calls=8)
      nine = tuple(f"q{i}" for i in range(9))
      mock_convex = AsyncMock()
      with patch.object(scout_mod, "SCOUT_QUERIES", nine), patch(
          "eisenbalm_pipeline.agents.scout.web_search", AsyncMock(return_value=[]),
      ), patch(
          "eisenbalm_pipeline.agents.scout._load_featured_keys",
          AsyncMock(return_value=[]),
      ), patch(
          "eisenbalm_pipeline.agents._wrapper.convex_mutation_safe", mock_convex,
      ), patch(
          "eisenbalm_pipeline.agents.scout.convex_mutation_safe", mock_convex,
      ):
          with pytest.raises(AgentToolCallLimitExceeded):
              await scout(sample_dispatch_state)

      # 1. pipelineRuns:updateStatus with status='failed' (Phase 4 D-27)
      failed_calls = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "pipelineRuns:updateStatus"
          and c.args[1].get("status") == "failed"
      ]
      assert len(failed_calls) >= 1

      # 2. deliberationEvents:insert with eventType='agent-tool-limit-exceeded' (D-21)
      tool_limit_events = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "deliberationEvents:insert"
          and c.args[1].get("eventType") == "agent-tool-limit-exceeded"
      ]
      assert len(tool_limit_events) >= 1, (
          "Wrapper must emit eventType='agent-tool-limit-exceeded' when "
          "AgentToolCallLimitExceeded is caught (D-21 / AGT-18). If this "
          "fails, _wrapper.py needs an except branch for this exception class."
      )
  ```

  **If the third test fails** because `_wrapper.py` does not yet have the special-case branch: edit `_wrapper.py` to add it. Insert this AFTER the `except GraphInterrupt: raise` block and BEFORE the generic `except Exception as e:` block:

  ```python
  except AgentToolCallLimitExceeded as e:
      # AGT-18 / D-21: emit dedicated deliberationEvents row first,
      # then fall through to the generic status='failed' write.
      try:
          await convex_mutation_safe(
              "deliberationEvents:insert",
              {
                  "runId": run_id,
                  "agentId": name,
                  "eventType": "agent-tool-limit-exceeded",
                  "payload": json.dumps({
                      "agentId": name,
                      "limit": max_tool_calls,
                      "message": str(e),
                  }),
              },
          )
      except Exception:
          pass  # event write is best-effort; failure path still runs
      error_msg = f"{name}: {type(e).__name__}: {e}"
      log.exception("Agent %s raised: %s", name, error_msg)
      await convex_mutation_safe(
          "pipelineRuns:updateStatus",
          {
              "runId": run_id, "status": "failed",
              "completedAt": int(time.time() * 1000),
              "errorMessage": error_msg,
          },
      )
      raise
  ```

  Add the import `from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded` to `_wrapper.py` if it isn't already there. Document this `_wrapper.py` patch in the SUMMARY as a planned Phase-5 surgical extension to the Phase-4-locked decorator (the contract is preserved; behavior expanded for new exception classes).
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_tool_limits.py -x -v 2>&1 | tail -30</automated>
  </verify>

  <acceptance_criteria>
    - `pytest tests/agents/test_tool_limits.py -x` exits 0 with 3 tests passing
    - `test_scout_max_tool_calls_constant` asserts `scout._max_tool_calls == 8`
    - `test_researcher_max_tool_calls_constant` asserts `researcher._max_tool_calls == 12`
    - `test_wrapper_emits_tool_limit_event_on_overrun` asserts BOTH the `agent-tool-limit-exceeded` event AND the `status='failed'` row are written
  </acceptance_criteria>

  <done>
  Tool-limit overrun produces both observability rows (deliberationEvents + pipelineRuns.failed).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Create tests/test_pipeline_real_mode.py — end-to-end graph smoke</name>
  <files>packages/pipeline/tests/test_pipeline_real_mode.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py (full topology after Plan 05-09)
    - packages/pipeline/tests/conftest.py (existing fixtures)
    - packages/pipeline/src/eisenbalm_pipeline/agents/* (all agents to identify mock points)
  </read_first>

  <behavior>
    - Test 1 (test_full_graph_runs_to_editor_final): Mock every external integration (acomplete, web_search, convex_mutation_safe, groq_query, write_charity, _fetch_text). Run `build_graph().ainvoke(initial_state)`. Assert run completes without exception. Assert `final_state['style_brief']` populated. Assert `final_state['winning_charity']` populated. Assert all six sections populated. Assert `final_state['editor_final_notes']` populated.
    - Test 2 (test_model_versions_all_voice_critical_present): After full graph run, assert `final_state['model_versions']` contains keys: calibrator, editor_gate1, qa, editor_final (the 4 voice-critical agents). AGT-17 verification.
    - Test 3 (test_stub_mode_still_works): Set `EISENBALM_STUB_MODE=true` explicitly and run the graph; assert it still completes (Phase 4 PIP-06 regression smoke).
  </behavior>

  <action>
  CREATE `packages/pipeline/tests/test_pipeline_real_mode.py`:

  ```python
  """Phase 5 end-to-end real-mode smoke — Plan 05-14.

  Runs the full graph with EISENBALM_STUB_MODE=false but with every external
  integration patched to a deterministic mock. This validates the WIRING:
  every agent runs, modelVersions is populated for the voice-critical agents,
  the graph completes without exception. Live-API smoke runs against Railway
  under Andrew's eye in Plan 05-15.
  """
  from __future__ import annotations

  from unittest.mock import AsyncMock, patch

  import pytest

  # Import per-agent Pydantic outputs to construct mock returns
  from eisenbalm_pipeline.agents.advocate import AdvocateOutput, AdvocateVote
  from eisenbalm_pipeline.agents.bonus import SpecAdBonus
  from eisenbalm_pipeline.agents.calibrator import StyleBriefOutput
  from eisenbalm_pipeline.agents.case_study import CaseStudyOutput
  from eisenbalm_pipeline.agents.design import ThemeOutput
  from eisenbalm_pipeline.agents.editor import EditorDecision, EditorFinalOutput
  from eisenbalm_pipeline.agents.founder_bio import FounderBioOutput
  from eisenbalm_pipeline.agents.game import GameOutput
  from eisenbalm_pipeline.agents.origin_story import OriginStoryOutput
  from eisenbalm_pipeline.agents.problem import (
      KeyDataPoint, PdfContent, ProblemOutput,
  )
  from eisenbalm_pipeline.agents.qa.judge import JudgeFindings
  from eisenbalm_pipeline.agents.researcher import ResearchOutputModel
  from eisenbalm_pipeline.agents.scout import CharityCandidate, ScoutBatchOutput
  from eisenbalm_pipeline.lib.search_client import SearchResult
  from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


  def _mock_acomplete_per_agent(agent_id: str, *args, **kwargs):
      """Return a Pydantic object whose shape matches the agent's response_format."""
      response_format = kwargs.get("response_format")
      resolved_model = {
          "calibrator": "anthropic/claude-opus-4-7",
          "editor_gate1": "anthropic/claude-opus-4-7",
          "editor_final": "anthropic/claude-opus-4-7",
          "qa": "anthropic/claude-opus-4-7",
      }.get(agent_id, "anthropic/claude-sonnet-4-6")
      usage = {
          "tokens_in": 100, "tokens_out": 50, "usd": 0.05,
          "resolved_model": resolved_model,
      }

      if agent_id == "calibrator":
          return StyleBriefOutput(
              voice=VOICE_CONSTRAINTS,
              constraints=["a", "b", "c"], bonusType="specAd",
              visualDirection="warm cream",
          ), usage
      if agent_id == "scout":
          cands = [
              CharityCandidate(
                  name=f"Org {i}", location="NYC",
                  website=f"https://org{i}.example",
                  assetRange="<$1M", focusArea="education",
                  missionStatement="m", scoutSummary="s",
                  whyOverlooked="o",
              ) for i in range(3)
          ]
          return ScoutBatchOutput(candidates=cands), usage
      if agent_id == "advocate":
          return AdvocateOutput(votes=[
              AdvocateVote(charityName="Org 0", score=8,
                           argument="x" * 200, keyStrengths=["a", "b"],
                           primaryConcern="c"),
              AdvocateVote(charityName="Org 1", score=5,
                           argument="y" * 200, keyStrengths=["a", "b"],
                           primaryConcern="c"),
              AdvocateVote(charityName="Org 2", score=9,
                           argument="z" * 200, keyStrengths=["a", "b"],
                           primaryConcern="c"),
          ]), usage
      if agent_id == "editor_gate1":
          return EditorDecision(
              winnerName="Org 2", confidence=0.9, requiresHumanInput=False,
              editorReasoning="r" * 100, runnerUpNotes="n" * 50,
              deliberationTranscript="# transcript",
          ), usage
      if agent_id == "researcher":
          return ResearchOutputModel(
              summary="s", foundingYear=2003, annualBudget="$500k",
              founderName="Jane Doe",
              founderNameSourceUrl="https://org2.example/about",
              founderRole="founder", founderBio="b",
              subjectName=None, subjectNameSourceUrl=None,
              subjectRole="a parent", subjectStory="ss",
              keyStatistics=[], fundingSources=[],
          ), usage
      if agent_id == "origin_story":
          return OriginStoryOutput(headline="H", body="B" * 400), usage
      if agent_id == "problem":
          return ProblemOutput(
              headline="H", body="B" * 400,
              pdfContent=PdfContent(
                  problemStatement="ps",
                  keyDataPoints=[KeyDataPoint(stat="s", source="u")] * 3,
                  interventionMechanism="im",
              ),
          ), usage
      if agent_id == "founder_bio":
          return FounderBioOutput(headline="H", body="B" * 400), usage
      if agent_id == "case_study":
          return CaseStudyOutput(headline="H", body="B" * 400), usage
      if agent_id == "game":
          return GameOutput(headline="H", description="d" * 80,
                            embedCode="<html></html>"), usage
      if agent_id == "bonus":
          return SpecAdBonus(headline="H", body="B" * 300), usage
      if agent_id == "design":
          return ThemeOutput(
              primaryColor="#2D5016", accentColor="#8B1A1A",
              backgroundColor="#FAFAF8", textColor="#1A1A18",
              fontDisplay="Playfair Display", fontBody="Source Serif Pro",
          ), usage
      if agent_id == "qa":
          return JudgeFindings(findings=[]), usage
      if agent_id == "editor_final":
          return EditorFinalOutput(editorFinalNotes="n" * 150), usage
      raise ValueError(f"unknown agent_id: {agent_id}")


  async def _mock_acomplete(agent_id, messages, *, response_format=None, **kwargs):
      return _mock_acomplete_per_agent(
          agent_id, messages, response_format=response_format, **kwargs,
      )


  @pytest.fixture
  def initial_state() -> dict:
      return {
          "run_id": "run-real-mode-test",
          "issue_number": 42,
          "candidates": [],
          "model_versions": {},
      }


  @pytest.mark.asyncio
  async def test_full_graph_runs_to_editor_final(initial_state, monkeypatch) -> None:
      """AGT-17 / AGT-18 wiring: full graph runs without exception."""
      monkeypatch.setenv("EISENBALM_STUB_MODE", "false")
      monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
      monkeypatch.setenv("TAVILY_API_KEY", "test-key")

      tavily_results = [
          SearchResult(url=f"https://org{i}.example", title=f"Org {i}",
                       content="content", score=0.9)
          for i in range(5)
      ]

      with patch(
          "eisenbalm_pipeline.lib.openrouter_client.acomplete",
          side_effect=_mock_acomplete,
      ), patch(
          "eisenbalm_pipeline.lib.search_client.web_search",
          AsyncMock(return_value=tavily_results),
      ), patch(
          "eisenbalm_pipeline.lib.convex_client.convex_mutation_safe",
          AsyncMock(),
      ), patch(
          "eisenbalm_pipeline.lib.sanity_client.groq_query",
          AsyncMock(return_value=[]),
      ), patch(
          "eisenbalm_pipeline.lib.sanity_client.write_charity",
          AsyncMock(side_effect=lambda http, c: f"charity-{c['name'].lower().replace(' ','-')}"),
      ), patch(
          "eisenbalm_pipeline.agents.verify._fetch_text",
          AsyncMock(return_value="Jane Doe founded this in 2003"),
      ):
          from eisenbalm_pipeline.graph.builder import build_graph
          graph = build_graph()
          compiled = graph.compile()
          result = await compiled.ainvoke(initial_state)

      assert result.get("style_brief") is not None
      assert result.get("winning_charity") is not None
      assert result.get("origin_story", {}).get("body")
      assert result.get("problem", {}).get("body")
      assert result.get("founder_bio", {}).get("body")
      assert result.get("case_study", {}).get("body")
      assert result.get("game", {}).get("description")
      assert result.get("bonus", {}).get("body")
      assert result.get("theme", {}).get("primaryColor")
      assert result.get("editor_final_notes")


  @pytest.mark.asyncio
  async def test_model_versions_voice_critical_populated(
      initial_state, monkeypatch,
  ) -> None:
      """AGT-17: model_versions populated for all 4 voice-critical agents."""
      monkeypatch.setenv("EISENBALM_STUB_MODE", "false")
      monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
      monkeypatch.setenv("TAVILY_API_KEY", "test-key")

      with patch(
          "eisenbalm_pipeline.lib.openrouter_client.acomplete",
          side_effect=_mock_acomplete,
      ), patch(
          "eisenbalm_pipeline.lib.search_client.web_search",
          AsyncMock(return_value=[]),
      ), patch(
          "eisenbalm_pipeline.lib.convex_client.convex_mutation_safe",
          AsyncMock(),
      ), patch(
          "eisenbalm_pipeline.lib.sanity_client.groq_query",
          AsyncMock(return_value=[]),
      ), patch(
          "eisenbalm_pipeline.lib.sanity_client.write_charity",
          AsyncMock(return_value="charity-x"),
      ), patch(
          "eisenbalm_pipeline.agents.verify._fetch_text",
          AsyncMock(return_value=""),
      ):
          from eisenbalm_pipeline.graph.builder import build_graph
          compiled = build_graph().compile()
          result = await compiled.ainvoke(initial_state)

      mv = result.get("model_versions") or {}
      for agent_id in ("calibrator", "editor_gate1", "qa", "editor_final"):
          assert agent_id in mv, (
              f"model_versions missing voice-critical agent: {agent_id}"
          )
          assert mv[agent_id], f"empty resolved_model for {agent_id}"


  @pytest.mark.asyncio
  async def test_stub_mode_still_works(initial_state, monkeypatch) -> None:
      """D-22: EISENBALM_STUB_MODE=true continues to work (Phase 4 PIP-06 regression)."""
      monkeypatch.setenv("EISENBALM_STUB_MODE", "true")
      with patch(
          "eisenbalm_pipeline.lib.convex_client.convex_mutation_safe",
          AsyncMock(),
      ), patch(
          "eisenbalm_pipeline.lib.sanity_client.groq_query",
          AsyncMock(return_value=[]),
      ), patch(
          "eisenbalm_pipeline.lib.sanity_client.write_charity",
          AsyncMock(return_value="charity-x"),
      ):
          from eisenbalm_pipeline.graph.builder import build_graph
          compiled = build_graph().compile()
          # Stub mode routes acomplete to stubs/fake_openrouter; should not raise.
          result = await compiled.ainvoke(initial_state)
      assert result is not None
  ```

  Note: The exact graph composition (build_graph().compile() + ainvoke) depends on Phase 4's actual graph compilation pattern; adjust the call signature as needed to match the Phase 4 reference implementation. The key requirement is that the graph runs end-to-end with the mocks in place.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/test_pipeline_real_mode.py -x -v 2>&1 | tail -40</automated>
  </verify>

  <acceptance_criteria>
    - `pytest tests/test_pipeline_real_mode.py -x` exits 0 with 3 tests passing
    - `test_full_graph_runs_to_editor_final` asserts every section field populated
    - `test_model_versions_voice_critical_populated` asserts calibrator, editor_gate1, qa, editor_final all present in model_versions
    - `test_stub_mode_still_works` passes with EISENBALM_STUB_MODE=true (Phase 4 PIP-06 regression)
  </acceptance_criteria>

  <done>
  End-to-end graph wiring verified for real-mode plus stub-mode regression.
  </done>
</task>

</tasks>

<verification>
- `EISENBALM_STUB_MODE=false uv run pytest tests/test_pipeline_real_mode.py -x` exits 0
- `EISENBALM_STUB_MODE=true uv run pytest tests/ -x -q --timeout=60` exits 0 (full Phase 4 regression)
- `EISENBALM_STUB_MODE=false uv run pytest tests/lib/test_cost.py tests/agents/test_tool_limits.py -x` exits 0
- `grep -E 'EISENBALM_STUB_MODE.*"false"' packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py | wc -l` returns ≥ 1
- `grep -c "agent-tool-limit-exceeded" packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` returns ≥ 1
</verification>

<success_criteria>
- Real-mode graph completes end-to-end with mocked externals
- modelVersions populated for all 4 voice-critical agents (calibrator + editor_gate1 + qa + editor_final)
- Cost cap soft warn @ 70% emits exactly ONE deliberationEvents row
- Cost cap hard halt @ 100% raises CostCapExceeded
- Tool-limit overrun produces both pipelineRuns.failed AND deliberationEvents 'agent-tool-limit-exceeded'
- EISENBALM_STUB_MODE default is "false"; "true" still works for regression
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-14-real-mode-integration-test-SUMMARY.md`.
</output>
