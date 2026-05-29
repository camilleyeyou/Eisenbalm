---
phase: 16-choose-your-narrator
plan: 02
subsystem: pipeline-tests
tags: [phase-16, wave-0, red-first, pytest, narrator, voice]
requirements: [NRR-03, NRR-04, NRR-05, NRR-06, NRR-09, NRR-10]
status: complete
dependency-graph:
  requires:
    - 16-01-contract-and-schema  # API_CONTRACTS §1.2/§7/§2.2 reconciled + narratorProfile schema
  provides:
    - Wave 0 pytest scaffold for NRR-03/04/05/06/09/10 — 7 pytest files (6 new + 1 extended) that Plans 16-04..16-08 turn green
    - Phase 16 import-guard sentinel pattern (gate on assemble_voice import → all-SKIPPED Wave 0)
    - xfail pattern for in-place test extension where existing module already imports (test_chronicler.py)
  affects:
    - Plan 16-04 (lib/voice.py refactor) — test_voice.py + test_narrator_seed_sentinel.py + test_narrator_cost_budget.py all gate on its UNIVERSAL_CORE/JESSE_PERSONA_BLOCK/assemble_voice exports
    - Plan 16-05 (DispatchState + Calibrator + writers) — test_calibrator_narrator.py + test_section_writer_voice_propagation.py both turn green when Calibrator reads state['narrator'] and writers pass voice_constraints kwarg
    - Plan 16-06 (Chronicler) — test_chronicler.py::test_narrator_voice_propagation xfail flips to passing
    - Plan 16-07 (QA judge) — test_qa_judge_narrator.py turns green when run_llm_judge accepts narrator kwarg
    - Plan 16-08 (seed) — test_narrator_seed_sentinel.py + test_narrator_cost_budget.py turn green when apps/studio/seeds/narrators.json lands
tech-stack:
  added: []
  patterns:
    - "import-time try/except skip guards (mirrors Phase 13 test_chronicler.py CHRONICLER_AVAILABLE pattern)"
    - "pytest.mark.skipif at module level via pytestmark for whole-file gating"
    - "pytest.mark.parametrize for writer-fan-out coverage (4 narrative writers)"
    - "unittest.mock.patch.object + AsyncMock for acomplete capture without real LLM calls"
    - "pytest.mark.xfail(strict=False) for in-place RED extension of green file (test_chronicler.py)"
key-files:
  created:
    - "packages/pipeline/tests/test_voice.py"
    - "packages/pipeline/tests/test_narrator_seed_sentinel.py"
    - "packages/pipeline/tests/test_narrator_cost_budget.py"
    - "packages/pipeline/tests/test_calibrator_narrator.py"
    - "packages/pipeline/tests/test_section_writer_voice_propagation.py"
    - "packages/pipeline/tests/test_qa_judge_narrator.py"
  modified:
    - "packages/pipeline/tests/test_chronicler.py"
decisions:
  - "Skip guard via assemble_voice import — Phase 16-04 sentinel — adopted for test_calibrator_narrator.py + test_section_writer_voice_propagation.py + test_qa_judge_narrator.py. Plan-spec guards (calibrator import, run_llm_judge import) would not skip because those modules already exist (Phase 5). assemble_voice does not exist until Plan 16-04, making it the canonical 'Phase 16 has landed' signal. Required to honor the plan's all-SKIPPED Wave 0 verify state without breaking the 168-passing baseline."
  - "test_chronicler.py extension uses pytest.mark.xfail(strict=False) — single test added to an already-green file with already-importable chronicler module. xfail correctly signals RED state for Plan 16-06 without breaking the suite. Flips to xpassed when Plan 16-06 reads style_brief['voice']; xfail decorator is then removed in 16-06's commit."
metrics:
  duration_minutes: 14
  tasks_completed: 3
  files_created: 6
  files_modified: 1
  tests_added: 19  # 4 + 1 + 3 (param) + 3 + 4 (param) + 3 + 1 = 19
  commits: 3
  completed_date: "2026-05-29"
---

# Phase 16 Plan 02: Pipeline Test Scaffold Summary

## One-Liner

RED-first pytest scaffold for narrator-aware pipeline — 6 new + 1 extended file encoding the verification contract for NRR-03/04/05/06/09/10 before any Wave 1 implementation lands.

## Outcome

Created 6 new pytest files and extended 1 existing file with a single new test, encoding the verification contract for Phase 16's narrator system. All new tests are RED-guarded so the existing 168-passing pipeline pytest suite stays green at this Wave 0 commit. Every implementation plan in Waves 1+ now has an automated pytest target already on disk to turn green:

