---
phase: 12-machine-editorial-design-adoption-and-designagent-suppression
plan: 02
type: execute
wave: 1
depends_on: [01]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/validate.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
  - packages/pipeline/tests/agents/test_validate.py
  - packages/pipeline/tests/test_pipeline_real_mode.py
  - packages/pipeline/tests/agents/test_design.py
autonomous: true
requirements: [MED-02, MED-03]
user_setup:
  - service: railway
    why: "DESIGNAGENT_SUPPRESSED env var must be set in the Railway dashboard for the pipeline runtime (default v1 = true/suppressed)"
    env_vars:
      - name: DESIGNAGENT_SUPPRESSED
        source: "Railway dashboard → packages/pipeline service → Variables → add DESIGNAGENT_SUPPRESSED=true (do NOT prefix NEXT_PUBLIC_)"

must_haves:
  truths:
    - "When DESIGNAGENT_SUPPRESSED=true, build_graph() omits the 'design' node and its two edges"
    - "When suppressed, validate_sections does not require 'theme' and the graph completes without state['theme']"
    - "When the flag is unset/false, the graph still includes 'design' and theme validation (no behavior change)"
    - "The DesignAgent system prompt contains the Machine Editorial aesthetic envelope so re-enabled output stays on-brand"
    - "ThemeOutput, _validate_full, regenerate-once, SAFE_THEME, FALLBACK_FONT_* are byte-unchanged"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/builder.py"
      provides: "conditional design-node exclusion behind DESIGNAGENT_SUPPRESSED"
      contains: "DESIGNAGENT_SUPPRESSED"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/validate.py"
      provides: "REQUIRED_FIELDS drops 'theme' in lockstep when suppressed"
      contains: "DESIGNAGENT_SUPPRESSED"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py"
      provides: "Machine Editorial prompt envelope in _build_messages"
      contains: "Machine Editorial"
  key_links:
    - from: "graph/builder.py SECTION_WRITERS"
      to: "agents/validate.py REQUIRED_FIELDS"
      via: "shared DESIGNAGENT_SUPPRESSED env gate (must stay in lockstep)"
      pattern: "DESIGNAGENT_SUPPRESSED"
---

<objective>
Implement the pipeline half of the reversible suppression flag (MED-02) and teach the DesignAgent its aesthetic (MED-03). The suppression flag is a single env var `DESIGNAGENT_SUPPRESSED` read at module-import time in two files that MUST move in lockstep: `graph/builder.py` (drops the `design` node + its two edges from the fan-out) and `agents/validate.py` (drops `"theme"` from `REQUIRED_FIELDS`). If only one is changed, every suppressed run fails with `partial-failure: missing sections ['theme']` — so these two edits are atomically coupled in this single plan. Separately, the DesignAgent system prompt gains a Machine Editorial envelope so that when the flag is flipped back OFF, re-enabled output stays within the dark aesthetic — prompt-only, validation machinery frozen.

Purpose: Make the design node skip reversibly with no code change (just flip the env var + redeploy), and ensure the agent's eventual output is on-brand.
Output: builder.py + validate.py gated on the flag; DesignAgent prompt envelope; Wave 0 xfail markers removed.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-CONTEXT.md
@.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md

@packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
@packages/pipeline/src/eisenbalm_pipeline/agents/validate.py
@packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Gate the design node + REQUIRED_FIELDS on DESIGNAGENT_SUPPRESSED (atomic coupling — MED-02 pipeline)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/builder.py, packages/pipeline/src/eisenbalm_pipeline/agents/validate.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py (SECTION_WRITERS tuple at line ~71 includes "design"; add_node("design", design) at line ~112; the fan-out loop at lines ~135-137 iterates SECTION_WRITERS and adds both edges; the `from eisenbalm_pipeline.agents.design import design` import at line ~50)
    - packages/pipeline/src/eisenbalm_pipeline/agents/validate.py (REQUIRED_FIELDS tuple at line ~23 includes "theme")
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md (Pattern 2 + Pitfall 2 + Code Examples "SECTION_WRITERS conditional exclusion" and "REQUIRED_FIELDS parallel update")
  </read_first>
  <action>
Edit BOTH files with the IDENTICAL truthiness logic so they never drift.

(1) In `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py`:
- Add `import os` near the top (after `from __future__ import annotations`, before the langgraph import block — match existing import grouping).
- Keep the `from eisenbalm_pipeline.agents.design import design` import as-is (importing the function is harmless; it does not execute the agent).
- Add a module-scope flag immediately above the `SECTION_WRITERS` declaration:
  ```python
  # MED-02: reversible suppression flag. Read at module-import time so flipping
  # DESIGNAGENT_SUPPRESSED in the Railway dashboard + restart takes effect with
  # no code change. Must stay in lockstep with validate.REQUIRED_FIELDS.
  _SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED", "").lower() in ("1", "true", "yes")
  ```
- Change `SECTION_WRITERS` to conditionally exclude `"design"`:
  ```python
  SECTION_WRITERS: tuple[str, ...] = (
      "origin_story",
      "problem",
      "founder_bio",
      "case_study",
      "game",
      "bonus",
      *(() if _SUPPRESSED else ("design",)),
  )
  ```
