---
phase: 16-choose-your-narrator
plan: 02
type: execute
wave: 0
depends_on: ["16-01"]
files_modified:
  - packages/pipeline/tests/test_voice.py
  - packages/pipeline/tests/test_narrator_seed_sentinel.py
  - packages/pipeline/tests/test_narrator_cost_budget.py
  - packages/pipeline/tests/test_calibrator_narrator.py
  - packages/pipeline/tests/test_section_writer_voice_propagation.py
  - packages/pipeline/tests/test_qa_judge_narrator.py
  - packages/pipeline/tests/test_chronicler.py
autonomous: true
requirements: [NRR-03, NRR-04, NRR-05, NRR-06, NRR-09, NRR-10]
must_haves:
  truths:
    - "6 new pytest files + 1 extended pytest file exist under packages/pipeline/tests/ encoding NRR-03 through NRR-06, NRR-09, NRR-10 contracts as RED tests"
    - "All test files collect cleanly — `uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice.py tests/test_narrator_seed_sentinel.py tests/test_narrator_cost_budget.py tests/test_calibrator_narrator.py tests/test_section_writer_voice_propagation.py tests/test_qa_judge_narrator.py tests/test_chronicler.py --collect-only` exits 0"
    - "All new Phase 16 tests are RED (xfail or fail or skip-guarded on ImportError) until their corresponding Wave 1 plan turns them green — they do NOT yet assert against not-yet-existing modules in a way that breaks collection"
    - "test_chronicler.py extension adds test_narrator_voice_propagation that asserts chronicler reads style_brief['voice'] (NOT direct VOICE_CONSTRAINTS import) — fails today, green after Plan 16-06"
    - "The existing 168-passing pipeline pytest suite (Phase 14 baseline) stays green: `uv run --project packages/pipeline pytest -x -q` exits 0 except for the new Phase 16 RED tests"
  artifacts:
    - path: "packages/pipeline/tests/test_voice.py"
      provides: "Byte-equivalence invariants — assemble_voice(None) == VOICE_CONSTRAINTS, jesse-explicit == VOICE_CONSTRAINTS"
      contains: "test_voice_constants_byte_equivalence"
    - path: "packages/pipeline/tests/test_narrator_seed_sentinel.py"
      provides: "Cross-language Jesse voiceConstraints check (narrators.json[jesse].voiceConstraints == JESSE_PERSONA_BLOCK)"
      contains: "test_jesse_seed_matches_persona_block"
    - path: "packages/pipeline/tests/test_narrator_cost_budget.py"
      provides: "Token count ratio assertion — assemble_voice(any_seeded_narrator) length ≤ 1.10 * VOICE_CONSTRAINTS length"
      contains: "test_cost_delta_within_10_percent"
    - path: "packages/pipeline/tests/test_calibrator_narrator.py"
      provides: "Calibrator merges narrator into StyleBrief; inactive narrator falls back to Jesse + emits warning event"
      contains: "test_inactive_narrator_falls_back_to_jesse_with_warning"
    - path: "packages/pipeline/tests/test_section_writer_voice_propagation.py"
      provides: "4 narrative writers pass voice_constraints=style_brief['voice'] to build_section_writer_prompt"
      contains: "test_origin_story_propagates_narrator_voice"
    - path: "packages/pipeline/tests/test_qa_judge_narrator.py"
      provides: "QA judge layers narrator.voiceRubric + exampleSamples at call time"
      contains: "test_judge_appends_narrator_rubric"
    - path: "packages/pipeline/tests/test_chronicler.py"
      provides: "Extended with test_narrator_voice_propagation — Chronicler reads style_brief['voice'], not direct VOICE_CONSTRAINTS"
      contains: "test_narrator_voice_propagation"
  key_links:
    - from: "packages/pipeline/tests/test_voice.py"
      to: "packages/pipeline/src/eisenbalm_pipeline/lib/voice.py (Plan 16-04 implements)"
      via: "import UNIVERSAL_CORE, JESSE_PERSONA_BLOCK, assemble_voice"
      pattern: "from eisenbalm_pipeline.lib.voice import"
    - from: "packages/pipeline/tests/test_narrator_seed_sentinel.py"
      to: "apps/studio/seeds/narrators.json (Plan 16-08 creates) + JESSE_PERSONA_BLOCK (Plan 16-04)"
      via: "cross-language byte equality check"
      pattern: "JESSE_PERSONA_BLOCK"
---

<objective>
RED-first test scaffold for the pipeline side of Phase 16. Encodes the verification contract for NRR-03 (byte-equivalence), NRR-04 (writer voice propagation), NRR-05 (chronicler voice consumption), NRR-06 (QA judge narrator-awareness), NRR-09 (seed sentinel), and NRR-10 (cost budget + zero-regression) BEFORE any implementation lands.

Per VALIDATION §Wave 0 Requirements, these test files MUST exist before Plan 16-04 (lib/voice.py refactor), Plan 16-05 (DispatchState + Calibrator), Plan 16-06 (Chronicler), Plan 16-07 (QA judge), or Plan 16-08 (seed) can be authored. The Nyquist rule is honored: every implementation task in Waves 1+ has its automated verification command already mapped to a file that exists at collection time.

