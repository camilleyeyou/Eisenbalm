---
phase: 12-machine-editorial-design-adoption-and-designagent-suppression
plan: "01"
subsystem: testing
tags: [wave-0, test-first, xfail-stubs, design-suppression, machine-editorial]
dependency_graph:
  requires: []
  provides: [MED-01, MED-02, MED-03, MED-04, MED-05 wave-0 test surface]
  affects: [plan-12-02, plan-12-03, plan-12-04, plan-12-05]
tech_stack:
  added: []
  patterns:
    - source-scan tripwires (readFileSync + grep, no DOM/render)
    - importlib.reload() for module-scope env-var gate testing
    - xfail(strict=False) for Wave-0 stubs pending implementing wave
key_files:
  created:
    - apps/web/__tests__/machine-editorial-components.test.ts
    - packages/pipeline/tests/agents/test_validate.py
  modified:
    - apps/web/lib/theme.test.ts
    - packages/pipeline/tests/test_pipeline_real_mode.py
    - packages/pipeline/tests/agents/test_design.py
decisions:
  - "Wave-0 test-first: xfail stubs encode contracts before production code; implementing waves (02-05) turn them green"
  - "codeOnly() comment-stripping before model-name check prevents false positives from SECURITY comment prose in DeliberationSlot.tsx"
  - "importlib.reload() is required because validate.py and builder.py will read DESIGNAGENT_SUPPRESSED at module scope (Wave 1); tests must reload after setting env var"
  - "suppressedThemeCss must emit '' not serializeThemeCss(null) — null emits BRAND_DEFAULTS light palette (#FAFAF8) which overrides the dark house palette"
metrics:
  duration_minutes: 45
  tasks_completed: 4
  files_changed: 5
  completed_date: "2026-05-22"
---

# Phase 12 Plan 01: Wave 0 Test Stubs Summary

Wave-0 test-first scaffold for Phase 12. Authors the complete MED-01..MED-05 test surface before any production code changes. All 4 tasks committed; 3 new test files/modifications locked in.

## What Was Built

**Wave-0 purpose:** Encode the five Phase 12 contracts as failing/xfail tests before any production code exists. Implementing waves (Plan 12-02 through 12-05) turn them green. This gives each plan a verifiable green/red signal.

### Task 1 — MED-04/MED-05 Web Source-Scan Tripwires (commit `3cbd078`)

Created `apps/web/__tests__/machine-editorial-components.test.ts` with 5 Vitest source-scan tests (readFileSync + grep, no DOM/render):

- `MED-04: preserves all 8 canonical anchor ids` — #origin-story through #podcast in SectionNavigator.tsx
- `MED-04: preserves the prefers-reduced-motion early-return` — useEffect guard in SectionNavigator.tsx
- `MED-05: preserves AGENT_LABELS persona map` — key constant in DeliberationSlot.tsx
- `MED-05: preserves all 5 Convex useQuery subscriptions` — api.pipelineRuns.byRunId through api.qaCorrections.byRunId
- `MED-05: exposes no model-name literals in code (comment-stripped)` — codeOnly() strips comments before checking claude/gpt/sonnet/haiku/openrouter/anthropic

All 5 GREEN against current (pre-rebuild) source. Will stay GREEN after Waves 04/05 rebuild the components.

### Task 2 — MED-01 Theme Suppression Contract (commit `8c0beb6`)

Appended `describe('MED-01: theme suppression no-op contract')` to `apps/web/lib/theme.test.ts`:

- Proves `serializeThemeCss(null)` emits the light BRAND_DEFAULTS palette (#FAFAF8) — the pitfall that makes suppression code MUST emit `''` instead
- Encodes `suppressedThemeCss(suppressed, theme) => suppressed ? '' : serializeThemeCss(theme)` as the exact gate Plan 12-03 implements in layout.tsx

File uses Node.js `node:test` runner (not Vitest). Theme.test.ts is outside the Vitest `__tests__/` glob — verified correct isolation; tests execute via `node:test` independently.

### Task 3 — validate_sections Suppression Test (commit `a686545`)

Created `packages/pipeline/tests/agents/test_validate.py`:

- `test_validate_sections_requires_theme_when_not_suppressed` — GREEN immediately; proves current REQUIRED_FIELDS includes "theme"
- `test_validate_sections_skips_theme_when_suppressed` — xfail pending Plan 12-02; asserts REQUIRED_FIELDS drops "theme" and validate_sections passes without it

Uses `importlib.reload()` after `monkeypatch.setenv("DESIGNAGENT_SUPPRESSED", "true")` — the pattern required for module-scope env-var gates.

### Task 4 — Suppressed-Graph + Envelope Phrase Stubs (commit `c842ae5`)

Added to `test_pipeline_real_mode.py`:
- `test_design_suppressed_graph_completes_without_theme` (xfail) — full graph run with DESIGNAGENT_SUPPRESSED=true; asserts `result.get("theme") is None` and `"design" not in builder_mod.SECTION_WRITERS`

Added to `test_design.py`:
- `test_build_messages_contains_machine_editorial_envelope` (xfail) — asserts `"Machine Editorial" in system` from `_build_messages()`; turns green when Plan 12-02 adds the AESTHETIC ENVELOPE section

Both reload builder_mod and validate_mod after setting the env var. Both xfail until Plan 12-02.

## Test Suite State After This Plan

**Web (Vitest):** 173 passing, 29 failing (pre-existing Phase 8 Stripe sentinel tests — unbuilt CMR flows). No new failures introduced.

**Pipeline (pytest):** 157 passed, 29 skipped, 3 xfailed. No failures. The 3 xfails are: `test_validate_sections_skips_theme_when_suppressed`, `test_design_suppressed_graph_completes_without_theme`, `test_build_messages_contains_machine_editorial_envelope`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

These are intentional xfail stubs; they are the GOAL of this Wave-0 plan:

1. `packages/pipeline/tests/agents/test_validate.py::test_validate_sections_skips_theme_when_suppressed` — xfail until Plan 12-02 adds `_SUPPRESSED` gate to validate.py
2. `packages/pipeline/tests/test_pipeline_real_mode.py::test_design_suppressed_graph_completes_without_theme` — xfail until Plan 12-02 adds `SECTION_WRITERS` gate to builder.py
3. `packages/pipeline/tests/agents/test_design.py::test_build_messages_contains_machine_editorial_envelope` — xfail until Plan 12-02 adds Machine Editorial envelope to DesignAgent system prompt

Plan 12-02 removes all three xfail decorators when it implements the gates.

## Self-Check: PASSED
