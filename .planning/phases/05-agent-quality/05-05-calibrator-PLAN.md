---
phase: 05-agent-quality
plan: 05
type: execute
wave: 3
depends_on:
  - "05-03"
  - "05-04"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
  - packages/pipeline/tests/agents/test_calibrator.py
autonomous: true
requirements_addressed:
  - AGT-01
  - AGT-02
  - AGT-17
must_haves:
  truths:
    - "Calibrator queries Sanity for last 3 published issues' bonusType via GROQ"
    - "Calibrator picks bonusType ∈ {bigBudget, jingle, specAd} that is NOT the most recent issue's bonusType"
    - "Calibrator selection is deterministic given issueNumber + previous bonusTypes (re-runs produce same output)"
    - "Calibrator system prompt contains VOICE_CONSTRAINTS verbatim from lib/voice.py (AGT-02)"
    - "Calibrator records resolved model into state['model_versions']['calibrator'] (AGT-17)"
    - "Calibrator output is structurally valid StyleBrief (Pydantic-validated)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py"
      provides: "Real LLM-driven Calibrator body — replaces Phase 4 stub"
      min_lines: 80
    - path: "packages/pipeline/tests/agents/test_calibrator.py"
      provides: "test_bonus_rotation + test_voice_constants assertions"
      contains: "test_bonus_rotation"
  key_links:
    - from: "agents/calibrator.py system prompt"
      to: "lib/voice.py VOICE_CONSTRAINTS"
      via: "verbatim string embed (AGT-02 enforcement)"
      pattern: "VOICE_CONSTRAINTS"
    - from: "agents/calibrator.py rotation logic"
      to: "Sanity GROQ query last 3 weeklyIssue.bonusType"
      via: "deterministic tie-break by (issueNumber + offset) mod 3"
      pattern: "previousBonusTypes"
    - from: "agents/calibrator.py acomplete call"
      to: "state['model_versions']['calibrator']"
      via: "resolved_model from openrouter_client.acomplete return tuple"
      pattern: "model_versions"
---

<objective>
Replace the Phase 4 Calibrator stub body with a real LLM-driven implementation. Calibrator is the first voice-critical agent (Opus pinned per D-05/D-06) and the FIRST agent to land the `modelVersions` write pattern that every subsequent voice-critical plan inherits (AGT-17).

Three concerns:

1. **BonusType rotation (AGT-01, D-17):** Query Sanity for the last 3 published issues' `bonusType` field via GROQ. Pick one of `{bigBudget, jingle, specAd}` that does NOT match the most recent issue's bonusType. Tie-break deterministically: `(issueNumber + offset) mod 3` so re-runs of the same `issueNumber` always pick the same bonusType.

2. **Voice constants (AGT-02, D-13):** System prompt embeds `VOICE_CONSTRAINTS` verbatim from `lib/voice.py`. Calibrator never re-authors voice — it consumes the canonical string.

3. **modelVersions (AGT-17, D-06):** After `acomplete()` returns, write the resolved model into `state['model_versions']['calibrator']`. This is the first write to that dict; every voice-critical plan (Editor gate 1, Editor Final, QA) follows the same pattern.

Per RESEARCH §"Calibrator" lines 369-394 the Pydantic output is `StyleBrief` with `voice, constraints (3-5 items), bonusType, visualDirection`. The Phase 4 `StyleBrief` TypedDict in `graph/state.py` already has these fields plus `previousBonusTypes` — the new code MUST satisfy the existing TypedDict.

Calibrator emits NO `deliberationEvents` row (the union does not include a calibrator literal; Phase 4 stub set `emit_event=None`; Phase 5 keeps this).

Purpose: Wave 3 entry point. After Plan 05-05, the pipeline can run with one real voice-critical agent + 13 stubs and the integration test surface keeps working. Establishes the model-version capture pattern.

Output: `agents/calibrator.py` replaced; `tests/agents/test_calibrator.py` skip markers removed and replaced with real assertions; commit lands.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
@packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py
@packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
@packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py
@docs/CLAUDE_CODE_BRIEF.md

