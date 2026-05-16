---
phase: 05-agent-quality
plan: 11
type: execute
wave: 5
depends_on:
  - "05-09"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/game.py
  - packages/pipeline/tests/agents/test_bonus.py
  - packages/pipeline/tests/agents/test_game.py
autonomous: true
requirements_addressed:
  - AGT-11
  - AGT-12
must_haves:
  truths:
    - "BonusWriter branches on state['style_brief']['bonusType'] via three internal prompt builders (D-19)"
    - "bigBudget branch emits {headline, body, storyboards: list[{shotNumber, description}]} with 3-5 storyboards"
    - "jingle branch emits {headline, body, lyrics, sunoPrompt, sunoAudioUrl=''} (sunoAudioUrl left empty for Andrew)"
    - "specAd branch emits {headline, body} (simplest shape)"
    - "GameWriter prompt enumerates the full forbidden-construct list verbatim (D-20)"
    - "GameWriter emits {headline, description (50-100 words), embedCode (self-contained HTML/JS)}"
    - "BonusWriter and GameWriter run on Sonnet (D-05); modelVersions populated"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py"
      provides: "Three-branch BonusWriter — bigBudget/jingle/specAd"
      min_lines: 130
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/game.py"
      provides: "GameWriter with forbidden-construct enumeration in prompt"
      min_lines: 100
  key_links:
    - from: "agents/bonus.py"
      to: "state['style_brief']['bonusType']"
      via: "router selects one of three internal prompt builders"
      pattern: "bonusType"
    - from: "agents/game.py prompt"
      to: "Phase 7 validator deny-list (mirrored)"
      via: "prompt-level defense per D-20; Phase 7 owns renderer-level enforcement"
      pattern: "FORBIDDEN"
---

<objective>
Replace two Phase 4 stub bodies with real Sonnet-driven writers that emit structurally distinct outputs. BonusWriter and GameWriter are grouped because both produce non-narrative output shapes (storyboards, lyrics, embedCode) that don't fit the Section Writer template from Plan 05-10.

Two concerns:

1. **BonusWriter three-branch routing (AGT-11, D-19):** Single `agents/bonus.py` module with one `@agent_node` entry and three internal prompt builders (`_build_big_budget_prompt`, `_build_jingle_prompt`, `_build_spec_ad_prompt`). Router reads `state['style_brief']['bonusType']` and dispatches to the matching builder. Each builder produces output that satisfies its branch-specific Pydantic schema:
   - **bigBudget:** `{headline, body (200-400 words), storyboards: list[{shotNumber: int, description: str}]}` with 3-5 storyboards
   - **jingle:** `{headline, body (100-200 words), lyrics (8-16 lines), sunoPrompt (40-80 words), sunoAudioUrl: str = ""}` (Andrew pastes sunoAudioUrl manually per V2-01 deferral)
   - **specAd:** `{headline, body (200-400 words)}` — simplest

2. **GameWriter forbidden-construct enumeration (AGT-12, D-20):** GameWriter's system prompt enumerates the full deny-list (`<script src="...">`, `<link href="...">`, `fetch(`, `XMLHttpRequest`, `window.parent`, `window.top`, `document.cookie`, `localStorage`, `eval(`, `import(`). Output Pydantic: `{headline, description (50-100 words), embedCode (self-contained HTML/JS string)}`. The Phase 7 validator (out of scope this phase) mirrors this deny-list at the renderer; Phase 5 ships prompt-level defense only.

Output: 2 agent files replaced + 2 test files replaced.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
@packages/pipeline/src/eisenbalm_pipeline/agents/game.py
@packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
@packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
@docs/CLAUDE_CODE_BRIEF.md

<interfaces>
<!-- BonusWriter branch outputs (RESEARCH lines 731-748) -->
```python
class BigBudgetBonus(BaseModel):
    headline: str
    body: str
    storyboards: list[dict]  # [{"shotNumber": int, "description": str}]

class JingleBonus(BaseModel):
    headline: str
    body: str
    lyrics: str
    sunoPrompt: str
    sunoAudioUrl: str = ""  # Andrew fills manually

class SpecAdBonus(BaseModel):
    headline: str
    body: str
```