- In `build_graph()`, wrap the design node registration so the node is not added when suppressed. Replace the unconditional `builder.add_node("design", design)` (line ~112) with:
  ```python
  if not _SUPPRESSED:
      builder.add_node("design", design)
  ```
  The fan-out `for writer in SECTION_WRITERS:` loop already adds the edges only for tuple members, so removing `"design"` from the tuple removes its two edges automatically — no other edge change needed.

(2) In `packages/pipeline/src/eisenbalm_pipeline/agents/validate.py`:
- Add `import os` near the top (after `from __future__ import annotations`, before `import time`).
- Add the identical module-scope flag above `REQUIRED_FIELDS`:
  ```python
  # MED-02: must match graph.builder._SUPPRESSED exactly (lockstep — see Pitfall 2).
  _SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED", "").lower() in ("1", "true", "yes")
  ```
- Change `REQUIRED_FIELDS` to drop `"theme"` when suppressed:
  ```python
  REQUIRED_FIELDS: tuple[str, ...] = (
      "origin_story",
      "problem_statement",
      "founder_bio",
      "case_study",
      "game",
      "bonus",
      *(() if _SUPPRESSED else ("theme",)),
  )
  ```

Do NOT touch the publisher or DispatchState — when `theme` is absent, the publisher's `write_issue_draft` already tolerates a missing/None field and the web side ignores it (Plan 03). No downstream change required.
  </action>
  <verify>
    <automated>cd packages/pipeline && DESIGNAGENT_SUPPRESSED=true pytest tests/agents/test_validate.py -v</automated>
  </verify>
  <acceptance_criteria>
    - builder.py contains `_SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED"` and `*(() if _SUPPRESSED else ("design",))` and `if not _SUPPRESSED:` guarding `add_node("design"`
    - validate.py contains `_SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED"` and `*(() if _SUPPRESSED else ("theme",))`
    - The truthiness expression `("1", "true", "yes")` is byte-identical between builder.py and validate.py
    - `cd packages/pipeline && DESIGNAGENT_SUPPRESSED=true pytest tests/agents/test_validate.py` exits 0 and the suppressed-mode test PASSES (no longer xfail-skipped)
    - `cd packages/pipeline && pytest tests/agents/test_validate.py` (flag unset) exits 0 with `theme` still required
  </acceptance_criteria>
  <done>Both files gate on the same flag in lockstep; suppressed mode drops the design node + theme requirement; default mode unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Add the Machine Editorial envelope to the DesignAgent system prompt (MED-03)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py (_build_messages at lines ~83-125; the system string at lines ~97-106; ThemeOutput, _validate_full, _call_llm, the design() body, SAFE_THEME/FALLBACK usage — ALL of these stay byte-unchanged except the system string)
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md (Pattern 3 + Code Examples "DesignAgent prompt envelope addition" — the exact envelope text to encode)
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-CONTEXT.md (D-12 — lock canvas/text feel, steer fonts to Cormorant Garamond/Lora, allow primary/accent to vary in dark metallic/ember range)
  </read_first>
  <action>
Edit ONLY the `system` string assignment inside `_build_messages()` in `packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py`. Do NOT change `ThemeOutput`, `_validate_full`, `_call_llm`, the `design()` body, the regenerate-once flow, `SAFE_THEME`, `FALLBACK_FONT_DISPLAY`/`FALLBACK_FONT_BODY`, or the `display_list`/`body_list` whitelist injection.

Replace the current `system = (...)` block with the Machine Editorial envelope version. The new string MUST contain the literal phrase `Machine Editorial` (the Wave 0 test asserts this). Keep the existing whitelist + WCAG lines intact at the end. Use this exact content:
```python
system = (
    "You are the DesignAgent for The Eisenbalm Dispatch.\n\n"
    "AESTHETIC ENVELOPE (Machine Editorial):\n"
    "  backgroundColor: near-black warm canvas. Target range: #0A0908-#1A1511. "
    "Do NOT use white, light grey, or pastels for backgroundColor.\n"
    "  textColor: warm cream. Target range: #E8E0CE-#F5EFE0. "
    "Ensure >= 4.5:1 WCAG-AA contrast with your backgroundColor.\n"
    "  fontDisplay: strongly prefer Cormorant Garamond.\n"
    "  fontBody: strongly prefer Lora.\n"
    "  primaryColor + accentColor: vary per issue within a dark metallic/ember "
    "register (gold, copper, ochre for primary; ember, terracotta, rust for "
    "accent). These are the per-issue identity variables and will not be used "
    "as body text.\n\n"
    "Output exactly four six-digit hex colors and two font names. You will not "
    "invent a font. WCAG-AA contrast is a precondition, not a polish step.\n\n"
    f"fontDisplay must be one of: {display_list}\n"
    f"fontBody must be one of: {body_list}\n\n"
    "WCAG-AA: contrast ratio between backgroundColor and textColor "
    ">= 4.5:1. Your choices will be validated programmatically; a "
    "second failure forces a hardcoded fallback."
)
```
Note: the steering uses "strongly prefer" / "Target range" (soft steering) — not hard constraints — so the existing `_validate_full` whitelist + WCAG validation remains the binding gate and per-issue variation is preserved (D-12). The font whitelist still controls the actual allowed fonts; this prompt only steers the first choice.
  </action>
  <verify>
    <automated>cd packages/pipeline && pytest tests/agents/test_design.py -v</automated>
  </verify>
  <acceptance_criteria>
    - design/__init__.py system string contains the literal `Machine Editorial`, `Cormorant Garamond`, and `Lora`
    - design/__init__.py still contains `ThemeOutput`, `_validate_full`, `SAFE_THEME`, `FALLBACK_FONT_DISPLAY`, `FALLBACK_FONT_BODY` unchanged (grep confirms presence; no edits to those symbols)
    - `display_list` and `body_list` f-string interpolation lines are preserved in the system string
    - `cd packages/pipeline && pytest tests/agents/test_design.py` exits 0 and `test_build_messages_contains_machine_editorial_envelope` PASSES (xfail removed)
  </acceptance_criteria>
  <done>The DesignAgent system prompt encodes the Machine Editorial envelope; all validation/fallback machinery is byte-unchanged; the envelope-phrase test is green.</done>
