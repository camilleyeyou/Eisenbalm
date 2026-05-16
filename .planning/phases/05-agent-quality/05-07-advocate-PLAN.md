---
phase: 05-agent-quality
plan: 07
type: execute
wave: 3
depends_on:
  - "05-03"
  - "05-04"
  - "05-06"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py
  - packages/pipeline/tests/agents/test_advocate.py
autonomous: true
requirements_addressed:
  - AGT-05
must_haves:
  truths:
    - "Advocate scores each Scout candidate 1-10 with a 150-250 word argument, 2-4 key strengths, and one primary concern"
    - "Advocate writes one agentVotes:insert row per candidate (API_CONTRACTS §3.5)"
    - "Advocate emits one advocate-argument deliberationEvents row per candidate (API_CONTRACTS §3.4)"
    - "Advocate runs against Haiku (mechanical tier per D-05); modelVersions['advocate'] populated (AGT-17)"
    - "Advocate output is structurally valid AdvocateOutput Pydantic (votes list shape)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py"
      provides: "Real Haiku-driven Advocate body — replaces Phase 4 stub"
      min_lines: 90
    - path: "packages/pipeline/tests/agents/test_advocate.py"
      provides: "test_scoring + test_agent_votes_written + test_argument_event_emitted"
      contains: "agentVotes:insert"
  key_links:
    - from: "agents/advocate.py per-candidate loop"
      to: "Convex agentVotes:insert"
      via: "one row per Scout candidate (API_CONTRACTS §3.5)"
      pattern: "agentVotes:insert"
    - from: "agents/advocate.py per-candidate loop"
      to: "Convex deliberationEvents:insert with eventType='advocate-argument'"
      via: "one event row per candidate (API_CONTRACTS §3.4)"
      pattern: "advocate-argument"
---

<objective>
Replace the Phase 4 Advocate stub body with a real Haiku-driven implementation. Advocate is the second Wave-3 agent (after Scout) and the first plan to exercise the `agentVotes:insert` mutation + per-candidate `deliberationEvents:insert` pattern that Editor gate 1 inherits.

Per RESEARCH §"Advocate" lines 432-462 the Pydantic output is `AdvocateOutput { votes: list[AdvocateVote] }` where `AdvocateVote = { charityName, score (1-10), argument (150-250 words), keyStrengths (2-4), primaryConcern }`. Advocate runs once over all Scout candidates and returns a structured list.

Two concerns:

1. **Per-candidate writes (AGT-05):** For each `AdvocateVote`, write one `agentVotes:insert` row to Convex (API_CONTRACTS §3.5 exact shape) AND one `deliberationEvents:insert` row with `eventType='advocate-argument'` (API_CONTRACTS §3.4). Both writes use `convex_mutation_safe` (logs + continues per Phase 4 D-21). The `@agent_node` decorator's `emit_event="advocate-argument"` is NOT used here because Advocate emits per-candidate events; the decorator's single-event emission is suppressed by setting `emit_event=None` and emitting manually in the body. (The deliberationEvents.eventType union DOES include 'advocate-argument' per Plan 05-01.)

2. **Model recording (AGT-17):** After `acomplete()` returns, write the resolved model into `state['model_versions']['advocate']`.

Per Phase 4 stub structure: Advocate is called once after Scout returns N candidates; it scores them in a single LLM call (not one call per candidate — that would exceed the per-run cost cap).

Output: `agents/advocate.py` replaced; `tests/agents/test_advocate.py` skip markers removed; three real assertions land.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py
@packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py
@docs/CLAUDE_CODE_BRIEF.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- API_CONTRACTS §3.5 — agentVotes:insert exact field names -->
```python
await convex_mutation_safe("agentVotes:insert", {
    "runId": run_id,
    "agentId": "advocate",
    "charityId": charity_id,
    "vote": "yes" | "no" | "abstain",  # always 'yes' from Advocate (advocates always advocate)
    "score": int,  # 1-10
    "reasoning": str,  # the full argument
})
```

<!-- API_CONTRACTS §3.4 — deliberationEvents:insert with eventType='advocate-argument' -->
```python
await convex_mutation_safe("deliberationEvents:insert", {
    "runId": run_id,
    "agentId": "advocate",
    "eventType": "advocate-argument",
    "payload": json.dumps({"charityName": ..., "score": ..., "argument": ...}),
    "charityId": charity_id,  # optional but recommended for filtering
})
```

