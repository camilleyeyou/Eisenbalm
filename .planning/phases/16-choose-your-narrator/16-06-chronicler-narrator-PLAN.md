---
phase: 16-choose-your-narrator
plan: 06
type: execute
wave: 4
depends_on: [16-04, 16-05]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py
autonomous: true
requirements:
  - NRR-02
  - NRR-06
  - NRR-08
must_haves:
  truths:
    - "Chronicler system prompt is composed from UNIVERSAL_CORE + WINNER AUTHORITY line + narrator.voiceRubric"
    - "JESSE_PERSONA_BLOCK is NOT in the chronicler system prompt (only UNIVERSAL_CORE is)"
    - "When narrator.slug == 'jesse', chronicler output is byte-equivalent to Phase 14 chronicler behaviour modulo the WINNER AUTHORITY line (NRR-02)"
    - "WINNER AUTHORITY rule appears explicitly in the chronicler persona-agnostic preamble (per CONTEXT canonical_refs line 122 + D-04 caveat)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py"
      provides: "narrator-aware chronicler with WINNER AUTHORITY preamble"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py"
      to: "packages/pipeline/src/eisenbalm_pipeline/lib/voice.UNIVERSAL_CORE"
      via: "system prompt composition"
      pattern: "from eisenbalm_pipeline.lib.voice import UNIVERSAL_CORE"
---

<objective>
Refactor the chronicler agent to compose its system prompt from `UNIVERSAL_CORE + WINNER_AUTHORITY_PREAMBLE + narrator.voiceRubric` instead of consuming `VOICE_CONSTRAINTS` verbatim. The WINNER AUTHORITY rule (per CONTEXT canonical_refs line 122) lives here — NOT in `voice.py`.

Purpose: Make the chronicler the ONLY agent whose system prompt varies by narrator. NRR-02 (chronicler narrator-aware) and NRR-06 (no leakage to other agents) are enforced here.

Output: Updated `chronicler.py` that:
- Imports `UNIVERSAL_CORE` (not `VOICE_CONSTRAINTS`).
- Builds a `_build_system_prompt(narrator)` helper that concatenates UNIVERSAL_CORE + WINNER AUTHORITY preamble + `narrator.voiceRubric` rendered as plain text + optional `narrator.exampleSamples`.
- Substitutes "Jesse's voice" → f"{narrator.displayName}'s voice" in the UNIVERSAL_CORE opening sentence so the chronicler's first sentence stays grammatical when a non-Jesse narrator is active.

Implements: D-04 (chronicler-side WINNER AUTHORITY placement), D-05 (chronicler reads narrator from state), D-10 (system prompt structure), NRR-02/06/08.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py
@packages/pipeline/src/eisenbalm_pipeline/lib/voice.py  # <-- post-16-04 (UNIVERSAL_CORE + JESSE_PERSONA_BLOCK exist)

<decisions_implemented>
- **D-04 caveat** (re-confirmed by B1 revision): WINNER AUTHORITY rule lives in the chronicler agent's `_build_system_prompt`. Specifically in a constant `WINNER_AUTHORITY_PREAMBLE` placed between UNIVERSAL_CORE and the narrator voice rubric. CONTEXT canonical_refs line 122 ("WINNER AUTHORITY becomes part of UNIVERSAL_CORE") is overridden by D-04's allowance ("or in the chronicler persona-agnostic preamble") and by Research §G analysis (the rule is vacuous for narrative writers).
- **D-05**: Chronicler reads `state["narrator"]` (resolved object, not the slug).
- **D-10**: System prompt structure = UNIVERSAL_CORE + WINNER AUTHORITY + narrator-specific rubric + optional example samples.
</decisions_implemented>

<interfaces>
Imports the chronicler needs (post-16-04):
```python
from eisenbalm_pipeline.lib.voice import UNIVERSAL_CORE  # NOT VOICE_CONSTRAINTS
from eisenbalm_pipeline.state import Narrator, DispatchState
```