<!-- GameOutput Pydantic (RESEARCH lines 695-700) -->
```python
class GameOutput(BaseModel):
    headline: str
    description: str  # 50-100 words plain-text for accessibility
    embedCode: str    # Complete self-contained HTML/JS string
```

<!-- Forbidden constructs (RESEARCH lines 673-693) — verbatim -->
<!-- - <script src="..."> -->
<!-- - <link href="..."> -->
<!-- - fetch( -->
<!-- - XMLHttpRequest -->
<!-- - window.parent -->
<!-- - window.top -->
<!-- - document.cookie -->
<!-- - localStorage -->
<!-- - eval( -->
<!-- - import( -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace BonusWriter stub with three-branch routing</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py (Phase 4 stub)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"BonusWriter (three internal prompt builders)" lines 705-748
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-19 (branch contract + sunoAudioUrl manual fill)
    - docs/CLAUDE_CODE_BRIEF.md lines 196-210 (Bonus contract)
  </read_first>

  <behavior>
    - Test 1 (test_big_budget_branch): style_brief.bonusType='bigBudget'; mock acomplete to return BigBudgetBonus with 4 storyboards; assert state['bonus']['storyboards'] has length 4.
    - Test 2 (test_jingle_branch): bonusType='jingle'; mock returns JingleBonus with sunoPrompt; assert state['bonus']['sunoPrompt'] populated AND state['bonus']['sunoAudioUrl'] == '' (Andrew fills later).
    - Test 3 (test_spec_ad_branch): bonusType='specAd'; mock returns SpecAdBonus; assert state['bonus'] has only headline + body.
  </behavior>

  <action>
  REPLACE `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` with:

  ```python
  """Phase 5 BonusWriter — three-branch routing (Sonnet via OpenRouter).

  Replaces Phase 4 stub. Single @agent_node entry; routes on
  state['style_brief']['bonusType'] to one of three internal prompt builders
  per D-19:

    bigBudget → BigBudgetBonus: {headline, body, storyboards[]}
    jingle    → JingleBonus:    {headline, body, lyrics, sunoPrompt, sunoAudioUrl=""}
    specAd    → SpecAdBonus:    {headline, body}

  sunoAudioUrl left empty for Andrew to fill manually (V2-01 deferred).
  """
  from __future__ import annotations

  from typing import Literal

  from pydantic import BaseModel, Field

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.openrouter_client import acomplete
  from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


  class Storyboard(BaseModel):
      shotNumber: int = Field(ge=1)
      description: str = Field(description="50-100 words of precise visual/audio direction")


  class BigBudgetBonus(BaseModel):
      headline: str
      body: str = Field(description="200-400 words on concept")
      storyboards: list[Storyboard] = Field(min_length=3, max_length=5)


  class JingleBonus(BaseModel):
      headline: str
      body: str = Field(description="100-200 words on concept")
      lyrics: str = Field(description="8-16 lines, internal rhyme allowed")
      sunoPrompt: str = Field(
          description="40-80 words describing musical style, instrumentation, "
                      "mood, lyrical theme. Do not reference AI."
      )
      sunoAudioUrl: str = ""  # V2-01: Andrew fills manually


  class SpecAdBonus(BaseModel):
      headline: str
      body: str = Field(description="200-400 words of ad copy and rationale")


  def _build_big_budget_prompt(charity: dict, style_brief: dict) -> list[dict]:
      system = (
          "You are the BonusWriter for The Eisenbalm Dispatch. You are writing "
          "the BIG BUDGET branch: a spec for a cinematic ad campaign.\n\n"
          "VOICE CONSTRAINTS (non-negotiable):\n"
          f"{VOICE_CONSTRAINTS}\n\n"
          "Output: headline + body (200-400 words on concept) + storyboards "
          "(3-5 items: each with shotNumber (int) and description (50-100 "
          "words of precise visual/audio direction, Fortune-500 production "
          "values, no winking))."
      )
      user = (
          f"CHARITY: {charity.get('name', '')}\n"
          f"VISUAL DIRECTION: {style_brief.get('visualDirection', '')}\n\n"
          "Return JSON BigBudgetBonus."
      )
      return [{"role": "system", "content": system},
              {"role": "user", "content": user}]


  def _build_jingle_prompt(charity: dict, style_brief: dict) -> list[dict]:
      system = (
          "You are the BonusWriter for The Eisenbalm Dispatch. You are writing "
          "the JINGLE branch.\n\n"
          "VOICE CONSTRAINTS (non-negotiable):\n"
          f"{VOICE_CONSTRAINTS}\n\n"
          "Output: headline + body (100-200 words on concept) + lyrics "
          "(8-16 lines, internal rhyme allowed) + sunoPrompt (40-80 words "
          "describing musical style, instrumentation, mood, and lyrical theme "
          "for Suno API — do not reference AI in sunoPrompt). sunoAudioUrl "
          "is left empty for Andrew to fill."
      )
      user = (
          f"CHARITY: {charity.get('name', '')}\n"
          f"VISUAL DIRECTION: {style_brief.get('visualDirection', '')}\n\n"
          "Return JSON JingleBonus with sunoAudioUrl set to empty string."
      )
      return [{"role": "system", "content": system},
              {"role": "user", "content": user}]


  def _build_spec_ad_prompt(charity: dict, style_brief: dict) -> list[dict]:
      system = (
          "You are the BonusWriter for The Eisenbalm Dispatch. You are writing "
          "the SPEC AD branch: a print/digital ad spec.\n\n"
          "VOICE CONSTRAINTS (non-negotiable):\n"
          f"{VOICE_CONSTRAINTS}\n\n"
          "Output: headline (the ad headline) + body (200-400 words of ad copy "
          "and rationale for the creative direction — precise, dry, serious)."
      )
      user = (
          f"CHARITY: {charity.get('name', '')}\n"
          f"VISUAL DIRECTION: {style_brief.get('visualDirection', '')}\n\n"
          "Return JSON SpecAdBonus."
      )
      return [{"role": "system", "content": system},
              {"role": "user", "content": user}]


  @agent_node(name="bonus", emit_event="section-draft")
  async def bonus(state: DispatchState) -> DispatchState:
      style_brief = state.get("style_brief") or {}
      bonus_type = style_brief.get("bonusType", "specAd")
      charity = state.get("winning_charity") or {}

      if bonus_type == "bigBudget":
          messages = _build_big_budget_prompt(charity, style_brief)
          response_format = BigBudgetBonus
      elif bonus_type == "jingle":
          messages = _build_jingle_prompt(charity, style_brief)
          response_format = JingleBonus
      else:
          messages = _build_spec_ad_prompt(charity, style_brief)
          response_format = SpecAdBonus

      out_obj, usage = await acomplete(
          "bonus", messages, response_format=response_format,
      )
      out_dict = (
          out_obj.model_dump() if hasattr(out_obj, "model_dump") else dict(out_obj)
      )

      # Jingle: enforce sunoAudioUrl='' (Andrew fills manually)
      if bonus_type == "jingle":
          out_dict["sunoAudioUrl"] = ""

      # Tag with bonusType so downstream (QA, Publisher, Studio) knows which
      # shape this is without re-checking style_brief.
      out_dict["bonusType"] = bonus_type

      model_versions = dict(state.get("model_versions") or {})
      model_versions["bonus"] = usage["resolved_model"]

      return {
          **state,
          "bonus": out_dict,
          "model_versions": model_versions,
      }
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.bonus import bonus, BigBudgetBonus, JingleBonus, SpecAdBonus, _build_big_budget_prompt, _build_jingle_prompt, _build_spec_ad_prompt, Storyboard; sb = [Storyboard(shotNumber=i+1, description='d'*100) for i in range(4)]; bb = BigBudgetBonus(headline='H', body='B'*300, storyboards=sb); assert len(bb.storyboards) == 4; j = JingleBonus(headline='H', body='B'*150, lyrics='L', sunoPrompt='S'*60); assert j.sunoAudioUrl == ''; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/bonus.py` defines three Pydantic models: `BigBudgetBonus`, `JingleBonus`, `SpecAdBonus`
    - `BigBudgetBonus.storyboards` has `min_length=3, max_length=5`
    - `JingleBonus.sunoAudioUrl` defaults to `""`
    - `agents/bonus.py` defines three internal prompt builders: `_build_big_budget_prompt`, `_build_jingle_prompt`, `_build_spec_ad_prompt`
    - The router in `bonus()` body dispatches on `state['style_brief']['bonusType']`
    - `out_dict['sunoAudioUrl'] = ""` enforced for jingle (line-level check via grep)
    - `out_dict['bonusType']` tagged onto output for downstream consumption
    - Decorator: `@agent_node(name="bonus", emit_event="section-draft")`
  </acceptance_criteria>

  <done>
  BonusWriter correctly routes between three branches; each branch emits its specified Pydantic shape.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Replace GameWriter stub with forbidden-construct prompt</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/game.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/game.py (Phase 4 stub)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"GameWriter" lines 671-701
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-20 (forbidden constructs enumerated in prompt)
    - docs/CLAUDE_CODE_BRIEF.md lines 188-194 (Game contract)
  </read_first>

  <action>
  REPLACE `packages/pipeline/src/eisenbalm_pipeline/agents/game.py` with:

  ```python
  """Phase 5 GameWriter — Sonnet via OpenRouter.

  Replaces Phase 4 stub. Prompt enumerates forbidden constructs verbatim per
  D-20. Phase 7 owns the renderer-level validator; Phase 5 ships prompt-level
  defense only.
  """
  from __future__ import annotations

  from pydantic import BaseModel, Field

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.openrouter_client import acomplete
  from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


  FORBIDDEN_CONSTRUCTS: str = """FORBIDDEN (a validator will reject these):
  - <script src="...">    no external scripts
  - <link href="...">     no external stylesheets
  - fetch(                no network calls
  - XMLHttpRequest        no AJAX
  - window.parent         no parent frame access
  - window.top            no top frame access
  - document.cookie       no cookie access
  - localStorage          no storage access
  - eval(                 no dynamic evaluation
  - import(               no dynamic imports

  All CSS: inline <style> tags only.
  All JS: inline <script> tags only (no src= attribute).
  No external fonts, no CDN references of any kind."""


  class GameOutput(BaseModel):
      headline: str
      description: str = Field(
          description="50-100 word plain-text description for accessibility"
      )
      embedCode: str = Field(description="Complete self-contained HTML/JS string")


  def _build_messages(charity: dict) -> list[dict]:
      """Embed FORBIDDEN_CONSTRUCTS verbatim per D-20."""
      system = (
          "You are the GameWriter for The Eisenbalm Dispatch. "
          f"Write a self-contained HTML/JS game themed around "
          f"{charity.get('name', '')}'s mission. Completable in 60-90 seconds.\n\n"
          "VOICE CONSTRAINTS (apply to in-game text + headline):\n"
          f"{VOICE_CONSTRAINTS}\n\n"
          f"{FORBIDDEN_CONSTRUCTS}"
      )
      user = (
          f"CHARITY: {charity.get('name', '')}\n"
          f"MISSION: {charity.get('missionStatement', '')}\n\n"
          "Return JSON GameOutput with: headline (game title), description "
          "(50-100 word plain-text summary for accessibility), embedCode "
          "(complete self-contained HTML document including inline <style> "
          "and inline <script> — no external dependencies of any kind)."
      )
      return [{"role": "system", "content": system},
              {"role": "user", "content": user}]


  @agent_node(name="game", emit_event="section-draft")
  async def game(state: DispatchState) -> DispatchState:
      messages = _build_messages(state.get("winning_charity") or {})
      out_obj, usage = await acomplete(
          "game", messages, response_format=GameOutput,
      )
      out_dict = (
          out_obj.model_dump() if hasattr(out_obj, "model_dump") else dict(out_obj)
      )
      model_versions = dict(state.get("model_versions") or {})
      model_versions["game"] = usage["resolved_model"]
      return {
          **state,
          "game": out_dict,
          "model_versions": model_versions,
      }
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.game import game, GameOutput, FORBIDDEN_CONSTRUCTS, _build_messages; assert '<script src' in FORBIDDEN_CONSTRUCTS; assert 'fetch(' in FORBIDDEN_CONSTRUCTS; assert 'XMLHttpRequest' in FORBIDDEN_CONSTRUCTS; assert 'window.parent' in FORBIDDEN_CONSTRUCTS; assert 'localStorage' in FORBIDDEN_CONSTRUCTS; assert 'eval(' in FORBIDDEN_CONSTRUCTS; m = _build_messages({'name': 'Foo'}); assert FORBIDDEN_CONSTRUCTS in m[0]['content']; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/game.py` defines `FORBIDDEN_CONSTRUCTS` constant containing ALL of: `<script src`, `<link href`, `fetch(`, `XMLHttpRequest`, `window.parent`, `window.top`, `document.cookie`, `localStorage`, `eval(`, `import(`
    - `_build_messages` system prompt contains `FORBIDDEN_CONSTRUCTS` substring
    - `GameOutput` has exactly three fields: `headline`, `description`, `embedCode`
    - Decorator: `@agent_node(name="game", emit_event="section-draft")`
  </acceptance_criteria>

  <done>
  GameWriter prompts the LLM with the full forbidden-construct list and emits the right Pydantic shape.
  </done>
</task>

<task type="auto">
  <name>Task 3: Implement test_bonus.py and test_game.py</name>
  <files>packages/pipeline/tests/agents/test_bonus.py, packages/pipeline/tests/agents/test_game.py</files>

  <read_first>
    - packages/pipeline/tests/agents/test_bonus.py + test_game.py (Plan 05-04 skeletons)
    - packages/pipeline/src/eisenbalm_pipeline/agents/{bonus,game}.py (just-implemented)
  </read_first>

  <action>
  REPLACE `packages/pipeline/tests/agents/test_bonus.py`:

  ```python
  """Phase 5 BonusWriter unit tests — Plan 05-11. Validation: AGT-11."""
  from unittest.mock import AsyncMock, patch
  import pytest
  from eisenbalm_pipeline.agents.bonus import (
      BigBudgetBonus, JingleBonus, SpecAdBonus, Storyboard, bonus,
  )


  def _state_with_bonus_type(bonus_type: str, base_state: dict) -> dict:
      return {
          **base_state,
          "style_brief": {"bonusType": bonus_type, "visualDirection": "warm"},
          "winning_charity": {"name": "Foo Org", "missionStatement": "m"},
      }


  @pytest.mark.asyncio
  async def test_big_budget_branch(sample_dispatch_state) -> None:
      """AGT-11: bigBudget emits storyboards (3-5 items)."""
      state = _state_with_bonus_type("bigBudget", sample_dispatch_state)
      sb = [Storyboard(shotNumber=i + 1, description="d" * 80) for i in range(4)]
      out = BigBudgetBonus(headline="H", body="B" * 300, storyboards=sb)
      with patch(
          "eisenbalm_pipeline.agents.bonus.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-sonnet-4-6",
          })),
      ):
          result = await bonus(state)
      assert len(result["bonus"]["storyboards"]) == 4
      assert result["bonus"]["bonusType"] == "bigBudget"


  @pytest.mark.asyncio
  async def test_jingle_branch_sunourl_empty(sample_dispatch_state) -> None:
      """AGT-11: jingle leaves sunoAudioUrl empty (V2-01 deferred)."""
      state = _state_with_bonus_type("jingle", sample_dispatch_state)
      out = JingleBonus(
          headline="H", body="B" * 150, lyrics="L" * 100, sunoPrompt="S" * 60,
          sunoAudioUrl="https://attempted.example/x.mp3",  # model tried — code clears it
      )
      with patch(
          "eisenbalm_pipeline.agents.bonus.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-sonnet-4-6",
          })),
      ):
          result = await bonus(state)
      assert result["bonus"]["sunoAudioUrl"] == ""
      assert result["bonus"]["sunoPrompt"]
      assert result["bonus"]["bonusType"] == "jingle"


  @pytest.mark.asyncio
  async def test_spec_ad_branch(sample_dispatch_state) -> None:
      state = _state_with_bonus_type("specAd", sample_dispatch_state)
      out = SpecAdBonus(headline="H", body="B" * 300)
      with patch(
          "eisenbalm_pipeline.agents.bonus.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-sonnet-4-6",
          })),
      ):
          result = await bonus(state)
      assert "storyboards" not in result["bonus"]
      assert "sunoPrompt" not in result["bonus"]
      assert result["bonus"]["bonusType"] == "specAd"
  ```

  REPLACE `packages/pipeline/tests/agents/test_game.py`:

  ```python
  """Phase 5 GameWriter unit tests — Plan 05-11. Validation: AGT-12."""
  from unittest.mock import AsyncMock, patch
  import pytest
  from eisenbalm_pipeline.agents.game import (
      FORBIDDEN_CONSTRUCTS, GameOutput, _build_messages, game,
  )


  def test_no_external_deps_enumerated_in_prompt() -> None:
      """AGT-12: forbidden constructs enumerated in prompt verbatim (D-20)."""
      for token in ("<script src", "<link href", "fetch(", "XMLHttpRequest",
                    "window.parent", "window.top", "document.cookie",
                    "localStorage", "eval(", "import("):
          assert token in FORBIDDEN_CONSTRUCTS, f"missing: {token}"

      msgs = _build_messages({"name": "Foo", "missionStatement": "m"})
      assert FORBIDDEN_CONSTRUCTS in msgs[0]["content"]


  @pytest.mark.asyncio
  async def test_game_output_shape(sample_dispatch_state) -> None:
      """AGT-12: GameOutput shape (headline + description + embedCode)."""
      sample_dispatch_state["winning_charity"] = {"name": "Foo", "missionStatement": "m"}
      out = GameOutput(
          headline="H", description="d" * 80,
          embedCode="<!doctype html><html><body>game</body></html>",
      )
      with patch(
          "eisenbalm_pipeline.agents.game.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-sonnet-4-6",
          })),
      ):
          result = await game(sample_dispatch_state)
      assert "headline" in result["game"]
      assert "description" in result["game"]
      assert "embedCode" in result["game"]
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_bonus.py tests/agents/test_game.py -x -v 2>&1 | tail -30</automated>
  </verify>

  <acceptance_criteria>
    - `test_bonus.py` has three branch tests (bigBudget, jingle, specAd)
    - `test_jingle_branch_sunourl_empty` asserts `result['bonus']['sunoAudioUrl'] == ''` even when model returned non-empty
    - `test_game.py::test_no_external_deps_enumerated_in_prompt` asserts all 10 forbidden tokens present
    - No `@pytest.mark.skip` remains
  </acceptance_criteria>

  <done>
  BonusWriter + GameWriter behaviors verified mechanically.
  </done>
</task>

</tasks>

<verification>
- `EISENBALM_STUB_MODE=true pytest tests/agents/test_bonus.py tests/agents/test_game.py -x` exits 0
- `grep -c 'FORBIDDEN_CONSTRUCTS' packages/pipeline/src/eisenbalm_pipeline/agents/game.py` returns ≥ 2
- `grep -c "'bigBudget'" packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` returns ≥ 1
- `grep -c "'jingle'" packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` returns ≥ 1
- `grep -c "'specAd'" packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` returns ≥ 1
</verification>

<success_criteria>
- BonusWriter routes on bonusType; each branch emits its specified Pydantic shape
- sunoAudioUrl forced to '' even if model tries to fill it
- GameWriter prompt enumerates all 10 forbidden constructs from D-20
- GameOutput shape locked: headline + description + embedCode
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-11-bonus-and-game-SUMMARY.md`.
</output>
