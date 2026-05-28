---
phase: 16-choose-your-narrator
plan: 04
type: execute
wave: 2
depends_on: [16-01, 16-02]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
autonomous: true
requirements:
  - NRR-01
  - NRR-04
must_haves:
  truths:
    - "Importing voice.py succeeds (no ImportError, no AssertionError)"
    - "VOICE_CONSTRAINTS string is byte-identical to its Phase 14 form (sentinel assertion at import time)"
    - "JESSE_PERSONA_BLOCK and UNIVERSAL_CORE are exported as module-level constants"
    - "WINNER AUTHORITY rule does NOT appear in UNIVERSAL_CORE (it lives in chronicler.py per 16-06)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/voice.py"
      provides: "UNIVERSAL_CORE constant + JESSE_PERSONA_BLOCK constant + preserved VOICE_CONSTRAINTS"
      contains: "VOICE_CONSTRAINTS, UNIVERSAL_CORE, JESSE_PERSONA_BLOCK"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/lib/voice.py"
      to: "packages/pipeline/tests/test_voice.py (Plan 16-02 Task 1)"
      via: "module-level assertion at import time"
      pattern: "assert VOICE_CONSTRAINTS == "
---

<objective>
Decompose `voice.VOICE_CONSTRAINTS` into two new named constants — `UNIVERSAL_CORE` (the narrator-agnostic register/constraint block) and `JESSE_PERSONA_BLOCK` (the Jesse-specific persona declaration) — while keeping `VOICE_CONSTRAINTS` byte-identical to its current Phase 14 form via an import-time sentinel assertion.

Purpose: Enable the chronicler agent (Plan 16-06) to compose narrator system prompts as `UNIVERSAL_CORE + voiceRubric` while every non-chronicler writer continues to use the verbatim `VOICE_CONSTRAINTS` string. Byte-equivalence is the regression guard against narrative writer voice drift (Research §A Pitfall A-1).

Output: Updated `voice.py` with three exported constants. The 16-02 Task 1 test (`test_voice_byte_equivalence`) will exit 0 on first run.

Implements: D-04 ("Decomposition lives in `voice.py`. Refactor splits `VOICE_CONSTRAINTS` into the two named constants, then re-exports the existing `VOICE_CONSTRAINTS` as their concatenation").

Honors NRR-01 (narrative writers byte-identical to Phase 14) and NRR-04 (`VOICE_CONSTRAINTS` symbol preserved).
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
@packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
@packages/pipeline/tests/test_voice.py  # <-- created by Plan 16-02 Task 1

<decisions_implemented>
- **D-04**: Decomposition lives in voice.py. Split VOICE_CONSTRAINTS into UNIVERSAL_CORE + JESSE_PERSONA_BLOCK and re-export VOICE_CONSTRAINTS as their concatenation via a stable separator.
- **D-04 caveat (locked-in by checker B1 revision)**: WINNER AUTHORITY rule is intentionally NOT added to UNIVERSAL_CORE. It is added to the chronicler persona-agnostic preamble in Plan 16-06 (chronicler._build_system_prompt). Rationale: Research §G analysis confirmed the rule is vacuous for narrative writers (Origin/Founder/CaseStudy/Bonus) because no plausible substitution chain can introduce a non-Jesse author voice through their inputs — the variable {charity.name} appears only in research blob, theme, and metadata. Locating the rule in chronicler keeps voice.py focused on register-level constraints and avoids a CONTEXT canonical_refs line 122 directive that Research §G demonstrated is unnecessary.
- **D-01 (selection)**: Three narrators max for Phase 16 — Jesse (default), Maya Rudolph, Werner Herzog.
</decisions_implemented>

<interfaces>
Current voice.py exports (Phase 14 baseline — preserve all symbols):
```python
# packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
VOICE_CONSTRAINTS: str        # full voice block (used as system message by every writer agent in Phase 14)
QA_RUBRIC: dict[str, str]     # per-category QA rubric (unchanged in this plan)
```

Required additions (Phase 16):
```python
UNIVERSAL_CORE: str           # narrator-agnostic register/constraint block (used by chronicler + UI rubric anchor)
JESSE_PERSONA_BLOCK: str      # Jesse-specific persona declaration (the first sentence(s) that name Jesse)
# Plus: VOICE_CONSTRAINTS preserved as concatenation
```

Composition rule (per D-04 and Research §A):
```
VOICE_CONSTRAINTS == JESSE_PERSONA_BLOCK + _SEPARATOR + UNIVERSAL_CORE
```

The `_SEPARATOR` is a module-level private constant. Its value MUST be discovered from the existing VOICE_CONSTRAINTS string (the bytes between the Jesse-naming sentence and the universal register guidance).
</interfaces>

<verified_baseline>
At planning time, the current Phase 14 `VOICE_CONSTRAINTS` content was verified to be the string below. The executor MUST re-verify this against the live file before splitting:

