---
phase: 05-agent-quality
plan: 08
type: execute
wave: 3
depends_on:
  - "05-03"
  - "05-04"
  - "05-06"
  - "05-07"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
  - packages/pipeline/tests/agents/test_editor.py
autonomous: true
requirements_addressed:
  - AGT-06
  - AGT-17
must_haves:
  truths:
    - "Editor gate 1 selects winner = highest Advocate score by default (D-18)"
    - "Editor gate 1 calls interrupt() ONLY when top-two score gap < EDITOR_INTERRUPT_THRESHOLD=1.0 AND model-emitted confidence < 0.7"
    - "Before interrupt(), Editor writes pipelineRuns.status='awaiting-review' to Convex (Phase 4 D-13 ordering)"
    - "Editor emits deliberationTranscript as Markdown (NotebookLM-friendly format per RESEARCH §Editor Gate 1)"
    - "Editor emits one deliberationEvents row with eventType='editor-decision' on the success path"
    - "Editor uses Opus (voice-critical tier per D-05/D-06); modelVersions['editor_gate1'] populated (AGT-17)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/editor.py"
      provides: "Real Opus-driven Editor gate1 body — replaces Phase 4 stub"
      min_lines: 150
    - path: "packages/pipeline/tests/agents/test_editor.py"
      provides: "test_winner_selection + test_interrupt_threshold + test_transcript_format"
      contains: "EDITOR_INTERRUPT_THRESHOLD"
  key_links:
    - from: "agents/editor.py gate1 body"
      to: "state['advocate_votes']"
      via: "scores read from Plan 05-07 Advocate output"
      pattern: "advocate_votes"
    - from: "agents/editor.py interrupt path"
      to: "Convex pipelineRuns:updateStatus → 'awaiting-review'"
      via: "Phase 4 D-13 idempotency-before-interrupt"
      pattern: "awaiting-review"
    - from: "agents/editor.py success path"
      to: "deliberationEvents:insert eventType='editor-decision'"
      via: "@agent_node(emit_event='editor-decision') wrapper"
      pattern: "editor-decision"
---

<objective>
Replace the Phase 4 Editor stub body (gate-1 only — Editor Final is Plan 05-13) with a real Opus-driven implementation. Editor gate 1 is the most procedurally complex Wave-3 agent because it is the human-interrupt point.

Three concerns:

1. **Winner selection (AGT-06, D-18):** Default = highest `score` from `state['advocate_votes']`. Tie-breaking is deterministic (sort by score desc, then by `charityName` asc, then take index 0). Editor's LLM call returns `EditorDecision { winnerName, confidence, requiresHumanInput, editorReasoning, runnerUpNotes, deliberationTranscript }`. The Python code OVERRIDES `winnerName` to the deterministic top-score charity unless `requiresHumanInput=true` (which forces the interrupt path).

2. **Interrupt threshold (AGT-06, D-18):** Compute `score_gap = top_score - second_top_score`. Set `interrupt_triggered = (score_gap < EDITOR_INTERRUPT_THRESHOLD) AND (decision.confidence < 0.7) AND (decision.requiresHumanInput=True)`. When triggered:
   - Write `pipelineRuns:updateStatus` with `status='awaiting-review'` to Convex BEFORE calling `interrupt()` (Phase 4 D-13 — the write order is non-negotiable for idempotency-on-resume).
   - Call `interrupt({"prompt": ..., "candidates": ..., "topTwoScores": ...})`.
   - On resume, the `interrupt()` call returns the human-supplied winner name; override `decision.winnerName`.

3. **deliberationTranscript format (AGT-06, D-18):** Markdown with section headers matching RESEARCH §"Editor Gate 1" lines 484-504 verbatim. This is the NotebookLM podcast input — format is load-bearing for V2-02 manual export.

