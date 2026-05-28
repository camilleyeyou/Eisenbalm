---
phase: 16-choose-your-narrator
plan: 04
type: execute
wave: 1
depends_on: ["16-01", "16-02"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
autonomous: true
requirements: [NRR-03, NRR-10]
must_haves:
  truths:
    - "lib/voice.py exports UNIVERSAL_CORE: str, JESSE_PERSONA_BLOCK: str, VOICE_CONSTRAINTS: str (literal concatenation), assemble_voice(narrator: Optional[dict]) -> str"
    - "VOICE_CONSTRAINTS == UNIVERSAL_CORE + separator + JESSE_PERSONA_BLOCK is asserted at import time and the byte-equivalence pytest test_voice_constants_byte_equivalence passes"
    - "build_section_writer_prompt signature is UNCHANGED — back-compat preserved for Game agent direct import path (CONTEXT D-07)"
    - "Game agent (agents/game.py line 21 `from ... import VOICE_CONSTRAINTS`) continues to import VOICE_CONSTRAINTS as the literal Jesse string with NO code change to game.py"
    - "Calibrator's direct `from ... import VOICE_CONSTRAINTS` at line 27 continues to resolve (back-compat — Plan 16-05 adds `assemble_voice` to the same import)"
    - "assemble_voice(None) returns VOICE_CONSTRAINTS byte-equivalently; assemble_voice({voiceConstraints: JESSE_PERSONA_BLOCK, active: True}) returns VOICE_CONSTRAINTS byte-equivalently (D-13)"
    - "UNIVERSAL_CORE contains: DEL-04 no-AI rule + Fortune-500 gravity + forbidden words list (sentimentality + adjectives-as-compliments + passive hedging) + no-exclamation rule (CONTEXT D-02 four rule groups)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/voice.py"
      provides: "Two-tier voice surface: UNIVERSAL_CORE + JESSE_PERSONA_BLOCK + assemble_voice() with import-time byte-equivalence assertion"
      contains: "def assemble_voice"
  key_links:
    - from: "lib/voice.py VOICE_CONSTRAINTS"
      to: "agents/game.py line 21 + agents/calibrator.py line 27 + agents/chronicler.py line 33"
      via: "literal-concat back-compat preserves direct import path"
      pattern: "from eisenbalm_pipeline.lib.voice import"
    - from: "lib/voice.py assemble_voice"
      to: "agents/calibrator.py (Plan 16-05 consumes)"
      via: "single new helper imported alongside VOICE_CONSTRAINTS"
      pattern: "assemble_voice"
---

<objective>
Implement the two-tier voice split in lib/voice.py per CONTEXT D-01/D-02/D-07 and RESEARCH §A. Turn the byte-equivalence Wave 0 RED tests (test_voice.py from Plan 16-02) GREEN.

This plan is intentionally tiny and surgical — one file, one byte-equivalence invariant, one new helper. The risk is that the UNIVERSAL_CORE + JESSE_PERSONA_BLOCK split breaks byte-equivalence (Pitfall A-1/A-2). The mitigation is twofold: an import-time assertion against the original literal string, AND the pytest test_voice_constants_byte_equivalence from Plan 16-02.

This plan does NOT touch any agent file. Plan 16-05 wires the Calibrator + the 4 writer call sites. Plan 16-06 wires the Chronicler. Plan 16-07 wires the QA judge.

Output: extended lib/voice.py + green byte-equivalence tests + green Phase 14 baseline (168 pipeline pytest).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
@.planning/phases/16-choose-your-narrator/16-VALIDATION.md

<interfaces>
<!-- Contract this plan ships. Plans 16-05, 16-06, 16-07 consume directly. -->

```python
# packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
UNIVERSAL_CORE: str          # The four hard-rule groups from CONTEXT D-02
JESSE_PERSONA_BLOCK: str     # Jesse register lines: "Dry, precise, absurdly serious. No winking. No irony signaling."
VOICE_CONSTRAINTS: str       # = UNIVERSAL_CORE + separator + JESSE_PERSONA_BLOCK (byte-equal to current literal)

def assemble_voice(narrator: Optional[dict]) -> str:
    """Return UNIVERSAL_CORE + separator + persona_block.
    
    persona_block = narrator['voiceConstraints'] if narrator and narrator.get('active', True)
                    else JESSE_PERSONA_BLOCK
    """
```

Import-time invariant: `assert VOICE_CONSTRAINTS == _ORIGINAL_VOICE_CONSTRAINTS`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Refactor lib/voice.py — extract UNIVERSAL_CORE + JESSE_PERSONA_BLOCK + add assemble_voice() with byte-equivalence assertion</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/voice.py</files>
  <behavior>
    - VOICE_CONSTRAINTS string at module level remains byte-equivalent to the current literal (today's lines 18-34 verbatim concatenation result)
    - UNIVERSAL_CORE contains the four D-02 rule groups: (1) DEL-04 no-AI / Jesse-born-AI; (2) Fortune-500 gravity for charity + founder; (3) forbidden sentimentality words + forbidden adjectives-as-compliments + passive hedging; (4) no exclamation marks
    - JESSE_PERSONA_BLOCK contains Jesse's register lines: "Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking. No irony signaling. The brand does not pivot to AI." (the persona marker — Research §Open Question 1 resolves this as JESSE_PERSONA_BLOCK)
    - assemble_voice(None) == VOICE_CONSTRAINTS (byte-equal)
    - assemble_voice({'voiceConstraints': JESSE_PERSONA_BLOCK, 'active': True}) == VOICE_CONSTRAINTS (byte-equal — D-13 sentinel)
    - assemble_voice({'voiceConstraints': 'SENTINEL_BLOCK', 'active': True}) contains 'SENTINEL_BLOCK' AND does NOT contain JESSE_PERSONA_BLOCK
    - assemble_voice({'voiceConstraints': 'SENTINEL_BLOCK', 'active': False}) returns VOICE_CONSTRAINTS (inactive narrator handled here as a defensive belt-and-braces — actual fallback + warning emission is at the Calibrator per D-14)
    - Import-time assertion catches a future drift between UNIVERSAL_CORE+separator+JESSE_PERSONA_BLOCK and the original literal
  </behavior>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py FULL FILE (current 110 lines — preserve build_section_writer_prompt verbatim; only edit the constant assembly + add assemble_voice)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §A (byte-equivalence: Pitfall A-1 separator must match natural line break; Pitfall A-2 trailing-space invisibility; recommended pattern with _ORIGINAL_VOICE_CONSTRAINTS literal + assert)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-02 (the four UNIVERSAL_CORE rule groups) + D-07 (preserve VOICE_CONSTRAINTS as literal concat for back-compat with Game agent direct import)
    - packages/pipeline/tests/test_voice.py (the RED tests this task turns green — confirms which symbols must export: UNIVERSAL_CORE, JESSE_PERSONA_BLOCK, VOICE_CONSTRAINTS, assemble_voice)
    - packages/pipeline/src/eisenbalm_pipeline/agents/game.py line 21 (confirms VOICE_CONSTRAINTS direct import must keep resolving — Game stays Jesse, untouched)
    - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py line 27 (confirms VOICE_CONSTRAINTS direct import must keep resolving — Plan 16-05 adds assemble_voice to the import on the same line)
    - packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py line 33 (confirms VOICE_CONSTRAINTS direct import must keep resolving — Plan 16-06 may keep this import as a defensive fallback default)
  </read_first>
  <action>
Edit packages/pipeline/src/eisenbalm_pipeline/lib/voice.py. Preserve the module docstring (lines 1-13), the `from __future__ import annotations`, and `build_section_writer_prompt` (lines 37-109) verbatim. Replace ONLY the VOICE_CONSTRAINTS block at lines 18-34 with the two-tier split + assemble_voice helper.

The exact replacement block:

```python
from typing import Any, Optional

# ── Phase 16: Two-tier voice surface (NRR-03, CONTEXT D-01/D-02/D-07) ────────
# UNIVERSAL_CORE applies to every narrator including Jesse — these are HARD
# RULES that no narrator profile can override. JESSE_PERSONA_BLOCK is the
# default register block; narratorProfile.voiceConstraints replaces this block
# when a narrator is set on weeklyIssue.

UNIVERSAL_CORE = (
    "Treat every charity with the gravity of a Fortune 500 company.\n"
    "Treat every founder as a visionary regardless of obscurity.\n"
    "Never use exclamation marks. Never use: heartwarming, inspiring, "
    "incredible, amazing, truly, simply, journey of, passion, transformative, "
    "empowering, life-changing, remarkable, humbling, beautiful work.\n"
    "Never use winking constructions: \"if you can call it that\", "
    "\"believe it or not\", \"of sorts\", \"for lack of a better word\", "
    "\"so to speak\", \"as they say\".\n"
    "Never reference AI, language models, or Jesse's AI nature. "
    "Jesse was born AI. This is not a gimmick.\n"
    "Answer the implied question \"Why do you deserve to exist?\" without sentiment.\n"
    "Adjectives that are also compliments (impressive, wonderful, great) are forbidden.\n"
    "Passive hedging (might be, could perhaps, seems to) is forbidden."
)

# Jesse's persona register — the narrator-controlled block in the two-tier model.
# A non-Jesse narratorProfile.voiceConstraints replaces this string at assembly
# time (lib/voice.assemble_voice). The persona marker line ("Jesse Eisenbalm
# voice...") is here because it is register, not a rule — the persona statement
# of who is speaking.
JESSE_PERSONA_BLOCK = (
    "Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking. "
    "No irony signaling. The brand does not pivot to AI."
)

# Separator placement preserves byte-equivalence with the original
# VOICE_CONSTRAINTS literal (lines 18-34 of the pre-Phase-16 file). The
# original begins with the Jesse persona line followed by "\n" then the
# universal rules; the assembled form is JESSE_PERSONA_BLOCK + "\n" + UNIVERSAL_CORE.
# This separator was verified by reading the pre-Phase-16 string character
# sequence per 16-RESEARCH §A Pitfall A-1.
_SEPARATOR = "\n"

VOICE_CONSTRAINTS = JESSE_PERSONA_BLOCK + _SEPARATOR + UNIVERSAL_CORE

# Byte-equivalence invariant. The original literal string from the pre-Phase-16
# file is reproduced verbatim below; the assembly above MUST equal it byte-for-
# byte. If this assertion fires at import time, the split has diverged — fix
# the separator, trailing whitespace, or persona/core boundary per 16-RESEARCH
# Pitfall A-1/A-2 before shipping.
_ORIGINAL_VOICE_CONSTRAINTS = (
    "Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking. "
    "No irony signaling. The brand does not pivot to AI.\n"
    "Treat every charity with the gravity of a Fortune 500 company.\n"
    "Treat every founder as a visionary regardless of obscurity.\n"
    "Never use exclamation marks. Never use: heartwarming, inspiring, "
    "incredible, amazing, truly, simply, journey of, passion, transformative, "
    "empowering, life-changing, remarkable, humbling, beautiful work.\n"
    "Never use winking constructions: \"if you can call it that\", "
    "\"believe it or not\", \"of sorts\", \"for lack of a better word\", "
    "\"so to speak\", \"as they say\".\n"
    "Never reference AI, language models, or Jesse's AI nature. "
    "Jesse was born AI. This is not a gimmick.\n"
    "Answer the implied question \"Why do you deserve to exist?\" without sentiment.\n"
    "Adjectives that are also compliments (impressive, wonderful, great) are forbidden.\n"
    "Passive hedging (might be, could perhaps, seems to) is forbidden."
)

assert VOICE_CONSTRAINTS == _ORIGINAL_VOICE_CONSTRAINTS, (
    "lib.voice byte-equivalence broken: "
    "JESSE_PERSONA_BLOCK + '\\n' + UNIVERSAL_CORE does not equal the original "
    "VOICE_CONSTRAINTS literal. Inspect the separator + trailing whitespace + "
    "rule ordering per 16-RESEARCH §A Pitfall A-1/A-2 before shipping."
)


def assemble_voice(narrator: Optional[dict]) -> str:
    """Return the assembled voice string for the given narrator (Phase 16 NRR-03).

    Args:
        narrator: loaded NarratorProfile dict from Sanity
            ({name, slug, voiceConstraints, voiceRubric, exampleSamples, active})
            or None (default Jesse).

    Returns:
        JESSE_PERSONA_BLOCK + _SEPARATOR + UNIVERSAL_CORE when narrator is None
        or inactive (D-14 defensive fallback — Calibrator emits the warning event).
        Otherwise narrator['voiceConstraints'] + _SEPARATOR + UNIVERSAL_CORE.

    Invariants (locked by tests/test_voice.py):
        assemble_voice(None) == VOICE_CONSTRAINTS
        assemble_voice({'voiceConstraints': JESSE_PERSONA_BLOCK, 'active': True}) == VOICE_CONSTRAINTS  # D-13
    """
    if narrator is None or not narrator.get("active", True):
        return VOICE_CONSTRAINTS
    persona = narrator.get("voiceConstraints") or JESSE_PERSONA_BLOCK
    return persona + _SEPARATOR + UNIVERSAL_CORE
```

Add `from typing import Optional` to the existing `from typing import Any` import line (line 16: change to `from typing import Any, Optional`). Leave `build_section_writer_prompt` (current lines 37-109) completely unchanged — its existing `voice_constraints: str = VOICE_CONSTRAINTS` default reference resolves to the new VOICE_CONSTRAINTS literal-concat result.
  </action>
  <verify>
    <automated>uv run --project packages/pipeline python -c "from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, UNIVERSAL_CORE, JESSE_PERSONA_BLOCK, assemble_voice; assert assemble_voice(None) == VOICE_CONSTRAINTS; assert assemble_voice({'voiceConstraints': JESSE_PERSONA_BLOCK, 'active': True}) == VOICE_CONSTRAINTS; print('OK')" prints 'OK'; uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice.py -q exits 0 (all 4 tests GREEN); uv run --project packages/pipeline pytest packages/pipeline/tests/ -x -q exits 0 (full 168+ suite stays green — back-compat preserved for game.py + calibrator.py + chronicler.py direct VOICE_CONSTRAINTS imports)</automated>
  </verify>
  <done>lib/voice.py has UNIVERSAL_CORE + JESSE_PERSONA_BLOCK + VOICE_CONSTRAINTS (literal concat) + assemble_voice + import-time byte-equivalence assertion. test_voice.py 4 tests green. Full pipeline pytest suite still green. game.py / calibrator.py / chronicler.py imports unchanged at byte level.</done>
</task>

</tasks>

<verification>
- test_voice.py 4 tests GREEN under `uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice.py -q`.
- Full pipeline pytest suite stays GREEN (168 + new Phase 16 tests; the still-RED Phase 16 tests stay skip-guarded until their implementing plans land).
- Game agent (agents/game.py) continues to work without modification — verified by `uv run --project packages/pipeline python -c "from eisenbalm_pipeline.agents.game import VOICE_CONSTRAINTS"` succeeding.
- Calibrator + Chronicler imports remain valid — verified by full pipeline pytest still passing.
</verification>

<success_criteria>
- byte-equivalence invariant holds at import time AND in pytest.
- NRR-03 (Calibrator unset = byte-equivalent Jesse) and NRR-10 (zero-regression) gates closed for the voice surface.
- All Phase 5 / 13 / 14 / 15 tripwires stay green.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-04-SUMMARY.md` documenting: the exact separator used + rationale (JESSE_PERSONA_BLOCK first, then "\n", then UNIVERSAL_CORE), the import-time assertion location, confirmation that build_section_writer_prompt body is untouched, full pipeline pytest result count.
</output>