This plan creates 6 new pytest files + extends 1 existing pytest file. All new tests are RED-guarded (skip-on-ImportError, xfail, or write a fail() body) so the existing 168-passing pipeline suite stays green at the Wave 0 commit.

Purpose: contract-first pytest scaffold the Wave 1 implementation plans turn green.
Output: 7 pytest files (6 new + 1 extended), all collecting cleanly.
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
<!-- Future shapes the tests assert against. Plans 16-04..16-08 implement these. -->

lib/voice.py exports (Plan 16-04 lands):
```python
UNIVERSAL_CORE: str            # Hard rules (4 groups: DEL-04, Fortune-500 gravity, forbidden words, no exclamation)
JESSE_PERSONA_BLOCK: str       # Jesse's register lines ("Dry, precise, absurdly serious. No winking. No irony signaling.")
VOICE_CONSTRAINTS: str         # Literal concatenation: UNIVERSAL_CORE + "\n\n" + JESSE_PERSONA_BLOCK (or whatever separator preserves byte-equivalence per Pitfall A-1)
def assemble_voice(narrator: Optional[dict]) -> str: ...
```

Calibrator narrator-awareness (Plan 16-05 lands):
- state['narrator'] consumed (loaded by lib/sanity_client at pipeline start)
- assemble_voice(narrator) result written to style_brief["voice"]
- if narrator.get('active') is False → fall back to Jesse + emit deliberationEvents.eventType='editor-decision' with payload {"warning": "inactive narrator <name> — fell back to Jesse"}

Section writers (Plan 16-05 also lands the 4 call-site kwarg additions per Pitfall 2):
- origin_story, problem, founder_bio, case_study each call build_section_writer_prompt with voice_constraints=style_brief.get("voice", VOICE_CONSTRAINTS)

Chronicler (Plan 16-06 lands):
- _build_system_prompt accepts voice_constraints: str kwarg
- chronicler() node body computes voice = state.get('style_brief', {}).get('voice', VOICE_CONSTRAINTS) and passes to _build_system_prompt

QA judge (Plan 16-07 lands):
- run_llm_judge accepts narrator: Optional[dict] = None kwarg
- when set, appends narrator.voiceRubric + exampleSamples[:3] to the rubric system message
- when unset, byte-equivalent to existing Phase 5 behavior

Seed (Plan 16-08 lands):
- apps/studio/seeds/narrators.json contains 3 entries: jesse, maya-rudolph, werner-herzog
- jesse.voiceConstraints == JESSE_PERSONA_BLOCK (cross-language sentinel)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create test_voice.py + test_narrator_seed_sentinel.py + test_narrator_cost_budget.py (3 byte/cost invariants)</name>
  <files>packages/pipeline/tests/test_voice.py, packages/pipeline/tests/test_narrator_seed_sentinel.py, packages/pipeline/tests/test_narrator_cost_budget.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py (current VOICE_CONSTRAINTS string verbatim — the byte-equivalence target)
    - packages/pipeline/tests/test_chronicler.py lines 1-40 (existing skip-on-ImportError guard pattern this plan mirrors)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §A (byte-equivalence invariant + Pitfall A-1/A-2 + assemble_voice signature)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §H (cost budget ratio calculation — ≤10% delta NRR-10 criterion 7)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md Pitfall 6 (cross-language Jesse seed sentinel: Python test reads narrators.json + imports JESSE_PERSONA_BLOCK)
    - .planning/phases/16-choose-your-narrator/16-VALIDATION.md §Wave 0 Requirements (these are the 3 of 14 Wave 0 gaps this task fills)
  </read_first>
  <action>
Create three pytest files. All use the import-time try/except guard pattern from test_chronicler.py so collection always succeeds even before Wave 1 implementation lands.

(A) packages/pipeline/tests/test_voice.py:

