---
phase: 16-choose-your-narrator
plan: 06
type: execute
wave: 2
depends_on: ["16-01", "16-02", "16-04", "16-05"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py
autonomous: true
requirements: [NRR-05]
must_haves:
  truths:
    - "Chronicler's _build_system_prompt accepts voice_constraints: str kwarg and embeds it as the system prompt prefix"
    - "chronicler() node body computes voice = state.get('style_brief', {}).get('voice', VOICE_CONSTRAINTS) and passes voice_constraints=voice to _build_system_prompt"
    - "When state['style_brief']['voice'] == VOICE_CONSTRAINTS (narrator=None branch), chronicler system prompt is BYTE-IDENTICAL to pre-Phase-16 (NRR-10 byte-equivalence)"
    - "WINNER AUTHORITY rule (current line 77-83) stays IN the chronicler-specific system prompt rules — it is universal to the chronicler regardless of narrator (RESEARCH §G)"
    - "Phase 13 D-18 fallback path (chronicler failure → editor_gate_1 deterministic transcript preserved) is UNTOUCHED — the try/except inside the node body stays exactly as today"
    - "Wave 0 test_chronicler.py::test_narrator_voice_propagation flips GREEN"
    - "All existing Phase 13 chronicler tests (test_chronicler_emits_well_formed_turns / faithful dramatization / fallback / model_versions) stay GREEN"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py"
      provides: "narrator-aware system prompt assembly via style_brief['voice']"
      contains: "voice_constraints"
  key_links:
    - from: "chronicler.py _build_system_prompt"
      to: "lib/voice.VOICE_CONSTRAINTS default param"
      via: "voice_constraints: str = VOICE_CONSTRAINTS kwarg"
      pattern: "voice_constraints"
    - from: "chronicler() node body"
      to: "state['style_brief']['voice']"
      via: "state.get('style_brief', {}).get('voice', VOICE_CONSTRAINTS)"
      pattern: "style_brief"
---

<objective>
Migrate Chronicler from direct VOICE_CONSTRAINTS import to consuming style_brief["voice"]. This is the minimal change that closes NRR-05 (Chronicler dramatizes in narrator voice when set, falls back to Jesse when unset).

Per Research §F: 2 lines added to _build_system_prompt (signature + interpolation), 1 line changed in chronicler() node body. The Phase 13 D-18 fallback path is untouched. The WINNER AUTHORITY rule (current line 77-83 in chronicler.py) stays in the chronicler-specific system prompt rules per Research §G — it is universal to chronicler regardless of narrator, and adding it to UNIVERSAL_CORE would be vacuous noise for the 4 section writers.

This plan does NOT touch lib/voice.py (Plan 16-04 landed it) and does NOT change the chronicler() node's emit_event=None semantics or the @agent_node wrapper.

Output: 1 file modified; 1 Wave 0 test flips GREEN (test_narrator_voice_propagation in test_chronicler.py); 4 existing Phase 13 chronicler tests stay GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
@.planning/phases/13-deliberation-as-conversation/13-CONTEXT.md

<interfaces>
<!-- Phase 16-04 already shipped: -->
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, assemble_voice

<!-- Plan 16-05 already shipped: -->
# Calibrator sets state['style_brief']['voice'] via assemble_voice(narrator).
# When narrator is None: style_brief['voice'] == VOICE_CONSTRAINTS.

<!-- Chronicler new shape (this plan ships): -->
def _build_system_prompt(voice_constraints: str = VOICE_CONSTRAINTS) -> str:
    return f"{voice_constraints}\n\n..."

# In chronicler() body:
voice = state.get("style_brief", {}).get("voice", VOICE_CONSTRAINTS)
system = _build_system_prompt(voice_constraints=voice)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Refactor chronicler.py _build_system_prompt to accept voice_constraints kwarg + read style_brief['voice'] in node body</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py</files>
  <behavior>
    - _build_system_prompt(voice_constraints: str = VOICE_CONSTRAINTS) — kwarg added with VOICE_CONSTRAINTS default for back-compat
    - The system prompt body uses {voice_constraints} interpolation instead of {VOICE_CONSTRAINTS}
    - chronicler() node body computes `voice = state.get('style_brief', {}).get('voice', VOICE_CONSTRAINTS)` and calls `_build_system_prompt(voice_constraints=voice)`
    - When voice == VOICE_CONSTRAINTS (Jesse default), the system prompt is byte-identical to pre-Phase-16
    - The narrator-sentinel test in test_chronicler.py::test_narrator_voice_propagation passes (sentinel string from style_brief['voice'] appears in the chronicler system message)
    - Phase 13 D-18 fallback (the try/except returning {"deliberation_conversation": None}) stays UNCHANGED at lines 162-197
    - WINNER AUTHORITY rule stays in _build_system_prompt body (current lines 77-83) — Research §G locked it there
  </behavior>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py FULL FILE (198 lines — _build_system_prompt at lines 53-86, chronicler() node body at lines 137-197)
    - packages/pipeline/tests/test_chronicler.py (the new Phase 16 test test_narrator_voice_propagation appended in Plan 16-02 — confirms which sentinel string the chronicler system prompt must include when style_brief['voice'] carries the marker)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §F (exact migration pattern) + §G (WINNER AUTHORITY placement decision — stays in chronicler-specific rules, NOT in UNIVERSAL_CORE)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-04 (WINNER AUTHORITY universal across narrators for the chronicler) + D-05 (Chronicler consumer surface stable — reads style_brief["voice"], not direct import)
    - .planning/phases/13-deliberation-as-conversation/13-CONTEXT.md D-18 (fallback preserves editor_gate_1 deterministic transcript)
  </read_first>
  <action>
Two surgical edits to packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py.

(A) Lines 53-86 — change the _build_system_prompt function signature + interpolation. Replace ONLY the function header (line 53) and the first interpolation line (line 55-56). Keep the rest of the rules (lines 57-86) byte-identical:

Current line 53-56:
```python
def _build_system_prompt() -> str:
    """Return the Chronicler system prompt with VOICE_CONSTRAINTS verbatim."""
    return (
        f"{VOICE_CONSTRAINTS}\n\n"
```

Replace with:
```python
def _build_system_prompt(voice_constraints: str = VOICE_CONSTRAINTS) -> str:
    """Return the Chronicler system prompt with the given voice_constraints.

    Phase 16 (NRR-05): accepts voice_constraints kwarg. Default = VOICE_CONSTRAINTS
    (Jesse) so the function remains back-compat-callable with no args. The
    chronicler() node body computes voice_constraints from state['style_brief']['voice']
    which the Calibrator has set via assemble_voice(narrator). When narrator is
    None, style_brief['voice'] == VOICE_CONSTRAINTS — byte-identical system prompt
    to pre-Phase-16 (NRR-10 zero-regression).
    """
    return (
        f"{voice_constraints}\n\n"
```

The body of the function (lines 57-86 containing "You are The Chronicler..." through the 8 rules including WINNER AUTHORITY at rule 7) stays BYTE-IDENTICAL. Do NOT remove WINNER AUTHORITY — Research §G keeps it here.

(B) Line 157 in the chronicler() node body — change the system prompt assembly. Locate the current line:
```python
    system = _build_system_prompt()
```

Replace with:
```python
    # Phase 16 (NRR-05): Chronicler consumes the narrator-aware voice via
    # state['style_brief']['voice'] (set by Calibrator at pipeline start).
    # When narrator is unset, style_brief['voice'] == VOICE_CONSTRAINTS (Jesse
    # byte-equivalent — D-13).
    voice = state.get("style_brief", {}).get("voice", VOICE_CONSTRAINTS)
    system = _build_system_prompt(voice_constraints=voice)
```

Leave the rest of the chronicler() function body UNCHANGED — including the try/except D-18 fallback (lines 162-197), the WINNER AUTHORITY enforcement in the user prompt (lines 109-124 in _build_user_prompt), and the AGT-17 model_versions recording.

The existing `from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS` import at line 33 stays as-is — it's still used as the default kwarg value for back-compat AND as the fallback in the new `voice = state.get(...).get(..., VOICE_CONSTRAINTS)` expression.
  </action>
  <verify>
    <automated>grep -E "def _build_system_prompt\(voice_constraints: str = VOICE_CONSTRAINTS\)" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py returns a match; grep -E "voice = state.get\(.style_brief., \{\}\).get\(.voice., VOICE_CONSTRAINTS\)" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py returns a match; grep -E "WINNER AUTHORITY" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py returns at least 2 matches (1 in system prompt + 1 in user prompt — Phase 13 quick-fix 260524-ojm); uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler.py -q exits 0 (existing Phase 13 + new Phase 16 test_narrator_voice_propagation all GREEN); uv run --project packages/pipeline pytest packages/pipeline/tests/ -x -q exits 0 (full suite green)</automated>
  </verify>
  <done>chronicler.py _build_system_prompt accepts voice_constraints kwarg; node body reads style_brief['voice']; WINNER AUTHORITY rule preserved at chronicler-specific level; Phase 13 D-18 fallback preserved; test_narrator_voice_propagation GREEN; all existing chronicler + pipeline tests GREEN.</done>
</task>

</tasks>

<verification>
- test_chronicler.py::test_narrator_voice_propagation (Phase 16 RED test from Plan 16-02) flips GREEN.
- All Phase 13 chronicler tests (well_formed turns, faithful dramatization, fallback, model_versions, WINNER AUTHORITY enforcement) stay GREEN.
- Phase 13 deliberation-conversation Vitest tripwire stays GREEN (chronicler output shape unchanged — speaker + text turns).
- Quick task 260524-ojm WINNER AUTHORITY fix is preserved (Sept 25 commit; never regressed).
</verification>

<success_criteria>
- NRR-05 verified: chronicler reads narrator voice via style_brief["voice"].
- NRR-10 zero-regression: when narrator unset, chronicler system prompt is byte-identical to pre-Phase-16.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-06-SUMMARY.md` documenting: the two edits, confirmation that WINNER AUTHORITY rule stayed in the chronicler-specific prompt (not moved to UNIVERSAL_CORE — Research §G decision), and the byte-equivalence verification.
</output>
