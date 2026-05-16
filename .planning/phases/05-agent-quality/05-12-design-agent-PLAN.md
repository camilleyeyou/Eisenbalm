---
phase: 05-agent-quality
plan: 12
type: execute
wave: 5
depends_on:
  - "05-09"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/design.py
  - packages/pipeline/tests/agents/test_design.py
autonomous: true
requirements_addressed:
  - AGT-13
  - AGT-14
must_haves:
  truths:
    - "DesignAgent emits four six-digit hex colors validated by regex ^#[0-9a-fA-F]{6}$ (AGT-13 / D-15)"
    - "DesignAgent runs WCAG-AA contrast check on (backgroundColor, textColor) at >= 4.5:1 using lib/wcag.py (Phase 2 algorithm port)"
    - "DesignAgent fonts MUST be members of agents/design/font_whitelist.FONT_WHITELIST (AGT-14 / D-16)"
    - "On validation failure: regenerate once; second failure falls back to lib/wcag.SAFE_THEME + writes a qaCorrections row severity='warning'"
    - "DesignAgent runs on Haiku (mechanical tier per D-05); modelVersions populated"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/design.py"
      provides: "Real Haiku-driven DesignAgent body with regenerate-once + safe fallback"
      min_lines: 120
    - path: "packages/pipeline/tests/agents/test_design.py"
      provides: "test_hex_validation + test_wcag_check + test_font_whitelist + test_fallback_safe_theme"
      contains: "FONT_WHITELIST"
  key_links:
    - from: "agents/design.py validation"
      to: "lib/wcag.validate_theme + agents/design/font_whitelist.FONT_WHITELIST"
      via: "regenerate-once on failure; safe-theme fallback on second failure (D-15, D-16)"
      pattern: "validate_theme"
    - from: "agents/design.py fallback"
      to: "Convex qaCorrections:insert severity='warning'"
      via: "annotation when DesignAgent falls back (logged for Andrew review)"
      pattern: "qaCorrections:insert"
---

<objective>
Replace the Phase 4 DesignAgent stub with a real Haiku-driven implementation that produces validated themes. DesignAgent is unique among Phase 5 agents because it runs programmatic validation AFTER the LLM call and supports a regenerate-once retry plus a hardcoded safe-theme fallback.

Three concerns:

1. **Hex color validation (AGT-13, D-15):** All four colors (primaryColor, accentColor, backgroundColor, textColor) must match `^#[0-9a-fA-F]{6}$`. The `lib/wcag.validate_theme()` helper from Plan 05-03 returns a list of error strings; empty list = valid.

2. **WCAG-AA contrast (AGT-13, D-15):** Background-vs-text contrast ratio MUST be >= 4.5:1 using `lib/wcag.contrast_ratio()` (Phase 2 algorithm port; threshold 0.03928 per Pitfall 3 — `lib/wcag.py` already enforces this).

3. **Font whitelist (AGT-14, D-16):** Both `fontDisplay` and `fontBody` must be in `agents/design/font_whitelist.FONT_WHITELIST` — the candidate set authored in Plan 05-04 (Wave 2) with safe defaults that are immediately useable. Plan 05-15 (Wave 8) is where Andrew approves any extended additions to the candidate list — that approval happens AFTER this plan ships. This DesignAgent operates on the candidate list as-is at execution time. The `FALLBACK_FONT_DISPLAY` / `FALLBACK_FONT_BODY` constants (Phase 2-approved baseline) guarantee a safe theme even if Andrew has not yet signed off on the extended candidates by the time this plan runs.

**Regeneration loop:**
```
attempt 1 → LLM call → validate → if errors: attempt 2 (with errors in retry prompt) → validate
attempt 2 fails → fall back to SAFE_THEME + write qaCorrections row severity='warning'
```