```python
"""Phase 16 Wave 0 — Voice byte-equivalence invariants (NRR-03, NRR-10).

These tests are the byte-equivalence gate for the lib/voice.py two-tier
split. They are RED until Plan 16-04 lands UNIVERSAL_CORE + JESSE_PERSONA_BLOCK
+ assemble_voice() such that:

    assemble_voice(None) == VOICE_CONSTRAINTS  (byte-equal to the current Jesse default)
    assemble_voice({'voiceConstraints': JESSE_PERSONA_BLOCK, 'active': True}) == VOICE_CONSTRAINTS

Pitfall A-1/A-2 (16-RESEARCH §A): the separator between UNIVERSAL_CORE and
JESSE_PERSONA_BLOCK and any trailing whitespace must produce byte-identical
output. Plan 16-04 ships an import-time assertion in lib/voice.py; this file
is the pytest-side guardian.
"""
from __future__ import annotations

import pytest

try:
    from eisenbalm_pipeline.lib.voice import (  # noqa: F401
        UNIVERSAL_CORE,
        JESSE_PERSONA_BLOCK,
        VOICE_CONSTRAINTS,
        assemble_voice,
    )
    PHASE_16_VOICE_AVAILABLE = True
except ImportError:
    PHASE_16_VOICE_AVAILABLE = False


pytestmark = pytest.mark.skipif(
    not PHASE_16_VOICE_AVAILABLE,
    reason="Phase 16 Plan 16-04 not yet landed — lib/voice.py two-tier split missing",
)


def test_voice_constants_byte_equivalence():
    """assemble_voice(None) MUST equal VOICE_CONSTRAINTS exactly (NRR-03, NRR-10)."""
    from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, assemble_voice
    assert assemble_voice(None) == VOICE_CONSTRAINTS, (
        "assemble_voice(None) diverged from VOICE_CONSTRAINTS. "
        "The UNIVERSAL_CORE + JESSE_PERSONA_BLOCK split has broken byte-equivalence. "
        "Inspect the separator and trailing whitespace per 16-RESEARCH Pitfall A-1/A-2."
    )


def test_jesse_explicit_narrator_byte_equivalence():
    """A narrator dict carrying JESSE_PERSONA_BLOCK as voiceConstraints MUST produce VOICE_CONSTRAINTS (D-13)."""
    from eisenbalm_pipeline.lib.voice import (
        VOICE_CONSTRAINTS,
        JESSE_PERSONA_BLOCK,
        assemble_voice,
    )
    jesse_explicit = {
        "name": "Jesse Eisenbalm",
        "slug": "jesse",
        "voiceConstraints": JESSE_PERSONA_BLOCK,
        "voiceRubric": "",
        "exampleSamples": [],
        "active": True,
    }
    assert assemble_voice(jesse_explicit) == VOICE_CONSTRAINTS, (
        "assemble_voice(jesse_explicit) diverged from VOICE_CONSTRAINTS. "
        "The seed sentinel (D-10) and the assembly function disagree."
    )


def test_universal_core_contains_dem_04_rule():
    """UNIVERSAL_CORE must include the no-AI-reference rule (DEL-04, CONTEXT D-02)."""
    from eisenbalm_pipeline.lib.voice import UNIVERSAL_CORE
    # The Phase 13 deliberation-no-model-names tripwire depends on this rule
    # surviving every narrator override.
    assert "AI" in UNIVERSAL_CORE or "language model" in UNIVERSAL_CORE.lower(), (
        "UNIVERSAL_CORE missing the DEL-04 no-AI-reference rule"
    )


def test_universal_core_contains_no_exclamation_rule():
    """UNIVERSAL_CORE must forbid exclamation marks (CONTEXT D-02 rule 4)."""
    from eisenbalm_pipeline.lib.voice import UNIVERSAL_CORE
    assert "exclamation" in UNIVERSAL_CORE.lower(), (
        "UNIVERSAL_CORE missing the no-exclamation-marks rule (D-02 rule 4)"
    )
```

(B) packages/pipeline/tests/test_narrator_seed_sentinel.py:

```python
"""Phase 16 Wave 0 — Cross-language seed sentinel (NRR-09).

The Jesse narratorProfile seeded in Sanity carries voiceConstraints as a
string. The Python pipeline carries JESSE_PERSONA_BLOCK as a string in
lib/voice.py. Both MUST match or the seed (D-10) and the code diverge.

This test reads apps/studio/seeds/narrators.json and asserts the jesse entry's
voiceConstraints equals JESSE_PERSONA_BLOCK after whitespace normalization.

RED until Plan 16-04 (JESSE_PERSONA_BLOCK) + Plan 16-08 (narrators.json) both
land.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest


try:
    from eisenbalm_pipeline.lib.voice import JESSE_PERSONA_BLOCK  # noqa: F401
    JESSE_PERSONA_AVAILABLE = True
except ImportError:
    JESSE_PERSONA_AVAILABLE = False


# Resolve seed file path relative to repo root.
# packages/pipeline/tests/test_narrator_seed_sentinel.py -> repo root is parents[3]
_REPO_ROOT = Path(__file__).resolve().parents[3]
_NARRATORS_JSON = _REPO_ROOT / "apps" / "studio" / "seeds" / "narrators.json"


@pytest.mark.skipif(
    not JESSE_PERSONA_AVAILABLE,
    reason="Plan 16-04 not yet landed — JESSE_PERSONA_BLOCK missing",
)
@pytest.mark.skipif(
    not _NARRATORS_JSON.exists(),
    reason="Plan 16-08 not yet landed — apps/studio/seeds/narrators.json missing",
)
def test_jesse_seed_matches_persona_block():
    """apps/studio/seeds/narrators.json[jesse].voiceConstraints MUST equal lib.voice.JESSE_PERSONA_BLOCK."""
    from eisenbalm_pipeline.lib.voice import JESSE_PERSONA_BLOCK

    data = json.loads(_NARRATORS_JSON.read_text(encoding="utf-8"))
    # Tolerant lookup: data may be a list of dicts (slug-keyed) or a dict keyed by slug.
    jesse_entry = None
    if isinstance(data, list):
        for entry in data:
            if isinstance(entry, dict) and entry.get("slug") == "jesse":
                jesse_entry = entry
                break
    elif isinstance(data, dict):
        jesse_entry = data.get("jesse")
    assert jesse_entry is not None, (
        f"No 'jesse' entry found in {_NARRATORS_JSON} — seed file must include the explicit default profile (D-10)"
    )

    seeded_voice = (jesse_entry.get("voiceConstraints") or "").strip()
    persona_block = JESSE_PERSONA_BLOCK.strip()
    assert seeded_voice == persona_block, (
        "narrators.json[jesse].voiceConstraints diverged from lib/voice.JESSE_PERSONA_BLOCK. "
        "Update narrators.json OR JESSE_PERSONA_BLOCK so they match (D-10 seed sentinel)."
    )
```

