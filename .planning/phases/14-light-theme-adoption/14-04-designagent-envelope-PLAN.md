---
phase: 14-light-theme-adoption
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
autonomous: true
requirements: [LIGHT-06]
nyquist_compliant: true

must_haves:
  truths:
    - "The DesignAgent 'AESTHETIC ENVELOPE' system-prompt block describes the warm-paper LIGHT aesthetic (canvas #FAFAF8, near-black ink #1A1A1A), not the dark canvas (#0C0B0A / cream #F0EAD9)"
    - "Only the prompt prose changes — ThemeOutput shape, _validate_full, font whitelist, WCAG gate, regenerate-once, SAFE_THEME fallback, and the @agent_node contract are byte-unchanged"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py"
      provides: "Light aesthetic envelope so a re-enabled DesignAgent produces on-brand light themes (MED-03 alignment carried to light)"
      contains: "FAFAF8"
  key_links:
    - from: "agents/design/__init__.py _build_messages() system prompt"
      to: "the Phase 14 light house palette (the active aesthetic)"
      via: "AESTHETIC ENVELOPE prose describing warm paper + near-black ink"
      pattern: "warm paper|FAFAF8|daylight"
---

<objective>
Update the DesignAgent's "AESTHETIC ENVELOPE (Machine Editorial)" system-prompt block from the dark canvas description to the warm-paper light description, so that if the DesignAgent is ever re-enabled it generates within the new light aesthetic (the Phase 12 MED-03 commitment to keep the prompt aligned with the active aesthetic, carried forward to light). This is a TEXT-ONLY change to the prompt string — no functional code, no validation logic, no signature changes. Independent of the web changes (different tree → parallelizable as Wave 1).

Purpose: The single-fixed-palette architecture keeps the DesignAgent suppressed; this edit keeps its dormant prompt on-brand for the day it is re-enabled.
Output: Updated aesthetic-envelope prose in `packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/14-light-theme-adoption/14-UI-SPEC.md
@.planning/phases/14-light-theme-adoption/14-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite the AESTHETIC ENVELOPE prompt block from dark canvas to warm-paper light</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py (the _build_messages() system string, lines ~97-117 — the dark envelope being replaced)
    - .planning/phases/14-light-theme-adoption/14-UI-SPEC.md (§"DesignAgent System-Prompt Update" lines ~352-369 — the dark→light envelope replacement spec)
    - .planning/phases/14-light-theme-adoption/14-RESEARCH.md (§"Pattern 7: DesignAgent Prose Update" lines ~223-241 + §"Open Question 2" lines ~445-448 — confirm the extended font list needs NO change)
  </read_first>
  <action>
    In packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py, edit ONLY the `system` string inside `_build_messages()` (lines ~97-117). Replace the dark "AESTHETIC ENVELOPE (Machine Editorial)" description with a warm-paper LIGHT description per 14-UI-SPEC.md §"DesignAgent System-Prompt Update". Keep the soft-steering tone ("strongly prefer" / "Target range") that the Phase 12 D-12 decision established (STATE.md: soft steering, hard gate is the validator).

    Replace the dark envelope lines:
      backgroundColor: near-black warm canvas, Target range #0A0908-#1A1511, "Do NOT use white…"
      textColor: warm cream, Target range #E8E0CE-#F5EFE0
    with LIGHT envelope lines per UI-SPEC §"Light envelope (replacement)":
      - Canvas / backgroundColor: warm paper. Target range near #FAFAF8 (warm off-white / daylight broadsheet). Do NOT use near-black, charcoal, or dark canvases for backgroundColor.
      - Ink / textColor: near-black warm ink. Target range near #1A1A1A. Ensure >= 4.5:1 WCAG-AA contrast with the (light) backgroundColor.
      - primaryColor: brand gold #CDA434 register (decorative — fills/borders/large glyphs, NOT body text on light).
      - accentColor: brand rust #C2502A register (borders/large text only).
      - Atmosphere/character note: editorial magazine on quality paper with subtle warm ink-wash atmosphere — NOT digital dark-mode.

    Keep the WCAG-AA precondition sentence, the "Output exactly four six-digit hex colors and two font names" sentence, and the `fontDisplay must be one of: {display_list}` / `fontBody must be one of: {body_list}` lines EXACTLY as-is (the font whitelist is locked — Open Question 2 confirms the extended list describes available options, not dark-specific selections; no font change). Note the envelope still says "Machine Editorial" as the design-language name — that name is retained per the ROADMAP framing; only the dark→light canvas/ink description changes. (You may keep or lightly adjust the "(Machine Editorial)" parenthetical; do not rename the design language.)

    DO NOT change: ThemeOutput class, _validate_full(), the FONT_WHITELIST imports, the @agent_node decorator/contract, the regenerate-once retry, the SAFE_THEME fallback, the qaCorrections write, or any function signature. This is prose-only.
  </action>
  <verify>
    <automated>grep -iE "FAFAF8|warm paper|daylight|near-black|light" packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -iE "FAFAF8|warm paper|daylight" packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` matches (light canvas described)
    - `grep -c "#0C0B0A" packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` == 0
    - `grep -c "warm cream" packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` == 0 (dark ink description removed)
    - `grep "fontDisplay must be one of" packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` matches (whitelist lines untouched)
    - `grep "response_format=ThemeOutput" packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` matches (call contract unchanged)
    - `grep "@agent_node(name=\"design\", emit_event=\"section-draft\")" packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` matches (decorator unchanged)
    - Pipeline import smoke: `cd packages/pipeline && python -c "import ast; ast.parse(open('src/eisenbalm_pipeline/agents/design/__init__.py').read())"` exits 0 (file still parses)
  </acceptance_criteria>
  <done>The AESTHETIC ENVELOPE describes the warm-paper light aesthetic (canvas #FAFAF8, near-black ink #1A1A1A); no dark canvas/cream literals remain; the font whitelist, ThemeOutput shape, validation, and @agent_node contract are byte-unchanged; the module parses.</done>
</task>

</tasks>

<verification>
- `grep -iE "FAFAF8|warm paper|daylight" packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` matches; `grep -c "#0C0B0A" …` == 0.
- DesignAgent existing pipeline tests stay green (run if a design test exists): `cd packages/pipeline && python -m pytest -k design -q` (the suppression/envelope-phrase test from Phase 12 should still pass — note Phase 12 asserted an envelope phrase; if a test asserts a dark-specific phrase, the test is updated separately only if it pins dark wording — flag in SUMMARY if so).
- Manual (LIGHT-06, per 14-VALIDATION.md §Manual-Only): read the updated envelope and confirm it coherently describes the warm-paper light aesthetic.
- No functional/signature change; FONT_WHITELIST untouched.
</verification>

<success_criteria>
- The DesignAgent aesthetic envelope describes the LIGHT aesthetic so a re-enabled run is on-brand (LIGHT-06).
- Suppression flag + per-issue-theme-off architecture + ThemeOutput + validation + fallback unchanged.
</success_criteria>

<output>
After completion, create `.planning/phases/14-light-theme-adoption/14-04-SUMMARY.md` (flag any Phase 12 test that pins a dark-specific envelope phrase).
</output>