</task>

<task type="auto">
  <name>Task 3: Remove Wave 0 xfail markers and confirm full pipeline suite green both modes</name>
  <files>packages/pipeline/tests/agents/test_validate.py, packages/pipeline/tests/test_pipeline_real_mode.py, packages/pipeline/tests/agents/test_design.py</files>
  <read_first>
    - packages/pipeline/tests/agents/test_validate.py (the xfail marker on test_validate_sections_skips_theme_when_suppressed — added in Plan 01)
    - packages/pipeline/tests/test_pipeline_real_mode.py (the xfail marker on test_design_suppressed_graph_completes_without_theme; the unchanged test_full_graph_runs_to_publisher)
    - packages/pipeline/tests/agents/test_design.py (the xfail marker on test_build_messages_contains_machine_editorial_envelope)
  </read_first>
  <action>
Now that Tasks 1 and 2 implement the contracts, remove the three `@pytest.mark.xfail(...)` decorators added in Plan 01 (Wave 0) so the tests assert green-for-real:
- test_validate.py → `test_validate_sections_skips_theme_when_suppressed`
- test_pipeline_real_mode.py → `test_design_suppressed_graph_completes_without_theme`
- test_design.py → `test_build_messages_contains_machine_editorial_envelope`

Do NOT modify the test bodies or the unchanged `test_full_graph_runs_to_publisher` (which still runs in default/non-suppressed mode and asserts `theme.primaryColor`). Run the full pipeline suite in BOTH modes to confirm no regression:
- Default (flag unset): `test_full_graph_runs_to_publisher` and theme.primaryColor assertion still pass; `design` node present.
- Suppressed (`DESIGNAGENT_SUPPRESSED=true`): the suppressed tests pass; `test_full_graph_runs_to_publisher` may be skipped or still pass depending on its own env handling — if it FAILS under the global suppressed env, that is acceptable ONLY if the suppressed run is invoked per-test via monkeypatch+reload (it is). Confirm the DEFAULT-mode full run is green, since that is the suite's standing invariant.
  </action>
  <verify>
    <automated>cd packages/pipeline && pytest</automated>
  </verify>
  <acceptance_criteria>
    - No `xfail` decorator referencing Plan 12-02 remains in test_validate.py, test_pipeline_real_mode.py, or test_design.py
    - `cd packages/pipeline && pytest` exits 0 in default mode (flag unset) — all tests green including test_full_graph_runs_to_publisher
    - `cd packages/pipeline && DESIGNAGENT_SUPPRESSED=true pytest tests/agents/test_validate.py tests/agents/test_design.py` exits 0
  </acceptance_criteria>
  <done>All Wave 0 pipeline stubs are now green-for-real; the full default-mode suite passes with no regression.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && pytest` exits 0 (default mode — design node present, theme required, real-mode test green)
- `cd packages/pipeline && DESIGNAGENT_SUPPRESSED=true pytest tests/agents/test_validate.py` exits 0 (suppressed mode — theme dropped)
- builder.py and validate.py share byte-identical `_SUPPRESSED` truthiness logic
- DesignAgent prompt contains the Machine Editorial envelope; validation machinery unchanged
</verification>

<success_criteria>
- MED-02 (pipeline): flipping DESIGNAGENT_SUPPRESSED true→false (env + restart) toggles the design node + theme requirement with no code change
- MED-03: the system prompt encodes the Machine Editorial aesthetic; ThemeOutput/_validate_full/SAFE_THEME/FALLBACK_FONT_* byte-unchanged
- All Wave 0 pipeline xfail stubs converted to passing assertions
- No new pip dependencies; no DispatchState/schema field changes
</success_criteria>

<output>
After completion, create `.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-02-SUMMARY.md`
</output>