(C) packages/pipeline/tests/test_narrator_cost_budget.py:

```python
"""Phase 16 Wave 0 — Cost delta budget (NRR-10 criterion 7).

≤10% cost delta vs Jesse-default per CONTEXT D-12 + 16-RESEARCH §H.

Approximation: assert that the assembled voice string for any seeded
non-Jesse narrator is at most 1.10x the length of VOICE_CONSTRAINTS. This is
not a perfect cost measurement (token counting would require a tokenizer
dependency) but it is a tight upper bound on the prompt-prefix contribution
to per-call cost, which is what the narrator surface controls.

RED until Plan 16-04 (lib/voice.py) + Plan 16-08 (narrators.json seed) both
land.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest


try:
    from eisenbalm_pipeline.lib.voice import (  # noqa: F401
        VOICE_CONSTRAINTS,
        assemble_voice,
    )
    VOICE_AVAILABLE = True
except ImportError:
    VOICE_AVAILABLE = False


_REPO_ROOT = Path(__file__).resolve().parents[3]
_NARRATORS_JSON = _REPO_ROOT / "apps" / "studio" / "seeds" / "narrators.json"


def _seed_entries() -> list[dict]:
    if not _NARRATORS_JSON.exists():
        return []
    data = json.loads(_NARRATORS_JSON.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return list(data.values())
    return []


@pytest.mark.skipif(not VOICE_AVAILABLE, reason="Plan 16-04 not yet landed")
@pytest.mark.skipif(not _NARRATORS_JSON.exists(), reason="Plan 16-08 not yet landed")
@pytest.mark.parametrize(
    "narrator_slug",
    ["jesse", "maya-rudolph", "werner-herzog"],
)
def test_cost_delta_within_10_percent(narrator_slug: str):
    """assemble_voice(narrator).length must be ≤ 1.10 * VOICE_CONSTRAINTS.length for each seeded narrator."""
    from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, assemble_voice

    entries = _seed_entries()
    entry = next((e for e in entries if e.get("slug") == narrator_slug), None)
    if entry is None:
        pytest.skip(f"narrator '{narrator_slug}' not in seed file yet")

    baseline = len(VOICE_CONSTRAINTS)
    assembled = len(assemble_voice(entry))
    ratio = assembled / baseline if baseline else float("inf")
    assert ratio <= 1.10, (
        f"narrator '{narrator_slug}' assembled voice is {ratio:.2%} of Jesse baseline "
        f"({assembled} chars vs {baseline}); exceeds 10% budget (NRR-10 criterion 7)"
    )
```
  </action>
  <verify>
    <automated>test -f packages/pipeline/tests/test_voice.py packages/pipeline/tests/test_narrator_seed_sentinel.py packages/pipeline/tests/test_narrator_cost_budget.py; uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice.py packages/pipeline/tests/test_narrator_seed_sentinel.py packages/pipeline/tests/test_narrator_cost_budget.py --collect-only exits 0; uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice.py packages/pipeline/tests/test_narrator_seed_sentinel.py packages/pipeline/tests/test_narrator_cost_budget.py -q exits with all tests SKIPPED (Plans 16-04 + 16-08 not landed yet — expected RED state)</automated>
  </verify>
  <done>3 pytest files created with skip-on-ImportError + skip-on-missing-seed guards. Tests collect cleanly; current state is all-skipped (expected RED until Plans 16-04 + 16-08).</done>
</task>

<task type="auto">
  <name>Task 2: Create test_calibrator_narrator.py + test_section_writer_voice_propagation.py + test_qa_judge_narrator.py (3 wiring tests)</name>
  <files>packages/pipeline/tests/test_calibrator_narrator.py, packages/pipeline/tests/test_section_writer_voice_propagation.py, packages/pipeline/tests/test_qa_judge_narrator.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py lines 130-196 (current calibrator() node body — the function under test)
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py lines 48-86 (the build_section_writer_prompt call site shape — the writer voice propagation tests assert via patching this helper)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py lines 64-133 (run_llm_judge signature — tests assert the narrator kwarg is accepted)
    - packages/pipeline/tests/test_chronicler.py lines 1-50 (skip-on-ImportError pattern + minimal_state helper)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-05 (single injection point at Calibrator) + D-14 (inactive narrator + warning event)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §C (Calibrator wiring) + Pitfall 2 (writers MUST pass voice_constraints kwarg) + §D (QA per-call rubric load)
  </read_first>
  <action>
