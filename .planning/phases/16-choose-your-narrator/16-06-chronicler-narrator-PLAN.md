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
- Builds a `_build_system_prompt(narrator)` helper that concatenates UNIVERSAL_CORE + WINNER AUTHORITY preamble + `narrator.voiceRubric` (plain str — see Plan 16-01 + Plan 16-05) + optional `narrator.exampleSamples`.
- Substitutes "Jesse's voice" → f"{narrator['name']}'s voice" in the UNIVERSAL_CORE opening sentence so the chronicler's first sentence stays grammatical when a non-Jesse narrator is active. (Note: the field is `name`, not `displayName` — see Plan 16-01 Sanity narratorProfile schema + Plan 16-05 Narrator TypedDict.)

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
@packages/pipeline/src/eisenbalm_pipeline/state.py     # <-- post-16-05: Narrator TypedDict has `name` (not displayName) and `voiceRubric: str` (not structured)

<decisions_implemented>
- **D-04 caveat** (re-confirmed by B1 revision): WINNER AUTHORITY rule lives in the chronicler agent's `_build_system_prompt`. Specifically in a constant `WINNER_AUTHORITY_PREAMBLE` placed between UNIVERSAL_CORE and the narrator voice rubric. CONTEXT canonical_refs line 122 ("WINNER AUTHORITY becomes part of UNIVERSAL_CORE") is overridden by D-04's allowance ("or in the chronicler persona-agnostic preamble") and by Research §G analysis (the rule is vacuous for narrative writers).
- **D-05**: Chronicler reads `state["narrator"]` (resolved object, not the slug).
- **D-08 / Plan 16-01 + Plan 16-05 (re-confirmed by this revision)**: The canonical `Narrator` TypedDict mirrors the Sanity narratorProfile schema verbatim. The display-name field is `name` (NOT `displayName`). The `voiceRubric` field is a plain `str` (NOT a structured `NarratorVoiceRubric` TypedDict with `register` / `cadence` / `constraints` sub-fields). Plan 16-07 already follows this pattern via `narrator.get("voiceRubric") or ""`; this plan now does the same.
- **D-10**: System prompt structure = UNIVERSAL_CORE + WINNER AUTHORITY + narrator-specific rubric + optional example samples.
</decisions_implemented>

<interfaces>
Imports the chronicler needs (post-16-04 + post-16-05):
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