The WINNER AUTHORITY preamble — define as a module-level constant in chronicler.py:
```python
WINNER_AUTHORITY_PREAMBLE = (
    "WINNER AUTHORITY: This issue features one charity, selected after deliberation. "
    "Treat that charity as the sole subject of your chronicle. Do not equivocate, "
    "do not invoke the runners-up, and do not soften the win with hedging. The "
    "selection is final."
)
```

Substitution rule (so UNIVERSAL_CORE's "Jesse's voice" opening reads correctly under non-Jesse narrators):
```python
def _personalize_universal_core(core: str, narrator: Narrator) -> str:
    """
    UNIVERSAL_CORE begins with the sentence "Jesse's voice is dry, precise, and
    absurdly serious." When the active narrator is NOT Jesse, replace the
    leading "Jesse's voice" with "<DisplayName>'s voice" so the first sentence
    stays grammatical and the rubric flows.

    For Jesse, this is a no-op (str.replace on "Jesse's voice" → "Jesse's voice").
    """
    return core.replace("Jesse's voice", f"{narrator['displayName']}'s voice", 1)
```
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Refactor chronicler.py to compose system prompt from UNIVERSAL_CORE + WINNER AUTHORITY + narrator rubric</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py</files>

  <read_first>
    1. READ the FULL current `packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py`. Note:
       - the current import block (probably imports `VOICE_CONSTRAINTS`),
       - the chronicler entry function name and signature,
       - any prompt template files referenced from the `prompts/` directory.
    2. RE-READ `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` post-16-04 to confirm `UNIVERSAL_CORE` exists and is importable.
    3. READ `packages/pipeline/src/eisenbalm_pipeline/state.py` post-16-05 to confirm `Narrator` TypedDict has `displayName`, `voiceRubric`, `exampleSamples` fields.
  </read_first>

  <action>
    Edit `chronicler.py`:

    1. **Replace the import** `from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS` with:
       ```python
       from eisenbalm_pipeline.lib.voice import UNIVERSAL_CORE
       from eisenbalm_pipeline.state import Narrator, DispatchState
       ```

    2. **Add module-level constant** for WINNER AUTHORITY (per D-04 caveat + CONTEXT canonical_refs line 122):
       ```python
       WINNER_AUTHORITY_PREAMBLE = (
           "WINNER AUTHORITY: This issue features one charity, selected after deliberation. "
           "Treat that charity as the sole subject of your chronicle. Do not equivocate, "
           "do not invoke the runners-up, and do not soften the win with hedging. The "
           "selection is final."
       )
       ```

    3. **Add a private helper** `_personalize_universal_core`:
       ```python
       def _personalize_universal_core(core: str, narrator: Narrator) -> str:
           """Replace 'Jesse's voice' with '<DisplayName>'s voice' in the first sentence of UNIVERSAL_CORE. No-op for Jesse."""
           return core.replace("Jesse's voice", f"{narrator['displayName']}'s voice", 1)
       ```

    4. **Add a private helper** `_render_voice_rubric(rubric)` that turns a `NarratorVoiceRubric` TypedDict into plain text:
       ```python
       def _render_voice_rubric(rubric: NarratorVoiceRubric) -> str:
           constraints_lines = "\n".join(f"- {c}" for c in rubric["constraints"])
           return (
               f"Register: {rubric['register']}\n"
               f"Cadence: {rubric['cadence']}\n"
               f"Constraints:\n{constraints_lines}"
           )
       ```

    5. **Add a private helper** `_build_system_prompt(narrator)`:
       ```python
       def _build_system_prompt(narrator: Narrator) -> str:
           """
           Compose chronicler system prompt:
             1. UNIVERSAL_CORE (personalized — 'Jesse's voice' → '<DisplayName>'s voice')
             2. blank line
             3. WINNER_AUTHORITY_PREAMBLE  (per D-04 caveat — NOT in UNIVERSAL_CORE)
             4. blank line
             5. narrator.voiceRubric rendered as plain text
             6. (optional) blank line + "Reference samples:" + first 2 example samples joined by blank lines
           """
           core = _personalize_universal_core(UNIVERSAL_CORE, narrator)
           rubric = _render_voice_rubric(narrator["voiceRubric"])

           parts = [core, "", WINNER_AUTHORITY_PREAMBLE, "", rubric]

           samples = narrator.get("exampleSamples") or []
           if samples:
               parts.extend(["", "Reference samples:", *samples[:2]])

           return "\n".join(parts)
       ```

    6. **In the chronicler entry function**: read `narrator = state["narrator"]` (which is guaranteed populated by calibrator post-16-05). Call `_build_system_prompt(narrator)` to produce the system message. Replace whatever currently puts `VOICE_CONSTRAINTS` into the system message with this composed prompt.

    7. Do NOT add an inline-import of `JESSE_PERSONA_BLOCK`. It is intentionally not used here — UNIVERSAL_CORE alone, with the displayName substitution, is the chronicler's persona base.

    8. Do NOT touch the chronicler's user message format. Section bodies flow into the user message as in Phase 14.
  </action>

  <verify>
    <automated>
      # 1. Chronicler imports UNIVERSAL_CORE, not VOICE_CONSTRAINTS.
      grep -q "from eisenbalm_pipeline.lib.voice import UNIVERSAL_CORE" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py
      ! grep -E "from eisenbalm_pipeline\.lib\.voice import .*VOICE_CONSTRAINTS" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py
      # Second line must FAIL to find any VOICE_CONSTRAINTS import in chronicler.

      # 2. WINNER AUTHORITY lives in chronicler.py (count ≥ 1).
      [ "$(grep -c 'WINNER AUTHORITY' packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py)" -ge 1 ]

      # 3. WINNER AUTHORITY does NOT live in voice.py (B1 cross-check, count == 0).
      [ "$(grep -c 'WINNER AUTHORITY' packages/pipeline/src/eisenbalm_pipeline/lib/voice.py)" -eq 0 ]

      # 4. Chronicler narrator-aware tests pass (created by Plan 16-02 Task 2).
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler_narrator.py -v

      # 5. Jesse-equivalence chronicler test passes: when narrator=jesse, system prompt
      #    is byte-equivalent to (UNIVERSAL_CORE personalized + WINNER_AUTHORITY + rubric).
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler_narrator.py::test_jesse_narrator_system_prompt_uses_universal_core -v

      # 6. No regression on Phase 14 chronicler tests.
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler.py -v
    </automated>
  </verify>

  <done>
    - Chronicler imports `UNIVERSAL_CORE` and does NOT import `VOICE_CONSTRAINTS`.
    - `WINNER_AUTHORITY_PREAMBLE` is a module-level constant in chronicler.py.
    - `_build_system_prompt(narrator)` composes the system message per D-10 structure.
    - `_personalize_universal_core` substitutes the displayName only at the leading sentence.
    - `WINNER AUTHORITY` does NOT appear in voice.py (B1 cross-check).
    - All chronicler narrator tests pass.
    - Phase 14 chronicler tests still pass under narrator=jesse.
  </done>
</task>

</tasks>

<verification>
- `grep -c "WINNER AUTHORITY" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` returns ≥1.
- `grep -c "WINNER AUTHORITY" packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` returns 0.
- `uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler_narrator.py -v` exits 0.
- Pipeline-wide test count is ≥ Phase 14 baseline + Phase 16 additions.
</verification>

<success_criteria>
- Chronicler is narrator-aware (NRR-02).
- WINNER AUTHORITY lives in chronicler.py exclusively (D-04 caveat enforced).
- Jesse narrator path is byte-equivalent to Phase 14 chronicler modulo the new WINNER AUTHORITY line (Research §G accepts this delta).
- No leakage of narrator-aware behaviour to other agents (NRR-06).
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-06-chronicler-narrator-SUMMARY.md`. Record:
- The final system prompt template used.
- The grep cross-check results (WINNER AUTHORITY count in chronicler.py and voice.py).
- Cross-reference to 16-04 (UNIVERSAL_CORE source).
</output>