The fallback path writes `qaCorrections:insert` with `severity='warning'` (NOT 'error' — DesignAgent failure is not a brand-failure-grade event; Andrew just needs to know the LLM didn't comply). Severity values are post-Plan-05-01 schema patch (info|warning|error).

Output: 1 agent file replaced + 1 test file replaced.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/design.py
@packages/pipeline/src/eisenbalm_pipeline/lib/wcag.py
@packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py
@packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
@docs/CLAUDE_CODE_BRIEF.md

<interfaces>
<!-- lib/wcag.py (Plan 05-03) -->
```python
HEX_REGEX = re.compile(r'^#[0-9a-fA-F]{6}$')
WCAG_AA_THRESHOLD = 4.5
SAFE_THEME = {
    "primaryColor": "#2D5016",
    "accentColor": "#8B1A1A",
    "backgroundColor": "#FAFAF8",
    "textColor": "#1A1A18",
    "fontDisplay": "Playfair Display",
    "fontBody": "Source Serif Pro",
}

def validate_hex(color: str) -> bool: ...
def contrast_ratio(hex1: str, hex2: str) -> float: ...
def passes_wcag_aa(hex_bg: str, hex_text: str) -> bool: ...
def validate_theme(theme: dict) -> list[str]: ...
```

<!-- agents/design/font_whitelist.py (Plan 05-04) -->
```python
FONT_WHITELIST: set[str]  # union of WHITELIST_DISPLAY and WHITELIST_BODY
FALLBACK_FONT_DISPLAY = "Playfair Display"
FALLBACK_FONT_BODY = "Source Serif Pro"
```

<!-- ThemeOutput Pydantic (RESEARCH §"DesignAgent" lines 772-780) -->
```python
class ThemeOutput(BaseModel):
    primaryColor: str
    accentColor: str
    backgroundColor: str
    textColor: str
    fontDisplay: str
    fontBody: str
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace DesignAgent stub with regenerate-once + safe-fallback logic</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/design.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/design.py (Phase 4 stub)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"DesignAgent" lines 752-787
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"design.py — Validation at Sanity Write Time" lines 1679-1713
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-15 (hex + WCAG), D-16 (font whitelist)
    - packages/pipeline/src/eisenbalm_pipeline/lib/wcag.py (validate_theme, SAFE_THEME)
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py (FONT_WHITELIST)
    - docs/CLAUDE_CODE_BRIEF.md (DesignAgent — theme output requirements)
  </read_first>

  <behavior>
    - Test 1 (test_valid_theme_passes): Mock acomplete returning a valid theme on first try; assert state['theme'] equals the mock output AND no qaCorrections:insert call.
    - Test 2 (test_invalid_hex_regenerates): First mock returns bad hex ('#XYZ'), second returns valid; assert acomplete called twice AND state['theme'] equals second response.
    - Test 3 (test_font_not_in_whitelist_regenerates): First mock returns fontDisplay='Comic Sans' (not in whitelist), second valid; assert two acomplete calls AND state['theme'] equals second.
    - Test 4 (test_double_failure_falls_back_to_safe_theme): Both attempts invalid; assert state['theme'] equals SAFE_THEME AND `convex_mutation_safe('qaCorrections:insert', ...)` called with `severity='warning'`.
    - Test 5 (test_wcag_failure): bg='#FFFFFF', text='#EEEEEE' (low contrast); assert validate_theme returns at least one error containing "contrast".
  </behavior>

  <action>
  REPLACE `packages/pipeline/src/eisenbalm_pipeline/agents/design.py` with:

  ```python
  """Phase 5 DesignAgent — Haiku via OpenRouter + programmatic validation.

  Replaces Phase 4 stub. Pipeline:

    1. Call LLM → ThemeOutput
    2. validate_theme() + font_whitelist check
    3. If errors AND attempt==1: retry with errors injected into prompt
    4. If errors AND attempt==2: fall back to SAFE_THEME (lib/wcag.py)
                                 + write qaCorrections severity='warning'
    5. Return validated theme + modelVersions['design']

  Severity 'warning' (NOT 'error') per D-15: DesignAgent fallback is operational
  notice for Andrew, not a brand-failure-grade event.
  """
  from __future__ import annotations

  from pydantic import BaseModel

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.agents.design.font_whitelist import (
      FALLBACK_FONT_BODY,
      FALLBACK_FONT_DISPLAY,
      FONT_WHITELIST,
      WHITELIST_BODY,
      WHITELIST_DISPLAY,
  )
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
  from eisenbalm_pipeline.lib.openrouter_client import acomplete
  from eisenbalm_pipeline.lib.wcag import SAFE_THEME, validate_theme


  class ThemeOutput(BaseModel):
      """AGT-13 output (RESEARCH §"DesignAgent" lines 772-780)."""
      primaryColor: str
      accentColor: str
      backgroundColor: str
      textColor: str
      fontDisplay: str
      fontBody: str


  def _validate_full(theme: dict) -> list[str]:
      """Combine validate_theme (hex + WCAG) with font whitelist enforcement."""
      errors = validate_theme(theme)
      if theme.get("fontDisplay") not in FONT_WHITELIST:
          errors.append(
              f"fontDisplay '{theme.get('fontDisplay')}' not in whitelist"
          )
      if theme.get("fontBody") not in FONT_WHITELIST:
          errors.append(
              f"fontBody '{theme.get('fontBody')}' not in whitelist"
          )
      return errors


  def _build_messages(
      *,
      charity: dict,
      style_brief: dict,
      retry_errors: list[str] | None = None,
  ) -> list[dict]:
      """System prompt embeds whitelist + WCAG-AA constraint verbatim per
      RESEARCH §"DesignAgent" lines 754-769. On retry, prior errors are
      appended to the user message."""
      display_list = ", ".join(sorted(WHITELIST_DISPLAY))
      body_list = ", ".join(sorted(WHITELIST_BODY))
      system = (
          "You are the DesignAgent. Output exactly four six-digit hex colors "
          "and two font names. You will not invent a font. WCAG AA contrast "
          "is a precondition, not a polish step.\n\n"
          f"fontDisplay must be one of: {display_list}\n"
          f"fontBody must be one of: {body_list}\n\n"
          "WCAG AA: contrast ratio between backgroundColor and textColor "
          ">= 4.5:1. Your choices will be validated programmatically."
      )
      user_lines = [
          f"CHARITY: {charity.get('name', '')}",
          f"VISUAL DIRECTION: {style_brief.get('visualDirection', '')}",
          "",
          "Output JSON Theme: primaryColor, accentColor, backgroundColor, "
          "textColor, fontDisplay, fontBody.",
      ]
      if retry_errors:
          user_lines.extend([
              "",
              "PREVIOUS ATTEMPT FAILED VALIDATION:",
              *(f"- {e}" for e in retry_errors),
              "",
              "Fix every error and return a fully valid theme.",
          ])
      return [
          {"role": "system", "content": system},
          {"role": "user", "content": "\n".join(user_lines)},
      ]


  async def _call_llm(charity: dict, style_brief: dict,
                      retry_errors: list[str] | None = None) -> tuple[dict, dict]:
      messages = _build_messages(
          charity=charity, style_brief=style_brief, retry_errors=retry_errors,
      )
      out_obj, usage = await acomplete(
          "design", messages, response_format=ThemeOutput,
      )
      theme_dict = (
          out_obj.model_dump() if hasattr(out_obj, "model_dump") else dict(out_obj)
      )
      return theme_dict, usage


  @agent_node(name="design", emit_event="section-draft")
  async def design(state: DispatchState) -> DispatchState:
      run_id = state["run_id"]
      charity = state.get("winning_charity") or {}
      style_brief = state.get("style_brief") or {}

      # Attempt 1
      theme, usage = await _call_llm(charity, style_brief)
      errors = _validate_full(theme)
      resolved_model = usage["resolved_model"]

      if errors:
          # Attempt 2 (regenerate once with errors)
          theme, usage = await _call_llm(
              charity, style_brief, retry_errors=errors,
          )
          errors = _validate_full(theme)
          resolved_model = usage["resolved_model"]

      if errors:
          # Second failure: fall back to safe theme + warn
          await convex_mutation_safe(
              "qaCorrections:insert",
              {
                  "runId": run_id,
                  "agentId": "design",
                  "section": "theme",
                  "severity": "warning",  # post-05-01 schema; D-15 policy
                  "axis": "precision",
                  "quotedSpan": str(theme)[:200],
                  "reasoning": (
                      f"DesignAgent failed validation twice: {errors}"
                  ),
                  "suggestedFix": "Theme fell back to hardcoded safe defaults.",
                  "acceptance": "pending",
              },
          )
          theme = {
              **SAFE_THEME,
              "fontDisplay": FALLBACK_FONT_DISPLAY,
              "fontBody": FALLBACK_FONT_BODY,
          }

      model_versions = dict(state.get("model_versions") or {})
      model_versions["design"] = resolved_model

      return {
          **state,
          "theme": theme,
          "model_versions": model_versions,
      }
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.design import design, ThemeOutput, _validate_full; from eisenbalm_pipeline.lib.wcag import SAFE_THEME; errs = _validate_full({**SAFE_THEME}); assert errs == [], f'safe theme should validate: {errs}'; bad = _validate_full({'primaryColor': '#XYZXYZ', 'accentColor': '#000000', 'backgroundColor': '#FFFFFF', 'textColor': '#000000', 'fontDisplay': 'Playfair Display', 'fontBody': 'Source Serif Pro'}); assert any('primaryColor' in e for e in bad); print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/design.py` defines `ThemeOutput` Pydantic with 6 fields (4 hex + 2 fonts)
    - `agents/design.py` imports `validate_theme` from `lib.wcag`
    - `agents/design.py` imports `FONT_WHITELIST` from `agents.design.font_whitelist`
    - `_validate_full(SAFE_THEME)` returns empty list (valid)
    - `_validate_full({...with bad hex...})` returns at least one error string
    - The agent body has two LLM call sites separated by validation (regenerate-once pattern verifiable by grep: `_call_llm` appears ≥ 2 times in the agent body, OR a loop)
    - Fallback branch writes `convex_mutation_safe("qaCorrections:insert", ...)` with `severity='warning'`
    - Decorator: `@agent_node(name="design", emit_event="section-draft")`
  </acceptance_criteria>

  <done>
  DesignAgent runs Haiku, validates hex+WCAG+fonts, regenerates once on failure, falls back to SAFE_THEME on second failure with a logged warning.
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace test_design.py skip-skeletons with real assertions</name>
  <files>packages/pipeline/tests/agents/test_design.py</files>

  <read_first>
    - packages/pipeline/tests/agents/test_design.py (Plan 05-04 skeleton)
    - packages/pipeline/src/eisenbalm_pipeline/agents/design.py (just-implemented)
    - packages/pipeline/src/eisenbalm_pipeline/lib/wcag.py (SAFE_THEME)
  </read_first>

  <action>
  REPLACE `packages/pipeline/tests/agents/test_design.py` with:

  ```python
  """Phase 5 DesignAgent unit tests — Plan 05-12. Validation: AGT-13, AGT-14."""
  from unittest.mock import AsyncMock, patch
  import pytest
  from eisenbalm_pipeline.agents.design import (
      ThemeOutput, _validate_full, design,
  )
  from eisenbalm_pipeline.agents.design.font_whitelist import FONT_WHITELIST
  from eisenbalm_pipeline.lib.wcag import SAFE_THEME


  def _valid_theme() -> ThemeOutput:
      return ThemeOutput(
          primaryColor="#2D5016", accentColor="#8B1A1A",
          backgroundColor="#FAFAF8", textColor="#1A1A18",
          fontDisplay="Playfair Display", fontBody="Source Serif Pro",
      )


  def _invalid_hex_theme() -> ThemeOutput:
      return ThemeOutput(
          primaryColor="#XYZXYZ", accentColor="#8B1A1A",
          backgroundColor="#FAFAF8", textColor="#1A1A18",
          fontDisplay="Playfair Display", fontBody="Source Serif Pro",
      )


  def _bad_font_theme() -> ThemeOutput:
      return ThemeOutput(
          primaryColor="#2D5016", accentColor="#8B1A1A",
          backgroundColor="#FAFAF8", textColor="#1A1A18",
          fontDisplay="Comic Sans", fontBody="Source Serif Pro",
      )


  def test_hex_validation_passes() -> None:
      errs = _validate_full({**SAFE_THEME})
      assert errs == []


  def test_hex_validation_fails_on_bad_color() -> None:
      bad = {**SAFE_THEME, "primaryColor": "#GGGGGG"}
      errs = _validate_full(bad)
      assert any("primaryColor" in e for e in errs)


  def test_font_whitelist_enforced() -> None:
      bad = {**SAFE_THEME, "fontDisplay": "Comic Sans"}
      errs = _validate_full(bad)
      assert any("fontDisplay" in e and "whitelist" in e for e in errs)


  def test_safe_theme_fonts_in_whitelist() -> None:
      assert SAFE_THEME["fontDisplay"] in FONT_WHITELIST
      assert SAFE_THEME["fontBody"] in FONT_WHITELIST


  @pytest.mark.asyncio
  async def test_valid_theme_passes_first_try(sample_dispatch_state) -> None:
      """AGT-13/14: valid theme on first attempt — no qaCorrections written."""
      sample_dispatch_state["winning_charity"] = {"name": "Foo"}
      sample_dispatch_state["style_brief"] = {"visualDirection": "warm"}

      mock_convex = AsyncMock()
      with patch(
          "eisenbalm_pipeline.agents.design.acomplete",
          AsyncMock(return_value=(_valid_theme(), {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-haiku-4-5",
          })),
      ), patch(
          "eisenbalm_pipeline.agents.design.convex_mutation_safe", mock_convex,
      ):
          result = await design(sample_dispatch_state)

      assert result["theme"]["primaryColor"] == "#2D5016"
      qa_calls = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "qaCorrections:insert"
      ]
      assert len(qa_calls) == 0


  @pytest.mark.asyncio
  async def test_invalid_then_valid_regenerates(sample_dispatch_state) -> None:
      """AGT-13: first attempt invalid → second attempt valid → no fallback."""
      sample_dispatch_state["winning_charity"] = {"name": "Foo"}
      sample_dispatch_state["style_brief"] = {"visualDirection": "warm"}

      call_count = 0
      def side_effect(*args, **kwargs):
          nonlocal call_count
          call_count += 1
          theme = _invalid_hex_theme() if call_count == 1 else _valid_theme()
          return (theme, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-haiku-4-5",
          })

      mock_acomplete = AsyncMock(side_effect=side_effect)
      mock_convex = AsyncMock()
      with patch(
          "eisenbalm_pipeline.agents.design.acomplete", mock_acomplete,
      ), patch(
          "eisenbalm_pipeline.agents.design.convex_mutation_safe", mock_convex,
      ):
          result = await design(sample_dispatch_state)

      assert mock_acomplete.call_count == 2
      assert result["theme"]["primaryColor"] == "#2D5016"
      qa_calls = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "qaCorrections:insert"
      ]
      assert len(qa_calls) == 0  # second attempt succeeded; no fallback warn


  @pytest.mark.asyncio
  async def test_double_failure_falls_back_to_safe_theme(sample_dispatch_state) -> None:
      """AGT-13/14: both attempts invalid → fallback to SAFE_THEME + warning."""
      sample_dispatch_state["winning_charity"] = {"name": "Foo"}
      sample_dispatch_state["style_brief"] = {"visualDirection": "warm"}

      mock_acomplete = AsyncMock(return_value=(_bad_font_theme(), {
          "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
          "resolved_model": "anthropic/claude-haiku-4-5",
      }))
      mock_convex = AsyncMock()
      with patch(
          "eisenbalm_pipeline.agents.design.acomplete", mock_acomplete,
      ), patch(
          "eisenbalm_pipeline.agents.design.convex_mutation_safe", mock_convex,
      ):
          result = await design(sample_dispatch_state)

      assert result["theme"]["fontDisplay"] == "Playfair Display"  # fallback
      assert result["theme"]["fontBody"] == "Source Serif Pro"
      qa_calls = [
          c for c in mock_convex.call_args_list
          if c.args and c.args[0] == "qaCorrections:insert"
      ]
      assert len(qa_calls) == 1
      assert qa_calls[0].args[1]["severity"] == "warning"
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_design.py -x -v 2>&1 | tail -40</automated>
  </verify>

  <acceptance_criteria>
    - `pytest tests/agents/test_design.py -x` exits 0 with ≥7 tests passing
    - `test_valid_theme_passes_first_try` asserts zero qaCorrections calls
    - `test_invalid_then_valid_regenerates` asserts acomplete.call_count == 2 and zero qaCorrections
    - `test_double_failure_falls_back_to_safe_theme` asserts fallback theme + ONE qaCorrections call with `severity='warning'`
    - `test_safe_theme_fonts_in_whitelist` asserts SAFE_THEME fonts are in FONT_WHITELIST (sanity check that 05-04's whitelist contains the wcag fallback)
  </acceptance_criteria>

  <done>
  DesignAgent verified for hex/WCAG/font validation, regenerate-once, and safe-theme fallback with warning annotation.
  </done>
</task>

</tasks>

<verification>
- `EISENBALM_STUB_MODE=true pytest tests/agents/test_design.py tests/lib/test_wcag.py -x` exits 0
- `grep -c 'validate_theme' packages/pipeline/src/eisenbalm_pipeline/agents/design.py` returns ≥ 1
- `grep -c 'FONT_WHITELIST' packages/pipeline/src/eisenbalm_pipeline/agents/design.py` returns ≥ 1
- `grep -c "severity.*warning" packages/pipeline/src/eisenbalm_pipeline/agents/design.py` returns ≥ 1
</verification>

<success_criteria>
- DesignAgent emits 4 hex + 2 fonts
- Hex regex validation enforced before write
- WCAG-AA contrast checked via lib/wcag.py (Phase 2 algorithm port)
- Font whitelist enforced — both display + body
- Regenerate-once on first validation failure
- Fallback to SAFE_THEME + qaCorrections severity='warning' on second failure
- modelVersions['design'] populated
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-12-design-agent-SUMMARY.md`.
</output>