Substitution rule (so UNIVERSAL_CORE's "Jesse's voice" opening reads correctly under non-Jesse narrators). The narrator field is `name`, per the Sanity narratorProfile schema (Plan 16-01) and the Narrator TypedDict (Plan 16-05):
```python
def _personalize_universal_core(core: str, narrator: Narrator) -> str:
    """
    UNIVERSAL_CORE begins with the sentence "Jesse's voice is dry, precise, and
    absurdly serious." When the active narrator is NOT Jesse, replace the
    leading "Jesse's voice" with "<Name>'s voice" so the first sentence
    stays grammatical and the rubric flows.

    For Jesse, this is a no-op (str.replace on "Jesse's voice" → "Jesse's voice").
    """
    return core.replace("Jesse's voice", f"{narrator['name']}'s voice", 1)
```

voiceRubric handling — plain string, matching the canonical pattern from Plan 16-07:
```python
# Plan 16-07 sets the canonical pattern:
#   rubric_str = narrator.get("voiceRubric") or ""
# This plan follows the same pattern. There is NO _render_voice_rubric helper and
# NO NarratorVoiceRubric structured TypedDict — both were wrong-schema artifacts
# from a prior revision that the Plan 16-05 schema-alignment retired.
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
    3. READ `packages/pipeline/src/eisenbalm_pipeline/state.py` post-16-05 to confirm the canonical `Narrator` TypedDict fields: `name` (str), `slug` (str), `voiceConstraints` (str), `voiceRubric` (str — plain text, NOT a structured TypedDict), `exampleSamples` (list[str]), `active` (bool). The display-name field is `name`, NOT `displayName`. The voice-rubric field is a plain `str`, NOT a structured object — there is no `NarratorVoiceRubric` TypedDict to import. (See Plan 16-01 Sanity narratorProfile schema for the source of truth.)
    4. READ `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` (post-16-07) and confirm the canonical voiceRubric handling pattern is `narrator.get("voiceRubric") or ""`. This plan follows the same pattern for consistency.
  </read_first>

  <action>
    Edit `chronicler.py`:

    1. **Replace the import** `from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS` with:
       ```python
       from eisenbalm_pipeline.lib.voice import UNIVERSAL_CORE
       from eisenbalm_pipeline.state import Narrator, DispatchState
       ```
       Do NOT import `NarratorVoiceRubric` — that TypedDict does not exist in `state.py` post-16-05 (the schema-alignment revision retired it). `voiceRubric` is a plain `str`.

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
           """Replace 'Jesse's voice' with '<Name>'s voice' in the first sentence of UNIVERSAL_CORE. No-op for Jesse."""
           return core.replace("Jesse's voice", f"{narrator['name']}'s voice", 1)
       ```
       NOTE: The previous revision of this plan used `narrator['displayName']`, but the canonical TypedDict field is `name` (Sanity narratorProfile schema from Plan 16-01 + Narrator TypedDict from Plan 16-05). Using `displayName` raises KeyError on any non-Jesse narrator. Do NOT reintroduce `displayName`.

    4. **Do NOT add a `_render_voice_rubric` helper.** The previous revision of this plan defined a helper that treated `narrator['voiceRubric']` as a structured `NarratorVoiceRubric` TypedDict (with `register` / `cadence` / `constraints` sub-fields). That was wrong — `voiceRubric` is a plain `str` per the Sanity schema (Plan 16-01 field `type: 'text'`) + the Narrator TypedDict (Plan 16-05). Subscripting a `str` like a dict raises `TypeError`. Plan 16-07 already follows the canonical pattern (`narrator.get("voiceRubric") or ""`); this plan now does the same in step 5 below — inline, no helper needed.

    5. **Add a private helper** `_build_system_prompt(narrator)`:
       ```python
       def _build_system_prompt(narrator: Narrator) -> str:
           """
           Compose chronicler system prompt:
             1. UNIVERSAL_CORE (personalized — 'Jesse's voice' → '<Name>'s voice')
             2. blank line
             3. WINNER_AUTHORITY_PREAMBLE  (per D-04 caveat — NOT in UNIVERSAL_CORE)
             4. blank line
             5. narrator.voiceRubric — plain str (may be empty); matches Plan 16-07's pattern
             6. (optional) blank line + "Reference samples:" + first 2 example samples joined by blank lines

           voiceRubric is read as a plain str (Plan 16-01 Sanity field type: 'text';
           Plan 16-05 Narrator TypedDict). Canonical access pattern shared with Plan 16-07:
             rubric_str = narrator.get("voiceRubric") or ""
           """
           core = _personalize_universal_core(UNIVERSAL_CORE, narrator)
           rubric_str = narrator.get("voiceRubric") or ""

           parts = [
               core,                          # personalized UNIVERSAL_CORE
               "",
               WINNER_AUTHORITY_PREAMBLE,
               "",
               rubric_str,                    # plain string (may be empty for jesse)
           ]

           samples = narrator.get("exampleSamples") or []
           if samples:
               parts.extend(["", "Reference samples:", *samples[:2]])

           # Drop empty strings produced by an empty rubric_str so we never emit
           # consecutive blank lines around an absent rubric.
           return "\n".join(p for p in parts if p)
       ```

    6. **In the chronicler entry function**: read `narrator = state["narrator"]` (which is guaranteed populated by calibrator post-16-05). Call `_build_system_prompt(narrator)` to produce the system message. Replace whatever currently puts `VOICE_CONSTRAINTS` into the system message with this composed prompt.

    7. Do NOT add an inline-import of `JESSE_PERSONA_BLOCK`. It is intentionally not used here — UNIVERSAL_CORE alone, with the `name` substitution, is the chronicler's persona base.

    8. Do NOT touch the chronicler's user message format. Section bodies flow into the user message as in Phase 14.
  </action>

  <verify>
    <automated>
      # 1. Chronicler imports UNIVERSAL_CORE, not VOICE_CONSTRAINTS.
      grep -q "from eisenbalm_pipeline.lib.voice import UNIVERSAL_CORE" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py
      ! grep -E "from eisenbalm_pipeline\.lib\.voice import .*VOICE_CONSTRAINTS" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py
      # Second line must FAIL to find any VOICE_CONSTRAINTS import in chronicler.

      # 2. WINNER AUTHORITY lives in chronicler.py (count >= 1).
      [ "$(grep -c 'WINNER AUTHORITY' packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py)" -ge 1 ]

      # 3. WINNER AUTHORITY does NOT live in voice.py (B1 cross-check, count == 0).
      [ "$(grep -c 'WINNER AUTHORITY' packages/pipeline/src/eisenbalm_pipeline/lib/voice.py)" -eq 0 ]

      # 4. Schema-alignment guard A — narrator['displayName'] must NOT appear in chronicler.py
      #    (the canonical field is `name`; using displayName raises KeyError on non-Jesse narrators).
      ! grep -E "narrator\[.displayName.\]" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py

      # 5. Schema-alignment guard B — _render_voice_rubric must NOT exist
      #    (voiceRubric is a plain str; the structured-dict helper would raise TypeError).
      ! grep -E "_render_voice_rubric" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py

      # 6. Schema-alignment guard C — NarratorVoiceRubric must NOT be imported
      #    (that TypedDict does not exist in state.py post-16-05).
      ! grep -E "NarratorVoiceRubric" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py

      # 7. Schema-alignment positive guard — voiceRubric is accessed as a plain str via the
      #    canonical pattern shared with Plan 16-07.
      grep -E "rubric_str\s*=\s*narrator\.get\([\"\\']voiceRubric" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py

      # 8. Schema-alignment positive guard — _personalize_universal_core uses narrator['name'].
      grep -E "narrator\[.name.\]" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py

      # 9. Chronicler narrator-aware test passes (extended in Plan 16-02 Task 3 — function appended to test_chronicler.py).
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler.py::test_narrator_voice_propagation -v

      # 10. Full chronicler test file passes (Phase 13 baseline tests + Phase 16 narrator propagation extension; covers Jesse-equivalence under narrator=Jesse via the existing chronicler baseline test paths).
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler.py -v
    </automated>
  </verify>

  <done>
    - Chronicler imports `UNIVERSAL_CORE` and does NOT import `VOICE_CONSTRAINTS`.
    - Chronicler does NOT import `NarratorVoiceRubric` (that TypedDict was retired by the Plan 16-05 schema-alignment revision).
    - `WINNER_AUTHORITY_PREAMBLE` is a module-level constant in chronicler.py.
    - `_build_system_prompt(narrator)` composes the system message per D-10 structure.
    - `_personalize_universal_core` substitutes `narrator['name']` (NOT `narrator['displayName']`) at the leading sentence.
    - `voiceRubric` is consumed as a plain `str` via `narrator.get("voiceRubric") or ""` — same canonical pattern as Plan 16-07. There is NO `_render_voice_rubric` helper.
    - `WINNER AUTHORITY` does NOT appear in voice.py (B1 cross-check).
    - All chronicler narrator tests pass.
    - Phase 14 chronicler tests still pass under narrator=jesse.
  </done>
</task>

</tasks>

<verification>
- `grep -c "WINNER AUTHORITY" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` returns >=1.
- `grep -c "WINNER AUTHORITY" packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` returns 0.
- `grep -E "narrator\[.displayName.\]" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` returns NO matches (schema-alignment guard).
- `grep -E "_render_voice_rubric|NarratorVoiceRubric" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` returns NO matches (schema-alignment guard).
- `grep -E "rubric_str\s*=\s*narrator\.get\([\"\\']voiceRubric" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` returns a match (canonical pattern aligned with Plan 16-07).
- `uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler.py::test_narrator_voice_propagation -v` exits 0.
- Pipeline-wide test count is >= Phase 14 baseline + Phase 16 additions.
</verification>

<success_criteria>
- Chronicler is narrator-aware (NRR-02).
- WINNER AUTHORITY lives in chronicler.py exclusively (D-04 caveat enforced).
- Jesse narrator path is byte-equivalent to Phase 14 chronicler modulo the new WINNER AUTHORITY line (Research §G accepts this delta).
- No leakage of narrator-aware behaviour to other agents (NRR-06).
- Schema alignment with Plan 16-01 (Sanity narratorProfile) + Plan 16-05 (Narrator TypedDict) + Plan 16-07 (QA judge voiceRubric handling): the chronicler reads `narrator['name']` and treats `voiceRubric` as a plain str, matching the canonical surface used everywhere else.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-06-chronicler-narrator-SUMMARY.md`. Record:
- The final system prompt template used.
- The grep cross-check results (WINNER AUTHORITY count in chronicler.py and voice.py).
- Confirmation that schema alignment with Plans 16-01 / 16-05 / 16-07 holds: `narrator['name']` (not `displayName`); `voiceRubric` consumed as plain str via `narrator.get("voiceRubric") or ""` (same pattern as Plan 16-07).
- Cross-reference to 16-04 (UNIVERSAL_CORE source) and 16-07 (canonical voiceRubric pattern).
</output>
</content>