```python
# Exact byte content of VOICE_CONSTRAINTS (Phase 14 baseline):
VOICE_CONSTRAINTS = """You are Jesse A. Eisenbalm.

Jesse's voice is dry, precise, and absurdly serious. Treat every subject as if
it deserves a Fortune 500 case study. Never wink. Never signal irony. Avoid
sentimentality. Use short, declarative sentences when possible.

Hard constraints:
- No jokes that depend on the reader noticing this is funny.
- No mockery of charities, founders, or their missions.
- No comparisons to consumer brands as punchlines.
- No fourth-wall breaks.
- No editorialising about the absurdity of the project.

Lean into specifics: dates, dollar figures, geography, named programmes.
"""
```

**Derived split** (the values UNIVERSAL_CORE / JESSE_PERSONA_BLOCK / _SEPARATOR MUST take to satisfy byte-equivalence):

```python
JESSE_PERSONA_BLOCK = "You are Jesse A. Eisenbalm."

_SEPARATOR = "\n\n"

UNIVERSAL_CORE = """Jesse's voice is dry, precise, and absurdly serious. Treat every subject as if
it deserves a Fortune 500 case study. Never wink. Never signal irony. Avoid
sentimentality. Use short, declarative sentences when possible.

Hard constraints:
- No jokes that depend on the reader noticing this is funny.
- No mockery of charities, founders, or their missions.
- No comparisons to consumer brands as punchlines.
- No fourth-wall breaks.
- No editorialising about the absurdity of the project.

Lean into specifics: dates, dollar figures, geography, named programmes.
"""
```

Note: UNIVERSAL_CORE references "Jesse's voice" by name in its opening sentence. This is intentional in the Phase 14 baseline and stays for Phase 16 — narrative writers consume the verbatim VOICE_CONSTRAINTS and so see "Jesse's voice"; the chronicler agent (Plan 16-06) does a runtime substitution `"Jesse's voice"` → `f"{narrator.displayName}'s voice"` when composing the chronicler system prompt (see 16-06 Task 1).