<!-- AdvocateOutput Pydantic (RESEARCH §Advocate lines 447-458) -->
```python
class AdvocateVote(BaseModel):
    charityName: str
    score: int  # 1-10
    argument: str  # 150-250 words
    keyStrengths: list[str]  # 2-4 items
    primaryConcern: str

class AdvocateOutput(BaseModel):
    votes: list[AdvocateVote]
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace Advocate stub body with real Haiku-driven implementation</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py (Phase 4 stub)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Advocate" lines 432-462
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-05 (Haiku tier), D-07 (temperature=0.3)
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py (acomplete)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (convex_mutation_safe)
    - docs/CLAUDE_CODE_BRIEF.md lines 105-117 (Advocate contract)
    - docs/API_CONTRACTS.md §3.4 (deliberationEvents:insert) + §3.5 (agentVotes:insert)
  </read_first>

  <behavior>
    - Test 1 (test_scoring): Mock acomplete to return AdvocateOutput with 3 votes scored 7, 5, 9; assert state['advocate_votes'] has 3 entries with scores preserved.
    - Test 2 (test_agent_votes_written): Assert `convex_mutation_safe('agentVotes:insert', ...)` was called once per candidate with `vote='yes'` and the score field populated.
    - Test 3 (test_argument_event_emitted): Assert `convex_mutation_safe('deliberationEvents:insert', ...)` was called once per candidate with `eventType='advocate-argument'`.
    - Test 4 (test_model_version_recorded): Assert `state['model_versions']['advocate']` equals the resolved model.
  </behavior>

  <action>
  REPLACE the contents of `packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py` with the following. Copy the system prompt verbatim from RESEARCH §"Advocate":

  ```python
  """Phase 5 Advocate — scores each Scout candidate (Haiku via OpenRouter).

  Replaces Phase 4 stub. Responsibilities:

    1. Receive state['candidates'] from Scout (Plan 05-06).
    2. Call OpenRouter (Haiku, low-temp) ONCE over all candidates.
    3. Parse AdvocateOutput Pydantic (list of AdvocateVote).
    4. For each vote: write one agentVotes:insert row + one
       deliberationEvents:insert with eventType='advocate-argument'.
    5. Record resolved model into state['model_versions']['advocate'] (AGT-17).

  emit_event=None: per-candidate events are emitted manually inside the body
  (one row per vote). The @agent_node decorator's single emission is suppressed
  because Advocate is fundamentally per-candidate.
  """
  from __future__ import annotations

  import json
  from typing import Literal

  from pydantic import BaseModel, Field

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
  from eisenbalm_pipeline.lib.openrouter_client import acomplete


  class AdvocateVote(BaseModel):
      """AGT-05 per-candidate Pydantic shape (RESEARCH §Advocate lines 447-453)."""
      charityName: str
      score: int = Field(ge=1, le=10)
      argument: str = Field(
          description="150-250 word argument for this charity in Jesse voice"
      )
      keyStrengths: list[str] = Field(min_length=2, max_length=4)
      primaryConcern: str


  class AdvocateOutput(BaseModel):
      """Top-level shape returned by the LLM."""
      votes: list[AdvocateVote]


  def _build_messages(*, candidates: list[dict]) -> list[dict]:
      """System prompt embeds Advocate's voice and scoring rule verbatim
      from RESEARCH §Advocate lines 434-445."""
      candidates_json = json.dumps(candidates, indent=2)
      system = (
          "You are the Advocate for The Eisenbalm Dispatch. Score each Scout "
          "candidate 1-10 with a written argument. Surface the case for each "
          "charity without editorializing. Dry. Precise. Serious.\n\n"
          "For each candidate output: score (1-10), argument (150-250 words), "
          "keyStrengths (2-4 items), primaryConcern (one sentence)."
      )
      user = (
          f"CANDIDATES (Scout output, JSON):\n{candidates_json}\n\n"
          "Return JSON AdvocateOutput with field `votes` (one AdvocateVote "
          "per candidate, same order as input)."
      )
      return [
          {"role": "system", "content": system},
          {"role": "user", "content": user},
      ]


  def _charity_id_for(name: str) -> str:
      """Deterministic Sanity _id mirror (Phase 1 D-17 pattern).

      Scout's write_charity already used the same slugify rule. We re-derive
      here for the agentVotes row charityId field.
      """
      slug = name.strip().lower().replace(" ", "-")
      return f"charity-{slug}"


  @agent_node(name="advocate", emit_event=None)
  async def advocate(state: DispatchState) -> DispatchState:
      run_id = state["run_id"]
      candidates = state.get("candidates") or []

      messages = _build_messages(candidates=candidates)
      out_obj, usage = await acomplete(
          "advocate", messages, response_format=AdvocateOutput,
      )

      votes_raw = (
          out_obj.votes if hasattr(out_obj, "votes")
          else out_obj["votes"]
      )

      votes_serialized: list[dict] = []
      for v_raw in votes_raw:
          v = (
              v_raw if isinstance(v_raw, AdvocateVote)
              else AdvocateVote(**v_raw)
          )
          charity_id = _charity_id_for(v.charityName)

          # 1. agentVotes:insert (API_CONTRACTS §3.5).
          await convex_mutation_safe(
              "agentVotes:insert",
              {
                  "runId": run_id,
                  "agentId": "advocate",
                  "charityId": charity_id,
                  "vote": "yes",  # Advocate always advocates; abstention = drop
                  "score": v.score,
                  "reasoning": v.argument,
              },
          )

          # 2. deliberationEvents:insert with eventType='advocate-argument'
          # (API_CONTRACTS §3.4; Plan 05-01 patched union accepts this literal).
          await convex_mutation_safe(
              "deliberationEvents:insert",
              {
                  "runId": run_id,
                  "agentId": "advocate",
                  "eventType": "advocate-argument",
                  "payload": json.dumps({
                      "charityName": v.charityName,
                      "score": v.score,
                      "argument": v.argument,
                      "keyStrengths": v.keyStrengths,
                      "primaryConcern": v.primaryConcern,
                  }),
                  "charityId": charity_id,
              },
          )

          votes_serialized.append(v.model_dump())

      # AGT-17: record resolved model.
      model_versions = dict(state.get("model_versions") or {})
      model_versions["advocate"] = usage["resolved_model"]

      return {
          **state,
          "advocate_votes": votes_serialized,
          "model_versions": model_versions,
      }
  ```

  Sanity check: `EISENBALM_STUB_MODE=true python -c "from eisenbalm_pipeline.agents.advocate import advocate, AdvocateVote, AdvocateOutput"` imports cleanly.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.advocate import advocate, AdvocateVote, _charity_id_for; assert _charity_id_for('Foo Org') == 'charity-foo-org'; v = AdvocateVote(charityName='Foo', score=8, argument='x'*200, keyStrengths=['a','b'], primaryConcern='c'); assert v.score == 8; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/advocate.py` imports `acomplete` from `lib.openrouter_client`
    - `agents/advocate.py` imports `convex_mutation_safe` from `lib.convex_client`
    - `grep -c "'agentVotes:insert'" agents/advocate.py` returns ≥ 1
    - `grep -c "'advocate-argument'" agents/advocate.py` returns ≥ 1
    - `grep -c "'deliberationEvents:insert'" agents/advocate.py` returns ≥ 1
    - `AdvocateVote(score=11, ...)` raises Pydantic validation error (score capped at 10)
    - `_charity_id_for('Foo Org')` returns `'charity-foo-org'`
    - Function signature unchanged: `async def advocate(state: DispatchState) -> DispatchState`
    - Decorator: `@agent_node(name="advocate", emit_event=None)` (NOT emit_event="advocate-argument" — emitted manually per candidate)
    - Return dict contains `advocate_votes` and `model_versions`
  </acceptance_criteria>

  <done>
  Advocate runs against real OpenRouter (Haiku), scores each candidate, writes per-candidate Convex rows for agentVotes + deliberationEvents.
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace test_advocate.py skip-skeletons with real assertions</name>
  <files>packages/pipeline/tests/agents/test_advocate.py</files>

  <read_first>
    - packages/pipeline/tests/agents/test_advocate.py (Plan 05-04 skeleton)
    - packages/pipeline/tests/conftest.py (mock fixtures)
    - packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py (just-implemented from Task 1)
  </read_first>

  <action>
  REPLACE `packages/pipeline/tests/agents/test_advocate.py` with:

  ```python
  """Phase 5 Advocate unit tests — implemented by Plan 05-07.

  Validation: AGT-05 (scores written + events emitted), AGT-17 (modelVersions).
  """
  from __future__ import annotations

  from unittest.mock import AsyncMock, patch

  import pytest

  from eisenbalm_pipeline.agents.advocate import (
      AdvocateOutput,
      AdvocateVote,
      _charity_id_for,
      advocate,
  )


  def _make_votes(scores: list[int]) -> AdvocateOutput:
      return AdvocateOutput(votes=[
          AdvocateVote(
              charityName=f"Org {i}", score=s, argument="x" * 200,
              keyStrengths=["a", "b"], primaryConcern="concern",
          )
          for i, s in enumerate(scores)
      ])


  def test_charity_id_for() -> None:
      assert _charity_id_for("Foo Org") == "charity-foo-org"
      assert _charity_id_for("Bar  Org") == "charity-bar--org"


  @pytest.mark.asyncio
  async def test_scoring(sample_dispatch_state) -> None:
      """AGT-05: each candidate scored 1-10; votes returned in state."""
      sample_dispatch_state["candidates"] = [
          {"name": "Org 0"}, {"name": "Org 1"}, {"name": "Org 2"}
      ]
      out = _make_votes([7, 5, 9])
      mock_convex = AsyncMock()

      with patch(
          "eisenbalm_pipeline.agents.advocate.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 100, "tokens_out": 50, "usd": 0.01,
              "resolved_model": "anthropic/claude-haiku-4-5",
          })),
      ), patch(
          "eisenbalm_pipeline.agents.advocate.convex_mutation_safe", mock_convex,
      ):
          result = await advocate(sample_dispatch_state)

      assert len(result["advocate_votes"]) == 3
      scores = [v["score"] for v in result["advocate_votes"]]
      assert scores == [7, 5, 9]


  @pytest.mark.asyncio
  async def test_agent_votes_written(sample_dispatch_state) -> None:
      """AGT-05: agentVotes:insert called once per candidate."""
      sample_dispatch_state["candidates"] = [{"name": "Org 0"}, {"name": "Org 1"}]
      out = _make_votes([8, 6])
      mock_convex = AsyncMock()

      with patch(
          "eisenbalm_pipeline.agents.advocate.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-haiku-4-5",
          })),
      ), patch(
          "eisenbalm_pipeline.agents.advocate.convex_mutation_safe", mock_convex,
      ):
          await advocate(sample_dispatch_state)

      agent_votes_calls = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "agentVotes:insert"
      ]
      assert len(agent_votes_calls) == 2
      assert all(c.args[1]["vote"] == "yes" for c in agent_votes_calls)
      assert {c.args[1]["score"] for c in agent_votes_calls} == {8, 6}


  @pytest.mark.asyncio
  async def test_argument_event_emitted(sample_dispatch_state) -> None:
      """AGT-05: deliberationEvents:insert with eventType='advocate-argument' per candidate."""
      sample_dispatch_state["candidates"] = [{"name": "Org 0"}, {"name": "Org 1"}]
      out = _make_votes([8, 6])
      mock_convex = AsyncMock()

      with patch(
          "eisenbalm_pipeline.agents.advocate.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-haiku-4-5",
          })),
      ), patch(
          "eisenbalm_pipeline.agents.advocate.convex_mutation_safe", mock_convex,
      ):
          await advocate(sample_dispatch_state)

      event_calls = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "deliberationEvents:insert"
          and c.args[1].get("eventType") == "advocate-argument"
      ]
      assert len(event_calls) == 2


  @pytest.mark.asyncio
  async def test_model_version_recorded(sample_dispatch_state) -> None:
      """AGT-17: model_versions['advocate'] set after run."""
      sample_dispatch_state["candidates"] = [{"name": "Org 0"}]
      out = _make_votes([7])

      with patch(
          "eisenbalm_pipeline.agents.advocate.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-haiku-4-5-20251001",
          })),
      ), patch(
          "eisenbalm_pipeline.agents.advocate.convex_mutation_safe", AsyncMock(),
      ):
          result = await advocate(sample_dispatch_state)

      assert result["model_versions"]["advocate"] == "anthropic/claude-haiku-4-5-20251001"
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_advocate.py -x -v 2>&1 | tail -30</automated>
  </verify>

  <acceptance_criteria>
    - `pytest tests/agents/test_advocate.py -x` exits 0 with ≥4 tests passing
    - No `@pytest.mark.skip` decorator remains
    - `test_agent_votes_written` asserts ≥2 `agentVotes:insert` calls with `vote='yes'`
    - `test_argument_event_emitted` asserts ≥2 events with `eventType='advocate-argument'`
    - `test_scoring` asserts `len(result['advocate_votes']) == 3`
  </acceptance_criteria>

  <done>
  Advocate test suite verifies AGT-05 mechanically.
  </done>
</task>

</tasks>

<verification>
- `EISENBALM_STUB_MODE=true pytest tests/agents/test_advocate.py -x` exits 0
- `EISENBALM_STUB_MODE=true pytest tests/ -x -q --timeout=30` exits 0
- `grep -c "advocate-argument" packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py` returns ≥ 1
- `grep -c "agentVotes:insert" packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py` returns ≥ 1
</verification>

<success_criteria>
- Advocate body is real (single LLM call over all candidates)
- One agentVotes:insert per candidate
- One deliberationEvents:insert (eventType='advocate-argument') per candidate
- modelVersions['advocate'] populated
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-07-advocate-SUMMARY.md`.
</output>
