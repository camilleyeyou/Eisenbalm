---
phase: 18-magazine-editorial-layout-writers
plan: 02
subsystem: pipeline-tests
tags: [red-first, tdd, structural-floor, pydantic, portable-text, qa-rubric, mels]
dependency_graph:
  requires: [18-01-contract-amendments]
  provides: [wave-0-test-scaffold, mel-01-test, mel-02-test, mel-04-test, mel-08-test]
  affects: [18-03-lib-state-layer, 18-04-writers, 18-05-qa-axis]
tech_stack:
  added: []
  patterns:
    - pytest parametrize over 5 writers
    - pydantic v2 __pydantic_decorators__ introspection for field_validator detection
    - ImportError as intentional RED failure for not-yet-built lib symbols
key_files:
  created:
    - packages/pipeline/tests/agents/test_writer_structural_floor.py
    - packages/pipeline/tests/agents/test_qa_structural_axis.py
    - packages/pipeline/tests/agents/test_bonus_specad_only.py
    - packages/pipeline/tests/lib/test_portable_text_blocks.py
  modified: []
decisions:
  - Consolidated 3 ROADMAP test stubs into parametrized test_writer_structural_floor.py per CONTEXT Claude's Discretion
  - test_portable_text_blocks.py imports at module level (no skip guard) — ImportError at collection IS the RED state
  - test_structural_floor_one_heading_rejected passess trivially at Wave 0 (list→str ValidationError caught) — documented in RED/GREEN matrix
metrics:
  duration: 7min
  completed: "2026-05-30"
  tasks: 3
  files: 4
---

# Phase 18 Plan 02: RED Test Scaffold Summary

**One-liner:** 4 pytest files encoding MEL-01/02/04/08 as machine-checkable contracts — all fail RED at Wave 0 because production code (BodyBlock, _enforce_structural_floor, structural-variety axis, block builders) doesn't exist yet.

## What Was Built

Three tasks, 4 new test files, 34 new test cases:

| File | Tests | Wave 0 Status |
|------|-------|---------------|
| `tests/agents/test_writer_structural_floor.py` | 20 (4 functions × 5 writers) | 15 RED, 5 trivially pass (wrong reason) |
| `tests/agents/test_qa_structural_axis.py` | 2 | 2 RED |
| `tests/agents/test_bonus_specad_only.py` | 3 | 1 RED (specAd positive), 2 GREEN (BigBudget/Jingle absence) |
| `tests/lib/test_portable_text_blocks.py` | 9 | 9 RED (ImportError at collection) |

**Total new tests:** 34. **RED at Wave 0:** 27 (including 9 ImportError). **GREEN at Wave 0 (and permanently):** 7.

## RED/GREEN Matrix at Wave 0 Commit

### test_writer_structural_floor.py (20 tests)

The writers currently have `body: str`. When a `list[dict]` is passed to `body`:
- `test_structural_floor_headings_required` — FAILED: ValidationError raised (string_type mismatch) but assert `"structural-floor" in str(exc_info.value)` fails — message says "string_type" not "structural-floor"
- `test_structural_floor_blockquote_required` — FAILED: Same reason
- `test_structural_floor_one_heading_rejected` — **PASSED trivially**: `pytest.raises(ValidationError)` catches the string_type error (no message assertion) — this is acceptable pre-18-04 behavior; turns meaningfully green after Plan 18-04 adds the real validator
- `test_structural_floor_valid_body_accepted` — FAILED: `body: str` rejects `list[dict]` entirely (string_type error), so the "valid body accepted" case also fails

**Turns GREEN:** After Plan 18-04 ships `body: list[BodyBlock]` + `_enforce_structural_floor` validator on all 5 writers.

### test_qa_structural_axis.py (2 tests)

- `test_judge_finding_axis_includes_structural_variety` — FAILED: `"structural-variety"` not in current `JudgeFinding.axis` Literal (only 5 axes: gravity, sentiment, irony-signaling, precision, cross-section-consistency)
- `test_rubric_md_documents_structural_variety_axis` — FAILED: `"structural-variety"` not in current `rubric.md`

**Turns GREEN:** After Plan 18-05 adds the `"structural-variety"` literal to `judge.py` and extends `rubric.md`.

### test_bonus_specad_only.py (3 tests)

- `test_specad_bonus_has_structural_floor_validator` — FAILED: `SpecAdBonus.__pydantic_decorators__.field_validators` has no `_enforce_structural_floor` entry (current `body: str`, no validator)
- `test_big_budget_bonus_has_no_structural_floor` — **GREEN permanently**: `BigBudgetBonus` has no such validator (correct — D-04 carve-out)
- `test_jingle_bonus_has_no_structural_floor` — **GREEN permanently**: `JingleBonus` has no such validator (correct — D-04 carve-out)

**SpecAd turns GREEN:** After Plan 18-04 adds `_enforce_structural_floor` to `SpecAdBonus`.

### test_portable_text_blocks.py (9 tests)

All 9 fail with **ImportError at collection** because `block_blockquote`, `block_h2`, `block_h3`, `block_paragraph`, and `compose_section_body` don't exist in `eisenbalm_pipeline.lib.portable_text` yet.

**Turns GREEN:** After Plan 18-03 extends `lib/portable_text.py` with the 4 block builders + `compose_section_body`.

## Existing Test Suite Unchanged

```
uv run pytest --ignore=tests/agents/test_writer_structural_floor.py \
  --ignore=tests/agents/test_qa_structural_axis.py \
  --ignore=tests/agents/test_bonus_specad_only.py \
  --ignore=tests/lib/test_portable_text_blocks.py -x -q

Result: 192 passed, 33 skipped  (baseline ≥190 per Phase 16 contract — HOLDS)
```

No existing test was modified. All 4 files are net-new.

## Commits

| Hash | Message |
|------|---------|
| `499a86f` | `test(18-02): add RED structural-floor test scaffold (MEL-01 + MEL-02)` |
| `fdd5b63` | `test(18-02): add RED qa-structural-axis + bonus-specad-only test scaffold (MEL-04 + MEL-08)` |
| `cd74ff8` | `test(18-02): add RED portable-text block builder tests (MEL-01 + MEL-02 lib layer)` |

## Deviations from Plan

None - plan executed exactly as written.

The plan content was exact (EXACT block quotes for all 4 test files); the only deviation from the plan's `<success_criteria>` block wording is that "collection succeeds for all 4 files" is technically false for `test_portable_text_blocks.py` (it fails ImportError at collection) — but the plan's own success criteria at the bottom explicitly states: "At Wave 0 commit: 11 fail differently (portable_text_blocks 9 fail ImportError)". The ImportError is the intended RED failure mode documented in the plan's `<acceptance_criteria>` for Task 3.

## Known Stubs

None — this plan is test-only (no production code written). The stubs are in the production code that these tests are asserting against; those will be resolved by Plans 18-03, 18-04, and 18-05.

## Self-Check: PASSED