Output: `agents/editor.py` replaced for gate 1; `tests/agents/test_editor.py` skip markers removed; three real assertions land.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
@packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py
@packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py
@docs/CLAUDE_CODE_BRIEF.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- EditorDecision Pydantic (RESEARCH §"Editor Gate 1" lines 506-516) -->
```python
class EditorDecision(BaseModel):
    winnerName: str
    confidence: float
    requiresHumanInput: bool
    editorReasoning: str
    runnerUpNotes: str
    deliberationTranscript: str
```

<!-- interrupt() + Command(resume=...) — Phase 4 D-13 ordering -->
```python
from langgraph.types import interrupt

# BEFORE interrupt:
await convex_mutation_safe("pipelineRuns:updateStatus", {
    "runId": run_id, "status": "awaiting-review",
    "awaitingHumanAt": int(time.time() * 1000),
})
resume_value = interrupt({"prompt": "Select winner", ...})
# resume_value is supplied by LangGraph Command(resume=...) on resume.
```

<!-- @agent_node(emit_event='editor-decision') already in Phase 4 stub -->
```python
@agent_node(name="editor_gate1", emit_event="editor-decision")
async def editor_gate1(state: DispatchState) -> DispatchState:
    ...
```

<!-- deliberationTranscript Markdown template (RESEARCH §"Editor Gate 1" lines 484-504) -->
```markdown
# Eisenbalm Dispatch — Issue #{issueNumber} Deliberation

## Scout Findings
[one paragraph per candidate from scoutSummary]

## Advocate Arguments
### {charityName} — Score: {score}/10
{argument}
**Key Strengths:** {strengths}
**Primary Concern:** {concern}

## Editor Reasoning
{editorReasoning}
**Confidence:** {confidence:.0%}

## Decision
**Winner:** {winnerName}
**Runner-up notes:** {runnerUpNotes}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace Editor gate1 body with real Opus-driven implementation</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/editor.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py (Phase 4 stub — gate1 + final scaffold)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Editor Gate 1" lines 464-527
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-18 (interrupt rules)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-13 (idempotency-before-interrupt write order)
    - packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py (GraphInterrupt re-raise)
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py (acomplete)
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py (VOICE_CONSTRAINTS for system prompt)
    - docs/CLAUDE_CODE_BRIEF.md lines 119-138 (Editor contract)
    - docs/API_CONTRACTS.md §3.1 (pipelineRuns:updateStatus shape) + §3.4 (deliberationEvents:insert shape)
  </read_first>

  <behavior>
    - Test 1 (test_winner_selection): Two candidates scored 9.0 and 5.0 (gap=4.0); mock LLM returns confidence=0.9, requiresHumanInput=false. Assert winner = highest-score candidate; `interrupt()` NOT called; no `pipelineRuns:updateStatus` to 'awaiting-review'.
    - Test 2 (test_interrupt_threshold_triggers): Two candidates scored 7.5 and 7.0 (gap=0.5); mock LLM returns confidence=0.6, requiresHumanInput=true. Assert `pipelineRuns:updateStatus` with `status='awaiting-review'` IS called; `interrupt()` IS raised (via GraphInterrupt).
    - Test 3 (test_interrupt_threshold_skipped_when_confident): Two candidates scored 7.5 and 7.0 (gap=0.5); mock LLM returns confidence=0.9. Assert interrupt NOT raised even with narrow gap.
    - Test 4 (test_transcript_format): Assert `result['deliberation_transcript']` (or equivalent state field) contains `## Scout Findings`, `## Advocate Arguments`, `## Editor Reasoning`, `## Decision` Markdown section headers.
    - Test 5 (test_model_version_recorded): Assert `state['model_versions']['editor_gate1']` populated.
  </behavior>

  <action>
  REPLACE (or patch — preserve `editor_final` stub for Plan 05-13) the gate-1 portion of `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py`. Add the EditorDecision Pydantic + helpers + the @agent_node body:

  ```python
  """Phase 5 Editor — gate 1 + final (Opus via OpenRouter; voice-critical).

  Phase 5 Plan 05-08 implements gate 1 (winner selection + interrupt).
  Phase 5 Plan 05-13 implements final (consumes QA + emits editor-final).

  gate 1 responsibilities:
    1. Read state['candidates'] + state['advocate_votes'].
    2. Compute deterministic top-score winner + second-top for score-gap.
    3. Call Opus to produce EditorDecision (winnerName, confidence,
       requiresHumanInput, editorReasoning, runnerUpNotes,
       deliberationTranscript).
    4. If score_gap < 1.0 AND confidence < 0.7 AND requiresHumanInput=True:
       write status='awaiting-review' to Convex FIRST, then call interrupt().
       On resume, override winnerName with the human-supplied value.
    5. Otherwise: deterministic top-score wins; LLM's winnerName is ignored
       if it differs from the top-score charity.
    6. Record resolved model into state['model_versions']['editor_gate1'].

  emit_event='editor-decision': @agent_node wrapper emits ONE deliberationEvents
  row with eventType='editor-decision' on the success path. On interrupt, the
  GraphInterrupt re-raises out of the wrapper before emission (Phase 4 D-13).
  """
  from __future__ import annotations

  import time
  from typing import Any

  from langgraph.types import interrupt
  from pydantic import BaseModel, Field

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
  from eisenbalm_pipeline.lib.openrouter_client import acomplete
  from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


  # D-18 thresholds
  EDITOR_INTERRUPT_THRESHOLD: float = 1.0
  EDITOR_CONFIDENCE_THRESHOLD: float = 0.7


  class EditorDecision(BaseModel):
      """AGT-06 output (RESEARCH §"Editor Gate 1" lines 506-516)."""
      winnerName: str
      confidence: float = Field(ge=0.0, le=1.0)
      requiresHumanInput: bool
      editorReasoning: str
      runnerUpNotes: str
      deliberationTranscript: str


  def _sort_votes_by_score(votes: list[dict]) -> list[dict]:
      """Deterministic sort: score desc, then charityName asc."""
      return sorted(
          votes, key=lambda v: (-int(v.get("score", 0)), v.get("charityName", ""))
      )


  def _score_gap(sorted_votes: list[dict]) -> float:
      """Top-two score gap. Returns float('inf') when only one vote."""
      if len(sorted_votes) < 2:
          return float("inf")
      return float(sorted_votes[0]["score"]) - float(sorted_votes[1]["score"])


  def _format_deliberation_transcript(
      *,
      issue_number: int,
      candidates: list[dict],
      votes: list[dict],
      editor_reasoning: str,
      confidence: float,
      winner_name: str,
      runner_up_notes: str,
  ) -> str:
      """Markdown transcript per RESEARCH §"Editor Gate 1" lines 484-504.

      Format is load-bearing for V2-02 NotebookLM podcast export.
      """
      lines = [f"# Eisenbalm Dispatch — Issue #{issue_number} Deliberation\n"]

      lines.append("## Scout Findings\n")
      for c in candidates:
          lines.append(f"- **{c.get('name', 'unknown')}**: "
                       f"{c.get('scoutSummary', '')}\n")

      lines.append("\n## Advocate Arguments\n")
      for v in votes:
          lines.append(
              f"### {v.get('charityName', 'unknown')} — "
              f"Score: {v.get('score', 0)}/10\n"
          )
          lines.append(f"{v.get('argument', '')}\n")
          strengths = ", ".join(v.get("keyStrengths", []))
          lines.append(f"**Key Strengths:** {strengths}\n")
          lines.append(f"**Primary Concern:** {v.get('primaryConcern', '')}\n\n")

      lines.append("## Editor Reasoning\n")
      lines.append(f"{editor_reasoning}\n")
      lines.append(f"**Confidence:** {confidence:.0%}\n\n")

      lines.append("## Decision\n")
      lines.append(f"**Winner:** {winner_name}\n")
      lines.append(f"**Runner-up notes:** {runner_up_notes}\n")

      return "".join(lines)


  def _build_messages(
      *,
      candidates_with_scores: list[dict],
      issue_number: int,
  ) -> list[dict]:
      """System prompt embeds D-18 selection rules verbatim from RESEARCH."""
      import json
      candidates_block = json.dumps(candidates_with_scores, indent=2)
      system = (
          "You are the Editor for The Eisenbalm Dispatch. Select the charity "
          "for this issue.\n\n"
          "VOICE CONSTRAINTS (non-negotiable for editorReasoning and "
          "deliberationTranscript):\n"
          f"{VOICE_CONSTRAINTS}\n\n"
          "Rules:\n"
          "1. Highest Advocate score wins by default.\n"
          "2. Set confidence 0.0-1.0.\n"
          "3. If top two scores are within "
          f"{EDITOR_INTERRUPT_THRESHOLD} AND your confidence < "
          f"{EDITOR_CONFIDENCE_THRESHOLD}: set requiresHumanInput=true. "
          "Otherwise: requiresHumanInput=false.\n\n"
          "Then write deliberationTranscript in Markdown (format prescribed "
          "in the user message). This becomes the NotebookLM podcast source."
      )
      user = (
          f"Issue #{issue_number}\n\n"
          f"CANDIDATES WITH ADVOCATE SCORES:\n{candidates_block}\n\n"
          "Return JSON EditorDecision with: winnerName, confidence (0.0-1.0), "
          "requiresHumanInput (bool), editorReasoning (200-400 words), "
          "runnerUpNotes (50-150 words), deliberationTranscript (Markdown "
          "with sections: # Eisenbalm Dispatch — Issue #N Deliberation, "
          "## Scout Findings, ## Advocate Arguments, ## Editor Reasoning, "
          "## Decision)."
      )
      return [
          {"role": "system", "content": system},
          {"role": "user", "content": user},
      ]


  @agent_node(name="editor_gate1", emit_event="editor-decision")
  async def editor_gate1(state: DispatchState) -> DispatchState:
      run_id = state["run_id"]
      issue_number = state["issue_number"]
      candidates = state.get("candidates") or []
      votes = state.get("advocate_votes") or []

      # Deterministic ranking
      sorted_votes = _sort_votes_by_score(votes)
      top = sorted_votes[0] if sorted_votes else None
      score_gap = _score_gap(sorted_votes)

      candidates_with_scores = [
          {**v, "candidate": next(
              (c for c in candidates if c.get("name") == v.get("charityName")),
              {},
          )}
          for v in sorted_votes
      ]

      # LLM call
      messages = _build_messages(
          candidates_with_scores=candidates_with_scores,
          issue_number=issue_number,
      )
      decision_obj, usage = await acomplete(
          "editor_gate1", messages, response_format=EditorDecision,
      )
      decision = (
          decision_obj if isinstance(decision_obj, EditorDecision)
          else EditorDecision(**decision_obj)
      )

      # D-18: interrupt only when ALL three conditions hold.
      interrupt_triggered = (
          score_gap < EDITOR_INTERRUPT_THRESHOLD
          and decision.confidence < EDITOR_CONFIDENCE_THRESHOLD
          and decision.requiresHumanInput
      )

      winner_name = top["charityName"] if top else decision.winnerName

      if interrupt_triggered:
          # Phase 4 D-13: status='awaiting-review' write BEFORE interrupt().
          # This ensures idempotency — re-running this node post-resume does
          # not double-write because the wrapper's resume path re-enters
          # this function from the top.
          await convex_mutation_safe(
              "pipelineRuns:updateStatus",
              {
                  "runId": run_id,
                  "status": "awaiting-review",
                  "awaitingHumanAt": int(time.time() * 1000),
              },
          )
          resume_value: Any = interrupt({
              "prompt": "Select winner",
              "candidates": candidates_with_scores,
              "topTwoScores": [
                  {"name": sorted_votes[0]["charityName"],
                   "score": sorted_votes[0]["score"]},
                  {"name": sorted_votes[1]["charityName"],
                   "score": sorted_votes[1]["score"]},
              ],
              "editorReasoning": decision.editorReasoning,
          })
          # Resume: human-supplied winner overrides.
          if isinstance(resume_value, dict) and resume_value.get("winnerName"):
              winner_name = resume_value["winnerName"]
          elif isinstance(resume_value, str):
              winner_name = resume_value

      winning_charity = next(
          (c for c in candidates if c.get("name") == winner_name),
          (candidates[0] if candidates else {}),
      )

      transcript = _format_deliberation_transcript(
          issue_number=issue_number,
          candidates=candidates,
          votes=sorted_votes,
          editor_reasoning=decision.editorReasoning,
          confidence=decision.confidence,
          winner_name=winner_name,
          runner_up_notes=decision.runnerUpNotes,
      )

      model_versions = dict(state.get("model_versions") or {})
      model_versions["editor_gate1"] = usage["resolved_model"]

      return {
          **state,
          "winning_charity": winning_charity,
          "editor_decision": {
              "winnerName": winner_name,
              "confidence": decision.confidence,
              "requiresHumanInput": decision.requiresHumanInput,
              "editorReasoning": decision.editorReasoning,
              "runnerUpNotes": decision.runnerUpNotes,
          },
          "deliberation_transcript": transcript,
          "model_versions": model_versions,
      }
  ```

  PRESERVE any existing `editor_final` stub in this file untouched. Plan 05-13 will replace it.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.editor import editor_gate1, EditorDecision, EDITOR_INTERRUPT_THRESHOLD, _sort_votes_by_score, _score_gap; assert EDITOR_INTERRUPT_THRESHOLD == 1.0; sv = _sort_votes_by_score([{'score':5,'charityName':'B'},{'score':9,'charityName':'A'}]); assert sv[0]['charityName'] == 'A'; assert _score_gap(sv) == 4.0; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/editor.py` defines `EDITOR_INTERRUPT_THRESHOLD = 1.0`
    - `agents/editor.py` defines `EDITOR_CONFIDENCE_THRESHOLD = 0.7`
    - `agents/editor.py` defines `EditorDecision` Pydantic model with `winnerName, confidence, requiresHumanInput, editorReasoning, runnerUpNotes, deliberationTranscript`
    - `agents/editor.py` imports `interrupt` from `langgraph.types`
    - `_sort_votes_by_score` sorts by score desc, name asc, deterministically
    - `_score_gap` returns 4.0 for top scores [9, 5]
    - `_format_deliberation_transcript` returns Markdown containing `## Scout Findings`, `## Advocate Arguments`, `## Editor Reasoning`, `## Decision`
    - Editor body writes `pipelineRuns:updateStatus` with `status='awaiting-review'` BEFORE `interrupt()` (verifiable by line-number ordering — grep shows the updateStatus call appears before the interrupt call)
    - Decorator unchanged: `@agent_node(name="editor_gate1", emit_event="editor-decision")`
  </acceptance_criteria>

  <done>
  Editor gate 1 runs against real OpenRouter (Opus), selects winner deterministically by top score, emits Markdown deliberationTranscript, and uses interrupt() only when the gap-and-confidence rule triggers.
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace test_editor.py skip-skeletons with real assertions (gate 1 only)</name>
  <files>packages/pipeline/tests/agents/test_editor.py</files>

  <read_first>
    - packages/pipeline/tests/agents/test_editor.py (Plan 05-04 skeleton)
    - packages/pipeline/tests/conftest.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py (just-implemented from Task 1)
    - langgraph.errors.GraphInterrupt docs (already imported by _wrapper.py — `from langgraph.errors import GraphInterrupt`)
  </read_first>

  <action>
  REPLACE the gate-1 tests in `packages/pipeline/tests/agents/test_editor.py` with:

  ```python
  """Phase 5 Editor gate-1 unit tests — implemented by Plan 05-08.

  Validation: AGT-06 (winner selection + interrupt threshold), AGT-17.
  Editor Final tests land in Plan 05-13.
  """
  from __future__ import annotations

  from unittest.mock import AsyncMock, patch

  import pytest
  from langgraph.errors import GraphInterrupt

  from eisenbalm_pipeline.agents.editor import (
      EDITOR_CONFIDENCE_THRESHOLD,
      EDITOR_INTERRUPT_THRESHOLD,
      EditorDecision,
      _score_gap,
      _sort_votes_by_score,
      _format_deliberation_transcript,
      editor_gate1,
  )


  def _make_state_with_votes(scores: list[tuple[str, int]]) -> dict:
      votes = [
          {"charityName": name, "score": score, "argument": "x" * 200,
           "keyStrengths": ["a", "b"], "primaryConcern": "c"}
          for name, score in scores
      ]
      candidates = [
          {"name": name, "scoutSummary": f"summary of {name}",
           "location": "NYC", "website": f"https://{name.lower()}.example",
           "missionStatement": "m"}
          for name, _ in scores
      ]
      return {
          "run_id": "run-test",
          "issue_number": 42,
          "candidates": candidates,
          "advocate_votes": votes,
          "model_versions": {},
      }


  def test_sort_and_gap() -> None:
      sv = _sort_votes_by_score([
          {"charityName": "B", "score": 5},
          {"charityName": "A", "score": 9},
      ])
      assert sv[0]["charityName"] == "A"
      assert _score_gap(sv) == 4.0


  def test_thresholds() -> None:
      assert EDITOR_INTERRUPT_THRESHOLD == 1.0
      assert EDITOR_CONFIDENCE_THRESHOLD == 0.7


  def test_transcript_format() -> None:
      """AGT-06: deliberationTranscript Markdown format (NotebookLM-friendly)."""
      transcript = _format_deliberation_transcript(
          issue_number=42,
          candidates=[{"name": "Foo", "scoutSummary": "obscure"}],
          votes=[{"charityName": "Foo", "score": 9, "argument": "good",
                  "keyStrengths": ["a"], "primaryConcern": "small"}],
          editor_reasoning="Foo is best.",
          confidence=0.9,
          winner_name="Foo",
          runner_up_notes="None.",
      )
      assert "# Eisenbalm Dispatch — Issue #42 Deliberation" in transcript
      assert "## Scout Findings" in transcript
      assert "## Advocate Arguments" in transcript
      assert "## Editor Reasoning" in transcript
      assert "## Decision" in transcript
      assert "**Winner:** Foo" in transcript


  @pytest.mark.asyncio
  async def test_winner_selection_deterministic() -> None:
      """AGT-06: highest-score winner; no interrupt when gap wide."""
      state = _make_state_with_votes([("LowOrg", 5), ("HighOrg", 9)])
      decision = EditorDecision(
          winnerName="HighOrg", confidence=0.9, requiresHumanInput=False,
          editorReasoning="r", runnerUpNotes="n", deliberationTranscript="t",
      )
      mock_convex = AsyncMock()
      with patch(
          "eisenbalm_pipeline.agents.editor.acomplete",
          AsyncMock(return_value=(decision, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-opus-4-7",
          })),
      ), patch(
          "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
      ):
          result = await editor_gate1(state)

      assert result["winning_charity"]["name"] == "HighOrg"
      # interrupt path NOT taken — no awaiting-review write
      awaiting_calls = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "pipelineRuns:updateStatus"
          and c.args[1].get("status") == "awaiting-review"
      ]
      assert len(awaiting_calls) == 0


  @pytest.mark.asyncio
  async def test_interrupt_threshold_triggers() -> None:
      """AGT-06: narrow gap + low confidence + requiresHumanInput=True triggers interrupt."""
      state = _make_state_with_votes([("OrgA", 7), ("OrgB", 7)])  # gap=0
      decision = EditorDecision(
          winnerName="OrgA", confidence=0.5, requiresHumanInput=True,
          editorReasoning="r", runnerUpNotes="n", deliberationTranscript="t",
      )
      mock_convex = AsyncMock()
      with patch(
          "eisenbalm_pipeline.agents.editor.acomplete",
          AsyncMock(return_value=(decision, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-opus-4-7",
          })),
      ), patch(
          "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
      ):
          with pytest.raises(GraphInterrupt):
              await editor_gate1(state)

      # status='awaiting-review' MUST be written BEFORE interrupt
      awaiting_calls = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "pipelineRuns:updateStatus"
          and c.args[1].get("status") == "awaiting-review"
      ]
      assert len(awaiting_calls) >= 1


  @pytest.mark.asyncio
  async def test_interrupt_skipped_when_confident() -> None:
      """AGT-06: narrow gap + HIGH confidence skips interrupt."""
      state = _make_state_with_votes([("OrgA", 7), ("OrgB", 7)])
      decision = EditorDecision(
          winnerName="OrgA", confidence=0.95, requiresHumanInput=False,
          editorReasoning="r", runnerUpNotes="n", deliberationTranscript="t",
      )
      mock_convex = AsyncMock()
      with patch(
          "eisenbalm_pipeline.agents.editor.acomplete",
          AsyncMock(return_value=(decision, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-opus-4-7",
          })),
      ), patch(
          "eisenbalm_pipeline.agents.editor.convex_mutation_safe", mock_convex,
      ):
          result = await editor_gate1(state)

      # No interrupt; deterministic winner picked
      assert result["winning_charity"]["name"] == "OrgA"
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_editor.py::test_winner_selection_deterministic tests/agents/test_editor.py::test_interrupt_threshold_triggers tests/agents/test_editor.py::test_interrupt_skipped_when_confident tests/agents/test_editor.py::test_transcript_format tests/agents/test_editor.py::test_thresholds tests/agents/test_editor.py::test_sort_and_gap -x -v 2>&1 | tail -30</automated>
  </verify>

  <acceptance_criteria>
    - All 6 gate-1 tests pass
    - `test_winner_selection_deterministic` asserts no `awaiting-review` write
    - `test_interrupt_threshold_triggers` asserts `GraphInterrupt` raised AND awaiting-review write BEFORE the raise
    - `test_interrupt_skipped_when_confident` asserts no interrupt with confidence=0.95
    - `test_transcript_format` asserts all 4 Markdown section headers present
  </acceptance_criteria>

  <done>
  Editor gate-1 verified end-to-end including the D-18 narrow-gap + low-confidence interrupt rule and Markdown transcript format.
  </done>
</task>

</tasks>

<verification>
- `EISENBALM_STUB_MODE=true pytest tests/agents/test_editor.py -x -k "not editor_final"` exits 0
- `grep -c 'awaiting-review' packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` returns ≥ 1
- `grep -c 'EDITOR_INTERRUPT_THRESHOLD' packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` returns ≥ 2
- `grep -c '## Scout Findings' packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` returns ≥ 1
</verification>

<success_criteria>
- Editor gate-1 body real; uses Opus
- Deterministic top-score winner by default
- interrupt() fires only on (gap<1.0) AND (confidence<0.7) AND (requiresHumanInput=true)
- pipelineRuns:updateStatus 'awaiting-review' write precedes interrupt()
- deliberationTranscript Markdown contains all 4 required section headers
- modelVersions['editor_gate1'] populated
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-08-editor-gate1-SUMMARY.md`.
</output>