Create three pytest files. Each uses unittest.mock patching to assert wiring without requiring real LLM calls.

(A) packages/pipeline/tests/test_calibrator_narrator.py:

```python
"""Phase 16 Wave 0 — Calibrator narrator wiring (NRR-03).

Asserts:
  - calibrator() reads state['narrator'] and passes it to assemble_voice
  - style_brief['voice'] equals assemble_voice(narrator)
  - inactive narrator (active=False) falls back to Jesse AND emits a warning
    deliberationEvents event (D-14)
  - narrator=None → byte-equivalent Jesse behavior

RED until Plan 16-05 lands.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


try:
    from eisenbalm_pipeline.agents.calibrator import calibrator  # noqa: F401
    from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS  # noqa: F401
    CALIBRATOR_PHASE_16_AVAILABLE = True
except ImportError:
    CALIBRATOR_PHASE_16_AVAILABLE = False


pytestmark = pytest.mark.skipif(
    not CALIBRATOR_PHASE_16_AVAILABLE,
    reason="Plan 16-05 not yet landed — calibrator narrator wiring missing",
)


def _state(narrator: dict | None = None) -> dict:
    return {
        "run_id": "run-cal-test-001",
        "issue_number": 42,
        "publish_date": "2026-06-04",
        "narrator": narrator,
        "model_versions": {},
    }


@pytest.mark.asyncio
async def test_calibrator_uses_assemble_voice_with_narrator():
    """When state['narrator'] is set, calibrator MUST call assemble_voice(narrator) and put the result on style_brief['voice']."""
    from eisenbalm_pipeline.agents import calibrator as cal_mod
    herzog = {
        "name": "Werner Herzog",
        "slug": "werner-herzog",
        "voiceConstraints": "Speak with geological gravity. The sentences breathe.",
        "voiceRubric": "Reward geological-time metaphors.",
        "exampleSamples": ["Sample 1", "Sample 2", "Sample 3"],
        "active": True,
    }
    state = _state(narrator=herzog)

    # Stub LLM + Sanity round-trip so we can run the node in isolation.
    with patch.object(cal_mod, "_fetch_previous_bonus_types", new=AsyncMock(return_value=[])), \
         patch.object(cal_mod, "acomplete", new=AsyncMock(return_value=(None, {"resolved_model": "stub"}))):
        result = await cal_mod.calibrator(state)

    voice = result["style_brief"]["voice"]
    assert "geological gravity" in voice, (
        "Calibrator did not merge narrator.voiceConstraints into style_brief['voice']"
    )


@pytest.mark.asyncio
async def test_calibrator_narrator_none_byte_equivalent_to_jesse():
    """When narrator is None, style_brief['voice'] == VOICE_CONSTRAINTS (NRR-10)."""
    from eisenbalm_pipeline.agents import calibrator as cal_mod
    from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS

    state = _state(narrator=None)
    with patch.object(cal_mod, "_fetch_previous_bonus_types", new=AsyncMock(return_value=[])), \
         patch.object(cal_mod, "acomplete", new=AsyncMock(return_value=(None, {"resolved_model": "stub"}))):
        result = await cal_mod.calibrator(state)

    assert result["style_brief"]["voice"] == VOICE_CONSTRAINTS, (
        "Byte-equivalence regression: narrator=None should produce VOICE_CONSTRAINTS verbatim"
    )


@pytest.mark.asyncio
async def test_inactive_narrator_falls_back_to_jesse_with_warning():
    """active=False → fall back to Jesse + emit warning via existing editor-decision eventType (D-14)."""
    from eisenbalm_pipeline.agents import calibrator as cal_mod
    from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS

    parked = {
        "name": "Aaron Sorkin",
        "slug": "aaron-sorkin",
        "voiceConstraints": "Walk and talk.",
        "voiceRubric": "Reward stage directions.",
        "exampleSamples": [],
        "active": False,
    }
    state = _state(narrator=parked)

    warning_calls: list[dict] = []

    async def _capture_event(**kwargs):
        warning_calls.append(kwargs)

    with patch.object(cal_mod, "_fetch_previous_bonus_types", new=AsyncMock(return_value=[])), \
         patch.object(cal_mod, "acomplete", new=AsyncMock(return_value=(None, {"resolved_model": "stub"}))), \
         patch("eisenbalm_pipeline.agents.calibrator.convex_mutation_safe", new=AsyncMock(side_effect=_capture_event)):
        result = await cal_mod.calibrator(state)

    # Fall-back assertion
    assert result["style_brief"]["voice"] == VOICE_CONSTRAINTS, (
        "Inactive narrator did not fall back to Jesse voice (D-14)"
    )
    # Warning assertion — at least one Convex mutation call carries the warning payload
    warning_payloads = []
    for call_kwargs in warning_calls:
        # convex_mutation_safe typically takes (mutation_name, args) — inspect both kwargs and positional shapes
        for value in list(call_kwargs.values()):
            if isinstance(value, dict) and "warning" in str(value).lower():
                warning_payloads.append(value)
    assert any(warning_payloads) or any(
        "warning" in str(call).lower() for call in warning_calls
    ), (
        "Inactive narrator did not emit a warning deliberationEvents row (D-14). "
        "Expected Convex mutation with payload containing 'warning' and inactive narrator name."
    )
```