<interfaces>
<!-- StyleBrief TypedDict (graph/state.py lines 15-20) — output MUST match -->
```python
class StyleBrief(TypedDict):
    voice: str
    constraints: list[str]
    bonusType: Literal['bigBudget', 'jingle', 'specAd']
    visualDirection: str
    previousBonusTypes: list[str]
```

<!-- lib/openrouter_client.acomplete (Plan 05-03) returns: -->
```python
# (content, usage_dict_with_resolved_model)
content, usage = await acomplete("calibrator", messages, response_format=StyleBriefPydantic)
# usage = {"tokens_in": int, "tokens_out": int, "usd": float, "resolved_model": str}
```

<!-- @agent_node contract (locked Phase 4): -->
```python
@agent_node(name="calibrator", emit_event=None)
async def calibrator(state: DispatchState) -> DispatchState:
    ...
    return {**state, "style_brief": brief, "model_versions": {...}}
```

<!-- Sanity GROQ for previous bonusTypes (RESEARCH §"Calibrator" + CONTEXT D-17): -->
```groq
*[_type == "weeklyIssue" && status == "published"] | order(issueNumber desc)[0..2]{ bonusType, issueNumber }
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace Calibrator stub body with real LLM-driven implementation</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py (current stub — lines 1-19)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Per-Agent Prompt + Output Schema Sketches — Calibrator" lines 367-395
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Pattern 1: OpenRouter Client" (acomplete signature)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-13 (lib/voice.py is source of truth), D-17 (rotation rule)
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py (VOICE_CONSTRAINTS string — Plan 05-03)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (existing get_client + GROQ helper)
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py (acomplete signature — Plan 05-03)
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py lines 15-20 (StyleBrief)
    - docs/CLAUDE_CODE_BRIEF.md lines 359-367 (Jesse voice notes — source for VOICE_CONSTRAINTS)
  </read_first>

  <behavior>
    - Test 1 (test_voice_constants): Calibrator's assembled system prompt MUST contain `VOICE_CONSTRAINTS` substring verbatim from `lib/voice.py`. The prompt is built via a deterministic helper; assert by patching `acomplete` and checking the first message's content.
    - Test 2 (test_bonus_rotation): Given `previousBonusTypes=['jingle', 'bigBudget', 'specAd']` and `issueNumber=42`, Calibrator MUST NOT pick `'jingle'` (the most recent — first in the list per `order(issueNumber desc)`). Re-running with same inputs MUST produce same `bonusType` (deterministic tie-break).
    - Test 3 (test_model_versions_recording): After Calibrator runs, `state['model_versions']['calibrator']` MUST equal the `resolved_model` returned by acomplete.
  </behavior>

  <action>
  REPLACE the contents of `packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py` with the following. Copy the system prompt structure verbatim from RESEARCH §"Calibrator" — do NOT paraphrase the rotation rule or the voice block:

  ```python
  """Phase 5 Calibrator — voice-critical agent (Opus pinned per D-05).

  Replaces Phase 4 stub. Responsibilities:

    1. Query Sanity for last 3 published issues' bonusType (D-17 rotation rule).
    2. Pick bonusType ∈ {bigBudget, jingle, specAd} that is NOT the most recent
       (deterministic tie-break by (issueNumber + offset) mod 3).
    3. Call OpenRouter (Opus pinned) with a system prompt that embeds
       VOICE_CONSTRAINTS verbatim from lib/voice.py (AGT-02).
    4. Record resolved model into state['model_versions']['calibrator'] (AGT-17).

  emit_event=None — the Convex deliberationEvents.eventType union (Plan 05-01
  patched, 9 literals) still does NOT include a 'calibrator-brief' literal.
  StyleBrief lands on weeklyIssue.calibratorBrief at Sanity write time (Publisher).
  """
  from __future__ import annotations

  from typing import Literal

  from pydantic import BaseModel, Field

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.openrouter_client import acomplete
  from eisenbalm_pipeline.lib.sanity_client import groq_query
  from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


  BONUS_TYPES: tuple[str, ...] = ("bigBudget", "jingle", "specAd")


  class StyleBriefOutput(BaseModel):
      """Pydantic schema for LLM structured output. Maps 1:1 to graph.state.StyleBrief."""
      voice: str = Field(description="Jesse voice summary — copy from VOICE_CONSTRAINTS")
      constraints: list[str] = Field(min_length=3, max_length=5,
                                     description="3-5 specific rules this week")
      bonusType: Literal["bigBudget", "jingle", "specAd"]
      visualDirection: str = Field(description="Aesthetic direction for DesignAgent")


  async def _fetch_previous_bonus_types() -> list[str]:
      """Query Sanity for last 3 published issues' bonusType.

      Returns list ordered most-recent-first. Empty list if fewer than 1 issue
      has been published (first-issue case).
      """
      query = (
          '*[_type == "weeklyIssue" && status == "published"] '
          '| order(issueNumber desc)[0..2]{ bonusType, issueNumber }'
      )
      try:
          rows = await groq_query(query)
      except Exception:
          return []  # First-run safety — no published issues yet
      return [row["bonusType"] for row in rows if row.get("bonusType")]


  def _pick_bonus_type(previous: list[str], issue_number: int) -> str:
      """Deterministic bonusType rotation (D-17).

      Args:
          previous: list of last 3 bonusTypes, most-recent-first. May be empty.
          issue_number: current issueNumber (deterministic tie-break input).

      Returns:
          One of BONUS_TYPES, never equal to previous[0] when previous is non-empty.
      """
      most_recent = previous[0] if previous else None
      candidates = [b for b in BONUS_TYPES if b != most_recent]
      # Deterministic tie-break: (issueNumber + 0) mod len(candidates).
      # Re-runs of the same issueNumber produce the same bonusType.
      idx = issue_number % len(candidates)
      return candidates[idx]


  def _build_messages(
      *,
      issue_number: int,
      previous_bonus_types: list[str],
      chosen_bonus_type: str,
  ) -> list[dict]:
      """Assemble Calibrator system + user messages.

      System prompt MUST contain VOICE_CONSTRAINTS verbatim (AGT-02).
      """
      system = (
          "You are the Calibrator for The Eisenbalm Dispatch. "
          "You set the creative constraints for this issue.\n\n"
          "VOICE CONSTRAINTS (non-negotiable, copy verbatim into output.voice):\n"
          f"{VOICE_CONSTRAINTS}\n\n"
          f"Issue number: {issue_number}\n"
          f"Previous bonusTypes (most-recent-first): {previous_bonus_types}\n"
          f"This week's bonusType (already selected by deterministic rotation): "
          f"{chosen_bonus_type}\n\n"
          "Output JSON StyleBrief with:\n"
          "- voice: copy VOICE_CONSTRAINTS verbatim\n"
          "- constraints: 3-5 specific rules for THIS week's writers\n"
          "- bonusType: EXACTLY '" + chosen_bonus_type + "' (do not deviate)\n"
          "- visualDirection: one sentence aesthetic direction for DesignAgent"
      )
      user = (
          "Produce the StyleBrief for this week's issue. "
          "Return valid JSON matching the StyleBriefOutput schema."
      )
      return [
          {"role": "system", "content": system},
          {"role": "user", "content": user},
      ]


  @agent_node(name="calibrator", emit_event=None)
  async def calibrator(state: DispatchState) -> DispatchState:
      issue_number = state["issue_number"]
      previous = await _fetch_previous_bonus_types()
      chosen = _pick_bonus_type(previous, issue_number)
      messages = _build_messages(
          issue_number=issue_number,
          previous_bonus_types=previous,
          chosen_bonus_type=chosen,
      )

      brief_obj, usage = await acomplete(
          "calibrator", messages, response_format=StyleBriefOutput,
      )

      # Pydantic returns model instance; coerce to TypedDict-shaped dict.
      brief_dict = brief_obj.model_dump() if hasattr(brief_obj, "model_dump") else dict(brief_obj)
      # Defensive: enforce the rotation pick even if the model deviated.
      brief_dict["bonusType"] = chosen
      brief_dict["previousBonusTypes"] = previous

      # AGT-17: record resolved model.
      model_versions = dict(state.get("model_versions") or {})
      model_versions["calibrator"] = usage["resolved_model"]

      return {
          **state,
          "style_brief": brief_dict,
          "model_versions": model_versions,
      }
  ```

  **Sanity client requirement:** `lib.sanity_client` must export `groq_query(query: str) -> list[dict]`. If Plan 05-03 did not add this helper, add a thin wrapper around the existing `get_client` here (or, preferred, edit `lib/sanity_client.py` in this task — note it as a deviation in the SUMMARY).

  Sanity check before commit: `from eisenbalm_pipeline.agents.calibrator import calibrator` imports cleanly with `EISENBALM_STUB_MODE=true`.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.calibrator import calibrator, _pick_bonus_type, BONUS_TYPES; assert _pick_bonus_type(['jingle'], 42) != 'jingle'; assert _pick_bonus_type(['jingle'], 42) == _pick_bonus_type(['jingle'], 42), 'rotation must be deterministic'; assert _pick_bonus_type([], 0) in BONUS_TYPES; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/calibrator.py` imports `VOICE_CONSTRAINTS` from `lib.voice`
    - `agents/calibrator.py` imports `acomplete` from `lib.openrouter_client`
    - `grep -c '_pick_bonus_type' agents/calibrator.py` returns ≥ 2 (declaration + usage)
    - `_pick_bonus_type(['jingle'], 42)` returns a value in `{'bigBudget', 'specAd'}` (not `'jingle'`)
    - `_pick_bonus_type(['jingle'], 42) == _pick_bonus_type(['jingle'], 42)` (deterministic)
    - Function signature unchanged: `async def calibrator(state: DispatchState) -> DispatchState`
    - Decorator unchanged: `@agent_node(name="calibrator", emit_event=None)`
    - Calibrator return dict contains both `style_brief` and `model_versions` keys
    - `grep -c 'VOICE_CONSTRAINTS' agents/calibrator.py` returns ≥ 2
  </acceptance_criteria>

  <done>
  Calibrator runs against real OpenRouter (Opus pinned), emits a valid StyleBrief with deterministic bonusType rotation, and records `modelVersions['calibrator']` per AGT-17.
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace test_calibrator.py skip-skeletons with real assertions</name>
  <files>packages/pipeline/tests/agents/test_calibrator.py</files>

  <read_first>
    - packages/pipeline/tests/agents/test_calibrator.py (Plan 05-04 skeleton — remove skip markers)
    - packages/pipeline/tests/conftest.py (mock_openrouter_acomplete, sample_dispatch_state fixtures)
    - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py (just-implemented from Task 1)
    - .planning/phases/05-agent-quality/05-VALIDATION.md (AGT-01, AGT-02 verification commands)
  </read_first>

  <action>
  REPLACE `packages/pipeline/tests/agents/test_calibrator.py` with:

  ```python
  """Phase 5 Calibrator unit tests — implemented by Plan 05-05.

  Validation: AGT-01 (bonusType rotation), AGT-02 (VOICE_CONSTRAINTS embedded),
  AGT-17 (modelVersions recording).
  """
  from __future__ import annotations

  from unittest.mock import AsyncMock, patch

  import pytest

  from eisenbalm_pipeline.agents.calibrator import (
      BONUS_TYPES,
      _pick_bonus_type,
      _build_messages,
      calibrator,
  )
  from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


  def test_bonus_rotation() -> None:
      """AGT-01: rotation never picks the most-recent bonusType; deterministic."""
      # Most-recent = jingle; must pick bigBudget or specAd
      for issue_no in range(10):
          choice = _pick_bonus_type(["jingle", "bigBudget", "specAd"], issue_no)
          assert choice != "jingle", f"issue {issue_no}: picked most-recent"
          assert choice in BONUS_TYPES

      # Deterministic: re-running same inputs gives same output
      assert _pick_bonus_type(["jingle"], 42) == _pick_bonus_type(["jingle"], 42)
      assert _pick_bonus_type(["bigBudget"], 42) == _pick_bonus_type(["bigBudget"], 42)


  def test_bonus_rotation_first_issue() -> None:
      """AGT-01: empty previousBonusTypes (first-ever issue) still produces valid pick."""
      choice = _pick_bonus_type([], 1)
      assert choice in BONUS_TYPES


  def test_voice_constants() -> None:
      """AGT-02: assembled system prompt embeds VOICE_CONSTRAINTS verbatim."""
      messages = _build_messages(
          issue_number=42,
          previous_bonus_types=["jingle"],
          chosen_bonus_type="bigBudget",
      )
      system_prompt = messages[0]["content"]
      assert VOICE_CONSTRAINTS in system_prompt, \
          "VOICE_CONSTRAINTS must appear verbatim in Calibrator system prompt"


  @pytest.mark.asyncio
  async def test_calibrator_records_model_version(
      sample_dispatch_state, mock_openrouter_acomplete,
  ) -> None:
      """AGT-17: state['model_versions']['calibrator'] set after run."""
      # Configure mock to return a valid StyleBriefOutput-shaped object
      from eisenbalm_pipeline.agents.calibrator import StyleBriefOutput
      brief = StyleBriefOutput(
          voice=VOICE_CONSTRAINTS,
          constraints=["a", "b", "c"],
          bonusType="bigBudget",
          visualDirection="warm cream",
      )
      mock_openrouter_acomplete.return_value = (brief, {
          "tokens_in": 100, "tokens_out": 50, "usd": 0.01,
          "resolved_model": "anthropic/claude-opus-4-7-20251101",
      })

      with patch("eisenbalm_pipeline.agents.calibrator.acomplete", mock_openrouter_acomplete), \
           patch("eisenbalm_pipeline.agents.calibrator._fetch_previous_bonus_types",
                 AsyncMock(return_value=["jingle"])):
          result = await calibrator(sample_dispatch_state)

      assert "calibrator" in result["model_versions"]
      assert result["model_versions"]["calibrator"] == "anthropic/claude-opus-4-7-20251101"
      assert result["style_brief"]["bonusType"] != "jingle"
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_calibrator.py -x -v 2>&1 | tail -20</automated>
  </verify>

  <acceptance_criteria>
    - `pytest tests/agents/test_calibrator.py -x` exits 0 with 4 tests passing
    - No `@pytest.mark.skip` decorator remains in the file
    - `test_bonus_rotation` asserts `choice != 'jingle'`
    - `test_voice_constants` asserts `VOICE_CONSTRAINTS in system_prompt`
    - `test_calibrator_records_model_version` asserts `result['model_versions']['calibrator']` is the resolved model
    - `grep -c 'VOICE_CONSTRAINTS' tests/agents/test_calibrator.py` returns ≥ 2
  </acceptance_criteria>

  <done>
  Calibrator test suite verifies all three AGT criteria mechanically. Plan 05-13's real-mode integration test inherits these guarantees.
  </done>
</task>

</tasks>

<verification>
- `EISENBALM_STUB_MODE=true pytest tests/agents/test_calibrator.py -x` exits 0
- `EISENBALM_STUB_MODE=true pytest tests/ -x -q --timeout=30` exits 0 (no regression on Phase 4 tests)
- `grep -c 'VOICE_CONSTRAINTS' packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py` returns ≥ 2
</verification>

<success_criteria>
- Calibrator body is real (no fixture import path)
- BonusType rotation deterministic + correct
- VOICE_CONSTRAINTS embedded verbatim in system prompt
- modelVersions['calibrator'] populated after every run
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-05-calibrator-SUMMARY.md`.
</output>