- Plan 16-04 → test_voice.py + test_narrator_seed_sentinel.py + test_narrator_cost_budget.py
- Plan 16-05 → test_calibrator_narrator.py + test_section_writer_voice_propagation.py
- Plan 16-06 → test_chronicler.py::test_narrator_voice_propagation
- Plan 16-07 → test_qa_judge_narrator.py
- Plan 16-08 → test_narrator_seed_sentinel.py + test_narrator_cost_budget.py (seed-dependent assertions)

The Nyquist rule is honored: every NRR-* requirement row in `16-VALIDATION.md` §Per-Task Verification Map now points at a file that exists at collection time.

## NRR Coverage Map

| Requirement | Test File | Test(s) | Skip/RED gate | Turns Green When |
|-------------|-----------|---------|---------------|------------------|
| NRR-03 (byte-equivalence) | `test_voice.py` | `test_voice_constants_byte_equivalence`, `test_jesse_explicit_narrator_byte_equivalence`, `test_universal_core_contains_dem_04_rule`, `test_universal_core_contains_no_exclamation_rule` | ImportError on `assemble_voice` / `UNIVERSAL_CORE` / `JESSE_PERSONA_BLOCK` | Plan 16-04 lands `lib/voice.py` two-tier split |
| NRR-09 (cross-language seed) | `test_narrator_seed_sentinel.py` | `test_jesse_seed_matches_persona_block` | ImportError on `JESSE_PERSONA_BLOCK` + missing `apps/studio/seeds/narrators.json` | Plan 16-04 + Plan 16-08 both land |
| NRR-10 (cost budget ≤10%) | `test_narrator_cost_budget.py` | `test_cost_delta_within_10_percent[jesse|maya-rudolph|werner-herzog]` | ImportError on `VOICE_CONSTRAINTS` / `assemble_voice` + missing seeds | Plan 16-04 + Plan 16-08 both land |
| NRR-03 (calibrator wiring) | `test_calibrator_narrator.py` | `test_calibrator_uses_assemble_voice_with_narrator`, `test_calibrator_narrator_none_byte_equivalent_to_jesse`, `test_inactive_narrator_falls_back_to_jesse_with_warning` | ImportError on `assemble_voice` (Phase 16-04 sentinel) | Plan 16-05 calibrator reads state['narrator'] + emits warning for inactive |
| NRR-04 (writer propagation) | `test_section_writer_voice_propagation.py` | `test_writer_propagates_narrator_voice[origin_story|problem|founder_bio|case_study]` | ImportError on `assemble_voice` | Plan 16-05 4 writers pass `voice_constraints=style_brief['voice']` |
| NRR-05 (chronicler) | `test_chronicler.py` (extended) | `test_narrator_voice_propagation` | `@pytest.mark.xfail(strict=False)` | Plan 16-06 chronicler reads `style_brief['voice']` instead of `VOICE_CONSTRAINTS` import |
| NRR-06 (QA judge) | `test_qa_judge_narrator.py` | `test_judge_signature_accepts_narrator_kwarg`, `test_judge_appends_narrator_rubric`, `test_qa_judge_narrator_none_preserves_legacy_messages` | ImportError on `assemble_voice` | Plan 16-07 `run_llm_judge` accepts narrator kwarg + appends rubric/samples |
| NRR-10 (zero-regression) | `test_qa_judge_narrator.py::test_qa_judge_narrator_none_preserves_legacy_messages` + `test_calibrator_narrator.py::test_calibrator_narrator_none_byte_equivalent_to_jesse` + `test_voice.py::test_voice_constants_byte_equivalence` | (see above) | (see above) | Implementation paths preserve byte-equivalence on narrator=None |

## Current Test State

- Total Phase 16 tests added: **19**
- Currently SKIPPED (Phase 16 RED — expected): **18**
- Currently XFAIL (Phase 16 RED — expected): **1**
- Currently PASSING (existing 168-baseline retained): **171** (was 168; +3 Phase 13 chronicler tests + others retain green)
- Full suite exit code: **0** (`uv run --project packages/pipeline pytest packages/pipeline/tests/ -x -q` → `171 passed, 49 skipped, 1 xfailed in 11.94s`)
- Total tests collected: **221** (was 202; +19 Phase 16 tests)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | test_voice.py + test_narrator_seed_sentinel.py + test_narrator_cost_budget.py (3 byte/cost invariants) | `fd571f8` | 3 created |
| 2 | test_calibrator_narrator.py + test_section_writer_voice_propagation.py + test_qa_judge_narrator.py (3 wiring tests) | `8f3f379` | 3 created |
| 3 | Extend test_chronicler.py with test_narrator_voice_propagation | `d29940a` | 1 modified |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Strengthened skip guards in Task 2 files to gate on `assemble_voice` import (Phase 16-04 sentinel) instead of plan-spec module imports**