(B) packages/pipeline/tests/test_section_writer_voice_propagation.py:

```python
"""Phase 16 Wave 0 — 4 narrative writers propagate narrator voice (NRR-04).

Per 16-RESEARCH Pitfall 2: the 4 narrative writer agents (origin_story,
problem, founder_bio, case_study) MUST pass
voice_constraints=style_brief.get("voice", VOICE_CONSTRAINTS) to
build_section_writer_prompt. Otherwise the narrator voice never reaches the
writers and the Herzog/Maya runs produce Jesse-in-disguise output.

This test patches build_section_writer_prompt with a capturing side_effect
and asserts the kwarg is passed.

RED until Plan 16-05 lands.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


WRITERS = [
    ("origin_story", "eisenbalm_pipeline.agents.origin_story", "origin_story"),
    ("problem", "eisenbalm_pipeline.agents.problem", "problem"),
    ("founder_bio", "eisenbalm_pipeline.agents.founder_bio", "founder_bio"),
    ("case_study", "eisenbalm_pipeline.agents.case_study", "case_study"),
]


def _state_with_narrator_voice() -> dict:
    return {
        "run_id": "run-writer-test-001",
        "issue_number": 42,
        "style_brief": {
            "voice": "HERZOG_PERSONA_MARKER",   # sentinel: if this reaches build_section_writer_prompt, propagation works
            "constraints": [],
            "bonusType": "bigBudget",
            "visualDirection": "",
            "previousBonusTypes": [],
        },
        "winning_charity": {"name": "The Nap Ministry", "location": "Atlanta"},
        "research": {"foundingMoment": "x", "founderBackground": "y"},
        "model_versions": {},
    }


@pytest.mark.parametrize("writer_name,module_path,func_name", WRITERS)
@pytest.mark.asyncio
async def test_writer_propagates_narrator_voice(writer_name: str, module_path: str, func_name: str):
    """Each writer MUST forward style_brief['voice'] into build_section_writer_prompt's voice_constraints kwarg."""
    try:
        import importlib
        mod = importlib.import_module(module_path)
        writer_fn = getattr(mod, func_name)
    except (ImportError, AttributeError):
        pytest.skip(f"Plan 16-05 not yet landed for writer {writer_name}")

    captured: dict = {}

    def _capture(**kwargs):
        captured.update(kwargs)
        return [{"role": "system", "content": "stub"}, {"role": "user", "content": "stub"}]

    with patch.object(mod, "build_section_writer_prompt", side_effect=_capture), \
         patch.object(mod, "acomplete", new=AsyncMock(return_value=(None, {"resolved_model": "stub"}))):
        try:
            await writer_fn(_state_with_narrator_voice())
        except Exception:
            # The writer may raise after build_section_writer_prompt is called (no real LLM response);
            # we only care that the kwarg was captured.
            pass

    assert "voice_constraints" in captured, (
        f"writer '{writer_name}' did not pass voice_constraints kwarg to build_section_writer_prompt — "
        f"narrator voice will silently fall back to Jesse default (Pitfall 2)"
    )
    assert captured["voice_constraints"] == "HERZOG_PERSONA_MARKER", (
        f"writer '{writer_name}' passed a voice_constraints value that does not match style_brief['voice'] — "
        f"got {captured['voice_constraints']!r}, expected the style_brief['voice'] sentinel string"
    )
```

(C) packages/pipeline/tests/test_qa_judge_narrator.py:

