---
phase: 12
plan: 02
subsystem: pipeline
tags: [suppression-flag, design-agent, langgraph, prompt-engineering, test-cleanup]
dependency_graph:
  requires: [12-01]
  provides: [MED-02-pipeline, MED-03]
  affects: [graph/builder.py, agents/validate.py, agents/design/__init__.py]
tech_stack:
  added: []
  patterns:
    - module-scope env flag read at import time (os.environ.get at module level)
    - lockstep tuple conditional exclusion (*() if _SUPPRESSED else (...))
    - prompt-only agent steering (envelope in system string, validation machinery frozen)
key_files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/validate.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
    - packages/pipeline/tests/agents/test_validate.py
    - packages/pipeline/tests/agents/test_design.py
    - packages/pipeline/tests/test_pipeline_real_mode.py
decisions:
  - "_SUPPRESSED truthiness expression is byte-identical between builder.py and validate.py: .lower() in ('1', 'true', 'yes') — prevents lockstep drift"
  - "design import at builder.py top-level kept unchanged (importing the function is harmless; it does not execute the agent)"
  - "SECTION_WRITERS tuple uses *() if _SUPPRESSED else ('design',) — fan-out loop handles edge removal automatically, no extra add_edge changes needed"
  - "System prompt uses 'strongly prefer' / 'Target range' soft steering (not hard constraints) so _validate_full whitelist + WCAG remains the binding gate"
  - "All test bodies unchanged — only xfail decorators removed (3 markers across 3 files)"
metrics:
  duration: 4 min
  completed: "2026-05-22T17:29:02Z"
  tasks: 3
  files: 6
---

# Phase 12 Plan 02: Pipeline Suppression + Prompt Summary

Reversible DesignAgent suppression flag (MED-02 pipeline half) plus Machine Editorial aesthetic envelope in DesignAgent system prompt (MED-03). Three Wave 0 xfail stubs converted to green passing assertions.

## What Was Built

**Task 1 — Atomic suppression gate (MED-02 pipeline)**

`builder.py` and `validate.py` both read `DESIGNAGENT_SUPPRESSED` at module-import time with an identical `_SUPPRESSED` flag. When the flag is truthy:

- `builder.py`: `"design"` is excluded from `SECTION_WRITERS` via `*(() if _SUPPRESSED else ("design",))` and `add_node("design", design)` is skipped.
- `validate.py`: `"theme"` is dropped from `REQUIRED_FIELDS` via the same tuple conditional.

The two files are explicitly coupled: changing one without the other causes every suppressed pipeline run to fail with `partial-failure: missing sections ['theme']`. The truthiness expression `("1", "true", "yes")` is byte-identical between both files.

**Task 2 — Machine Editorial envelope (MED-03)**

Only the `system` string inside `_build_messages()` was changed. The new opening section `AESTHETIC ENVELOPE (Machine Editorial):` steers the agent toward:
- `backgroundColor`: near-black warm canvas (`#0A0908–#1A1511` range)
- `textColor`: warm cream (`#E8E0CE–#F5EFE0` range)  
- `fontDisplay`: strongly prefer Cormorant Garamond
- `fontBody`: strongly prefer Lora
- `primaryColor`/`accentColor`: per-issue variation in dark metallic/ember register

All validation machinery is byte-unchanged: `ThemeOutput`, `_validate_full`, `SAFE_THEME`, `FALLBACK_FONT_DISPLAY`, `FALLBACK_FONT_BODY`, the regenerate-once flow, and the `display_list`/`body_list` whitelist f-string interpolation.

**Task 3 — xfail cleanup**

Three `@pytest.mark.xfail(...)` decorators from Plan 12-01 Wave 0 were removed. All three tests now assert green-for-real:
- `test_validate_sections_skips_theme_when_suppressed` (test_validate.py)
- `test_build_messages_contains_machine_editorial_envelope` (test_design.py)
- `test_design_suppressed_graph_completes_without_theme` (test_pipeline_real_mode.py)

## Test Results

Default mode (flag unset): **160 passed, 29 skipped, 0 failed**

Suppressed mode (`DESIGNAGENT_SUPPRESSED=true`): `tests/agents/test_validate.py` **2 passed**

Key tests verified:
- `test_full_graph_runs_to_publisher` — design node present, theme.primaryColor asserted, still green
- `test_design_suppressed_graph_completes_without_theme` — design node absent, theme is None, publisher still writes
- `test_validate_sections_skips_theme_when_suppressed` — REQUIRED_FIELDS drops "theme" when suppressed
- `test_build_messages_contains_machine_editorial_envelope` — 'Machine Editorial' in system string

## Deviations from Plan

None — plan executed exactly as written. The RESEARCH.md pitfalls were all avoided:
- Pitfall 2 (validate_sections halting with partial-failure): resolved atomically in Task 1
- Pitfall 3 (test_full_graph_runs_to_publisher failing under suppressed env): the test uses monkeypatch+reload isolation so the default-mode test is unaffected

## Known Stubs

None. All contracts are implemented; no placeholder values or wired-to-empty paths introduced.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 7d2b294 | feat(12-02): gate design node + REQUIRED_FIELDS on DESIGNAGENT_SUPPRESSED (MED-02) |
| 2 | f750a84 | feat(12-02): add Machine Editorial aesthetic envelope to DesignAgent system prompt (MED-03) |
| 3 | 5e75286 | test(12-02): remove Wave 0 xfail markers — all 3 stubs now green |

## Self-Check: PASSED