- **Found during:** Task 2 (test_calibrator_narrator.py, test_section_writer_voice_propagation.py, test_qa_judge_narrator.py)
- **Issue:** Plan task body specified import guards on `from eisenbalm_pipeline.agents.calibrator import calibrator` and `from eisenbalm_pipeline.agents.qa.judge import run_llm_judge`. These modules already exist (Phase 5), so the guards would NOT skip and the tests would run + FAIL today (calibrator does not read state['narrator']; run_llm_judge has no narrator kwarg). This contradicts the plan's own success criteria ("all-SKIPPED state confirmed") and the must_haves truth ("existing 168-passing pipeline pytest suite stays green").
- **Fix:** Added `from eisenbalm_pipeline.lib.voice import assemble_voice` to each import guard. Since `assemble_voice` does not exist until Plan 16-04 lands `lib/voice.py` two-tier split, this becomes the canonical "Phase 16 has landed" signal. When Plan 16-04 ships, the guards unlock; when Plans 16-05/16-07 ship their implementations, the assertions inside the tests turn green.
- **Files modified:** test_calibrator_narrator.py, test_section_writer_voice_propagation.py, test_qa_judge_narrator.py
- **Commit:** `8f3f379`

**2. [Rule 3 — Blocking] Wrapped test_narrator_voice_propagation in @pytest.mark.xfail(strict=False) in Task 3**

- **Found during:** Task 3 (test_chronicler.py extension)
- **Issue:** Plan task body appended the new test directly under the existing `CHRONICLER_AVAILABLE` guard. Chronicler module imports fine today (Phase 13), so the test would run + FAIL on `assert NARRATOR_SENTINEL in system_content` (chronicler currently builds the system prompt from `VOICE_CONSTRAINTS` import, not from `state['style_brief']['voice']`). This would break the suite. The plan's success_criteria says the suite stays green; the plan's task verify says the standalone command should "exit non-zero (RED)". These are reconciled by xfail (a failure under xfail is XFAIL, not a true failure — suite exits 0).
- **Fix:** Added `@pytest.mark.xfail(strict=False, reason="Phase 16 Plan 16-06 not yet landed ...")`. When Plan 16-06 ships, xfail flips to xpass (because we use strict=False, xpass does not break the suite either) — Plan 16-06's executor removes the xfail decorator in the same commit that makes the test pass cleanly.
- **Files modified:** test_chronicler.py
- **Commit:** `d29940a`

These are both Rule 3 deviations (blocking issues — necessary to honor the plan's success criteria given the existing codebase state at the start of Task 2/3 execution). Both are documented inline in the test file docstrings and the commit messages for traceability.

## Verification Evidence

```
# Wave 0 RED-state evidence
$ uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice.py packages/pipeline/tests/test_narrator_seed_sentinel.py packages/pipeline/tests/test_narrator_cost_budget.py -q
8 skipped in 0.02s

$ uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py packages/pipeline/tests/test_section_writer_voice_propagation.py packages/pipeline/tests/test_qa_judge_narrator.py -q
10 skipped in 0.16s

$ uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler.py -q
5 passed, 1 xfailed in 0.29s

# Full suite — must exit 0
$ uv run --project packages/pipeline pytest packages/pipeline/tests/ -x -q
171 passed, 49 skipped, 1 xfailed in 11.94s

# Collection sanity
$ uv run --project packages/pipeline pytest packages/pipeline/tests/ --collect-only -q
221 tests collected in 1.57s
```

Pre-execution baseline: 202 tests collected. Post-execution: 221 tests collected (+19 Phase 16 tests). Full suite exits 0 across all phases; existing 168-passing Phase-14 baseline preserved.

## Successor Plans Now Unblocked

| Plan | Wave | What it implements | Tests that turn green |
|------|------|--------------------|------------------------|
| 16-04 | 1 | `lib/voice.py` refactor — `UNIVERSAL_CORE`, `JESSE_PERSONA_BLOCK`, `assemble_voice`, byte-equivalence assertion | test_voice.py (4) + unlocks skipif guards on 4 other files |
| 16-05 | 1 | `DispatchState.narrator` + Calibrator narrator-awareness + 4 writer voice_constraints kwarg | test_calibrator_narrator.py (3) + test_section_writer_voice_propagation.py (4) |
| 16-06 | 1 | Chronicler `_build_system_prompt(voice_constraints=)` + node body reads style_brief | test_chronicler.py::test_narrator_voice_propagation (xfail → xpass → remove decorator) |
| 16-07 | 1 | `run_llm_judge(narrator=)` kwarg + voiceRubric/exampleSamples append | test_qa_judge_narrator.py (3) |
| 16-08 / 16-08a | 1 | `apps/studio/seeds/narrators.json` + seed script | test_narrator_seed_sentinel.py (1) + test_narrator_cost_budget.py (3) |

## Self-Check: PASSED

All 7 files exist on disk; all 3 commit hashes resolve in `git log`. Full pipeline pytest suite exits 0. Phase 16 RED tests are correctly skip/xfail-guarded.