```python
"""Phase 16 Wave 0 — QA judge narrator-awareness (NRR-06).

Asserts:
  - run_llm_judge accepts narrator: Optional[dict] = None kwarg (signature gate)
  - when narrator is set, the system message includes narrator.voiceRubric AND
    at least one entry from narrator.exampleSamples[:3]
  - when narrator is None, the system message matches the legacy rubric.md
    content byte-equivalently (NRR-10 zero-regression)

RED until Plan 16-07 lands.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


try:
    from eisenbalm_pipeline.agents.qa.judge import run_llm_judge  # noqa: F401
    JUDGE_AVAILABLE = True
except ImportError:
    JUDGE_AVAILABLE = False


pytestmark = pytest.mark.skipif(
    not JUDGE_AVAILABLE,
    reason="Plan 16-07 not yet landed — QA judge narrator kwarg missing",
)


def _sections() -> dict[str, str]:
    return {
        "origin_story": "Stub origin story body.",
        "problem": "Stub problem body.",
        "founder_bio": "Stub founder bio body.",
        "case_study": "Stub case study body.",
        "game": "Stub game body.",
        "bonus": "Stub bonus body.",
    }


@pytest.mark.asyncio
async def test_judge_signature_accepts_narrator_kwarg():
    """run_llm_judge MUST accept narrator: Optional[dict] = None as kwarg (Plan 16-07 contract)."""
    import inspect
    from eisenbalm_pipeline.agents.qa.judge import run_llm_judge
    sig = inspect.signature(run_llm_judge)
    assert "narrator" in sig.parameters, (
        "run_llm_judge missing 'narrator' kwarg — NRR-06 contract requires the judge accept narrator at call time"
    )


@pytest.mark.asyncio
async def test_judge_appends_narrator_rubric():
    """When narrator is set, the system message must include narrator.voiceRubric content."""
    from eisenbalm_pipeline.agents.qa import judge as judge_mod
    herzog = {
        "name": "Werner Herzog",
        "slug": "werner-herzog",
        "voiceConstraints": "Speak with geological gravity.",
        "voiceRubric": "HERZOG_RUBRIC_SENTINEL — reward sweeping cosmic framing.",
        "exampleSamples": ["HERZOG_SAMPLE_SENTINEL — a sample of his voice.", "Another sample.", "Third sample."],
        "active": True,
    }
    captured_messages: list[list[dict]] = []

    async def _capture_complete(**kwargs):
        captured_messages.append(kwargs["messages"])
        # Return an empty findings result so the judge happy-path completes.
        class _Result:
            findings = []
        return _Result(), {"resolved_model": "stub"}

    with patch.object(judge_mod, "acomplete", new=_capture_complete):
        await judge_mod.run_llm_judge(_sections(), run_id="r1", narrator=herzog)

    assert captured_messages, "acomplete was not called"
    system_content = captured_messages[0][0]["content"]
    assert "HERZOG_RUBRIC_SENTINEL" in system_content, (
        "QA judge did not append narrator.voiceRubric to the system message"
    )
    assert "HERZOG_SAMPLE_SENTINEL" in system_content, (
        "QA judge did not append at least one exampleSamples entry as few-shot anchor"
    )


@pytest.mark.asyncio
async def test_qa_judge_narrator_none_preserves_legacy_messages():
    """When narrator is None, the system message MUST equal the legacy rubric.md content (NRR-10 zero-regression)."""
    from eisenbalm_pipeline.agents.qa import judge as judge_mod
    legacy_rubric = judge_mod._load_rubric()   # noqa: SLF001

    captured_messages: list[list[dict]] = []

    async def _capture_complete(**kwargs):
        captured_messages.append(kwargs["messages"])
        class _Result:
            findings = []
        return _Result(), {"resolved_model": "stub"}

    with patch.object(judge_mod, "acomplete", new=_capture_complete):
        await judge_mod.run_llm_judge(_sections(), run_id="r1", narrator=None)

    system_content = captured_messages[0][0]["content"]
    assert system_content == legacy_rubric, (
        "QA judge system message diverged from legacy rubric.md when narrator=None (NRR-10)"
    )

    # B6 fix (revision 1): NRR-10 also pins the USER message byte-for-byte when narrator=None.
    # The legacy Phase 5 user message content is reconstructed here from the same template
    # judge.py uses, so the test catches any user-message drift (e.g., narrator-aware
    # user_intro prefixes accidentally landing on the narrator=None path).
    import json as _json
    sections_json = _json.dumps(_sections(), indent=2)
    legacy_user_content = (
        "Evaluate these section bodies against the Jesse voice rubric. "
        "Return JSON JudgeFindings with a `findings` array. "
        "An empty array is a passing grade.\n\n"
        f"SECTIONS:\n{sections_json}"
    )
    user_content = captured_messages[0][1]["content"]
    assert user_content == legacy_user_content, (
        "QA judge USER message diverged from legacy Phase 5 content when narrator=None (NRR-10). "
        "Plan 16-07 must NOT inject a narrator-aware user_intro on the narrator=None path."
    )
```
  </action>
  <verify>
    <automated>test -f packages/pipeline/tests/test_calibrator_narrator.py packages/pipeline/tests/test_section_writer_voice_propagation.py packages/pipeline/tests/test_qa_judge_narrator.py; uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py packages/pipeline/tests/test_section_writer_voice_propagation.py packages/pipeline/tests/test_qa_judge_narrator.py --collect-only exits 0; uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py packages/pipeline/tests/test_section_writer_voice_propagation.py packages/pipeline/tests/test_qa_judge_narrator.py -q exits with all tests SKIPPED (Plans 16-05 + 16-07 not landed — expected RED state)</automated>
  </verify>
  <done>3 pytest files created with module-level skipif + per-test skip guards. Tests collect cleanly; all-skipped state confirmed.</done>
</task>

<task type="auto">
  <name>Task 3: Extend packages/pipeline/tests/test_chronicler.py with test_narrator_voice_propagation</name>
  <files>packages/pipeline/tests/test_chronicler.py</files>
  <read_first>
    - packages/pipeline/tests/test_chronicler.py FULL FILE (existing Phase 13 chronicler tests — the new test is appended at the end of the file inside the same module, reusing the CHRONICLER_AVAILABLE guard at the top)
    - packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py lines 53-87 (_build_system_prompt with VOICE_CONSTRAINTS embedded — the function Plan 16-06 refactors)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §F (Chronicler migration pattern: _build_system_prompt accepts voice_constraints kwarg; chronicler() node body computes voice from state.style_brief)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-05 (Chronicler consumer surface stable — reads style_brief["voice"] not direct VOICE_CONSTRAINTS import)
  </read_first>
  <action>