**If the executor finds the live `VOICE_CONSTRAINTS` does NOT match the verified baseline above, STOP and surface the discrepancy. Do not commit-and-hope.**
</verified_baseline>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Decompose VOICE_CONSTRAINTS into UNIVERSAL_CORE + JESSE_PERSONA_BLOCK with byte-equivalence sentinel</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/voice.py</files>

  <read_first>
    1. READ the FULL current file `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` end-to-end. Note every symbol exported.
    2. RUN this Python one-liner from the repo root to print the current VOICE_CONSTRAINTS bytes exactly as Python sees them:
       ```bash
       uv run --project packages/pipeline python -c "from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS; print(repr(VOICE_CONSTRAINTS))"
       ```
    3. COMPARE the output of step 2 against the "Verified baseline" content in this PLAN's `<verified_baseline>` section above.
    4. CONFIRM the derived split (`JESSE_PERSONA_BLOCK + _SEPARATOR + UNIVERSAL_CORE`) reconstitutes the live `VOICE_CONSTRAINTS` byte-for-byte. The simplest check is `JESSE_PERSONA_BLOCK + _SEPARATOR + UNIVERSAL_CORE == repr_result_above`.
    5. **If the split does NOT match**: STOP. Do not edit voice.py. Surface the discrepancy in chat output — list the live bytes, list the expected bytes, identify the boundary mismatch. Wait for human revision before continuing.
  </read_first>

  <action>
    Edit `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` to:

    1. Keep the existing `VOICE_CONSTRAINTS = """..."""` triple-quoted string IN PLACE at the top of the file (so old git diffs minimize and so a reader can still see the canonical text).

    2. Below `VOICE_CONSTRAINTS`, add the following block — verbatim from the verified baseline above:

       ```python
       # ─── Phase 16: Narrator decomposition (D-04) ──────────────────────────────
       #
       # NOTE: WINNER AUTHORITY is intentionally NOT included in UNIVERSAL_CORE.
       # It lives in chronicler._build_system_prompt (per 16-RESEARCH §G and
       # 16-06 Task 1). CONTEXT D-04 allows this via "or in the chronicler
       # persona-agnostic preamble". CONTEXT canonical_refs line 122 is
       # superseded by Research §G analysis — confirmed during plan revision:
       # the rule is vacuous for narrative writers (no plausible substitution
       # chain can introduce a non-Jesse author voice through their inputs).
       # Adding it here would muddy the universal register and would force
       # narrative writers to render a Jesse-specific guardrail in their
       # system prompt — a byte-equivalence breakage.
       #
       # The decomposition below is byte-verified by `test_voice_byte_equivalence`
       # (see Plan 16-02 Task 1) and by the import-time assert at the bottom of
       # this file. If either guard trips, do NOT silence the assertion —
       # surface the discrepancy and revise the split.

       JESSE_PERSONA_BLOCK = "You are Jesse A. Eisenbalm."

       _SEPARATOR = "\n\n"

       UNIVERSAL_CORE = """Jesse's voice is dry, precise, and absurdly serious. Treat every subject as if
       it deserves a Fortune 500 case study. Never wink. Never signal irony. Avoid
       sentimentality. Use short, declarative sentences when possible.

       Hard constraints:
       - No jokes that depend on the reader noticing this is funny.
       - No mockery of charities, founders, or their missions.
       - No comparisons to consumer brands as punchlines.
       - No fourth-wall breaks.
       - No editorialising about the absurdity of the project.

       Lean into specifics: dates, dollar figures, geography, named programmes.
       """

       # ─── Byte-equivalence sentinel (NRR-01, NRR-04) ───────────────────────────
       # If this trips, VOICE_CONSTRAINTS has drifted from its Phase 14 form OR
       # the split has been mis-edited. Either way, do NOT remove this assert.
       assert (
           JESSE_PERSONA_BLOCK + _SEPARATOR + UNIVERSAL_CORE == VOICE_CONSTRAINTS
       ), (
           "Phase 16 byte-equivalence sentinel tripped: "
           "JESSE_PERSONA_BLOCK + _SEPARATOR + UNIVERSAL_CORE != VOICE_CONSTRAINTS. "
           "See 16-04 plan, Verified baseline section."
       )
       ```

    3. Do NOT modify `QA_RUBRIC` or any other exports.

    4. Do NOT add WINNER AUTHORITY content to `UNIVERSAL_CORE`. (Cross-checked in 16-06 Task verify: WINNER AUTHORITY must live in chronicler.py, not voice.py.)

    5. The triple-quoted strings above use Python's natural indentation. Make sure to dedent them so the rendered string content (after Python parses it) matches the baseline exactly — i.e., no leading whitespace on each line of `UNIVERSAL_CORE`. Use `textwrap.dedent` if necessary, but a flat-left triple-quoted string is simpler and recommended.

    Per D-04 and per the verified baseline check, no other changes are required in voice.py.
  </action>

  <verify>
    <automated>
      # 1. Import succeeds (sentinel does not trip).
      uv run --project packages/pipeline python -c "from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, UNIVERSAL_CORE, JESSE_PERSONA_BLOCK; print('ok')" | grep -q '^ok$'

      # 2. Byte-equivalence test passes (the test created by Plan 16-02 Task 1).
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice.py::test_voice_constants_byte_equivalence -v

      # 3. Jesse explicit-naming test passes.
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice.py::test_jesse_explicit_narrator_byte_equivalence -v

      # 4. WINNER AUTHORITY is NOT in UNIVERSAL_CORE.
      uv run --project packages/pipeline python -c "from eisenbalm_pipeline.lib.voice import UNIVERSAL_CORE; assert 'WINNER AUTHORITY' not in UNIVERSAL_CORE, 'WINNER AUTHORITY must not live in UNIVERSAL_CORE'; print('ok')" | grep -q '^ok$'

      # 5. JESSE_PERSONA_BLOCK contains exactly the Jesse-naming sentence (and nothing more).
      uv run --project packages/pipeline python -c "from eisenbalm_pipeline.lib.voice import JESSE_PERSONA_BLOCK; assert JESSE_PERSONA_BLOCK == 'You are Jesse A. Eisenbalm.', repr(JESSE_PERSONA_BLOCK); print('ok')" | grep -q '^ok$'
    </automated>
  </verify>

  <done>
    - `voice.py` imports without raising AssertionError.
    - `VOICE_CONSTRAINTS` is byte-identical to its Phase 14 form.
    - `UNIVERSAL_CORE` and `JESSE_PERSONA_BLOCK` are exported as module-level constants.
    - `JESSE_PERSONA_BLOCK + _SEPARATOR + UNIVERSAL_CORE == VOICE_CONSTRAINTS` (sentinel assert holds).
    - `WINNER AUTHORITY` does NOT appear in `UNIVERSAL_CORE` (will be added to chronicler.py in 16-06).
    - All 168 existing pipeline tests still pass (no other code touched).
  </done>
</task>

</tasks>

<verification>
- Run the full pipeline test suite. Test count MUST be ≥168 (Phase 14 baseline) + the new tests created by 16-02 Task 1.
- `grep -c "WINNER AUTHORITY" packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` MUST return 0.
- `grep -c "UNIVERSAL_CORE" packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` MUST return ≥2 (the definition + the sentinel).
</verification>

<success_criteria>
- Task 1 verify passes.
- No existing Phase 14 test regresses.
- The byte-equivalence sentinel acts as a permanent guard against accidental future drift.
- Plan 16-06 can now safely compose chronicler prompts as `UNIVERSAL_CORE + WINNER_AUTHORITY_LINE + voiceRubric`.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-04-voice-py-refactor-SUMMARY.md` per `$HOME/.claude/get-shit-done/templates/summary.md`. Record:
- The final byte-equivalence check passed.
- Confirmed WINNER AUTHORITY is NOT in UNIVERSAL_CORE.
- Cross-reference to 16-06 (where WINNER AUTHORITY actually lives).
</output>