Append (do NOT replace) this new test function to packages/pipeline/tests/test_chronicler.py, inside the existing module, after all existing test_* functions. The new test uses the existing _minimal_state helper and CHRONICLER_AVAILABLE guard.

```python


# ── Phase 16 (NRR-05): Chronicler reads style_brief["voice"], not direct VOICE_CONSTRAINTS ──


@pytest.mark.skipif(not CHRONICLER_AVAILABLE, reason="chronicler module not yet present")
@pytest.mark.asyncio
async def test_narrator_voice_propagation():
    """When state['style_brief']['voice'] carries a narrator voice marker, the chronicler system prompt MUST include it.

    This is the Phase 16 Wave 0 RED test for NRR-05: the Chronicler's
    consumer surface must shift from direct `from ... import VOICE_CONSTRAINTS`
    to reading `state.get('style_brief', {}).get('voice', VOICE_CONSTRAINTS)`
    inside `_build_system_prompt()` (Plan 16-06).

    Implementation gate: the system prompt is the FIRST message in the
    acomplete call. We intercept that call and assert the narrator's sentinel
    string appears in the system content.
    """
    from eisenbalm_pipeline.agents import chronicler as chr_mod

    NARRATOR_SENTINEL = "HERZOG_PERSONA_MARKER_PHASE16"

    state = _minimal_state(charity_name="The Nap Ministry")
    state["style_brief"] = {
        "voice": f"Some preamble.\n\n{NARRATOR_SENTINEL}\n\nMore lines.",
        "constraints": [],
        "bonusType": "bigBudget",
        "visualDirection": "",
        "previousBonusTypes": [],
    }
    state["winning_charity"] = {"name": "The Nap Ministry"}
    state["editor_decision"] = "Pick The Nap Ministry."
    state["runner_up_notes"] = ""

    captured_messages: list[list[dict]] = []

    async def _capture(**kwargs):
        captured_messages.append(kwargs["messages"])
        # Return a minimal Chronicler-shaped response so the happy path completes.
        class _Turn:
            def __init__(self, speaker, text):
                self.speaker = speaker
                self.text = text
            def model_dump(self):
                return {"speaker": self.speaker, "text": self.text}

        class _Out:
            turns = [
                _Turn("scout", "Stub turn 1."),
                _Turn("advocate", "Stub turn 2."),
                _Turn("editor", "Stub turn 3."),
                _Turn("editor", "The Nap Ministry is the pick."),
            ]
        return _Out(), {"resolved_model": "stub"}

    with patch.object(chr_mod, "acomplete", new=_capture):
        await chr_mod.chronicler(state)

    assert captured_messages, "chronicler did not call acomplete — RED expected before Plan 16-06"
    system_content = captured_messages[0][0]["content"]
    assert NARRATOR_SENTINEL in system_content, (
        f"Chronicler system prompt missing narrator voice marker {NARRATOR_SENTINEL!r}. "
        "Chronicler must consume style_brief['voice'] (NOT a direct VOICE_CONSTRAINTS import) per NRR-05."
    )
```
  </action>
  <verify>
    <automated>grep -c "def test_narrator_voice_propagation" packages/pipeline/tests/test_chronicler.py returns 1; uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler.py --collect-only exits 0; uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler.py::test_narrator_voice_propagation -q exits non-zero (RED) because Plan 16-06 not yet landed; the existing chronicler tests (Phase 13) remain in the file and green</automated>
  </verify>
  <done>test_chronicler.py extended with one new test function; existing Phase 13 tests untouched; new test is RED (expected) until Plan 16-06 lands.</done>
</task>

</tasks>

<verification>
- All 6 new pytest files + the test_chronicler.py extension collect cleanly under `uv run --project packages/pipeline pytest packages/pipeline/tests/ --collect-only`.
- The existing 168-passing pipeline pytest suite stays green at the Wave 0 commit (no new failures from these scaffolds — only SKIP states for the Phase 16 RED tests).
- Each test file maps to a specific NRR-* requirement row in 16-VALIDATION.md §Per-Task Verification Map, closing the TBD task ID slots.
</verification>

<success_criteria>
- 7 pytest files (6 new + 1 extended) exist on disk.
- `uv run --project packages/pipeline pytest packages/pipeline/tests/ -x -q` exits 0 (RED tests are skip-guarded, existing 168 stay green).
- Plan 16-04 (voice.py refactor), 16-05 (DispatchState + Calibrator + writer kwargs), 16-06 (Chronicler), 16-07 (QA judge), and 16-08 (seed) each have a pytest target file already present to turn green.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-02-SUMMARY.md` listing the 7 files, the NRR-* coverage map (which test file covers which requirement), and confirmation of the all-SKIPPED current state.
</output>
