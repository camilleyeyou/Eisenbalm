---
phase: 14
plan: "01"
subsystem: frontend-test
tags: [wcag, light-theme, tdd, source-scan, wave-0]
dependency_graph:
  requires: []
  provides: [wave-0-test-gate, light-base-aa-contract, source-scan-tripwires]
  affects: [14-02-globals-css-retone, 14-03-deliberation-slot-reconciliation]
tech_stack:
  added: []
  patterns: [source-scan-readfilesync-inside-it, conditional-dead-code-guard, tdd-red-until-wave-2]
key_files:
  created: []
  modified:
    - apps/web/__tests__/theme-aa-tones.test.ts
decisions:
  - ".section-card.feature .sc-name is dead code (no .tsx renders .section-card/.sc-name) — conditional tripwire documents this explicitly; if a render path is ever added the branch flips automatically"
  - "readFileSync inside each it() body per Phase 9 pattern so Vitest collection never throws on missing files"
  - "3 source-scan tripwires intentionally RED until Plans 02/03 — this is the Wave 0 TDD gate"
metrics:
  duration: "~3 min"
  completed: "2026-05-25"
  tasks: 2
  files: 1
---

# Phase 14 Plan 01: Test Gate Update Summary

Flipped `apps/web/__tests__/theme-aa-tones.test.ts` from the Phase 9 dark-base WCAG assertions to the locked Phase 14 light-base assertions, and added source-scan tripwires covering all three Phase 14 implementation blockers.

## What Was Done

### Task 1 — Light-base AA assertions

- Renamed `DARK_BG = '#0C0B0A'` → `LIGHT_BG = '#FAFAF8'` (all usages)
- Updated describe block: "Phase 9 house secondary tones — WCAG AA on dark bg" → "Phase 14 house tones — WCAG AA on light bg (#FAFAF8)"
- Replaced all 8 contrast `it()` blocks with light-base ratios verbatim from 14-UI-SPEC.md
- Added `--color-primary-text #7A5C0E` (5.97:1) and `--color-accent-text #9B3015` (7.11:1) as new AA-pass assertions
- Flipped `--color-primary #CDA434` from `≥AA` → `toBeLessThan(AA)` (2.24:1 on light — decorative only)
- Updated rejected-value doc: was `#615B4D fails dark`, now `#938A77 fails light` (3.89:1)

### Task 2 — Source-scan tripwires

Added `describe('Phase 14 source-scan tripwires', ...)` with 4 `it()` blocks:

1. **BLOCKER 1 — globals.css small-text gold**: Asserts `.snw-section-num`, `.snw-module-label`, `.snw-read-value`, `.snw-title-accent`, `.sc-num`, `.sc-arrow` use `--color-primary-text` (not raw `--color-primary`). Asserts `.snw-row:hover .snw-tag-pill` / `.snw-row.active .snw-tag-pill` block uses `color: var(--color-primary-text)` (while allowing `border-color: var(--color-primary)` — decorative).

2. **BLOCKER 2 — conditional .sc-name guard**: Scans all `.tsx` files outside `__tests__/` for `.section-card` / `.sc-name` usage. Confirmed dead code (no TSX renders these classes). Conditional branch documents this explicitly — if a render path is added, the branch flips and requires `--color-primary-text`. Currently PASSES (dead code confirmed).

3. **BLOCKER 3 — DeliberationSlot -text variants**: Asserts `agentChipStyle()` editor branch uses `var(--color-primary-text)`, `QA_SEVERITY.warning` uses `--color-primary-text`, `QA_SEVERITY.error` uses `--color-accent-text`, `{scoreValue}/10` span uses `--color-primary-text`, `● live` indicator uses `--color-primary-text`. Also aggregate: `≥4` occurrences of `--color-primary-text` and `≥1` of `--color-accent-text`.

4. **Paper shadow scan**: Asserts `.section-card:hover` block does NOT contain `rgba(0,0,0,` and DOES contain `rgba(90,75,50,0.18)`.

## Test Results

```
Phase 14 house tones — WCAG AA on light bg (#FAFAF8): 10/10 PASS (pure math, no implementation dependency)
Phase 14 source-scan tripwires:
  ✓ .section-card.feature .sc-name — PASS (confirmed dead code)
  × globals.css small-text gold — FAIL (intended TDD gate for Plan 02)
  × DeliberationSlot -text variants — FAIL (intended TDD gate for Plan 03)
  × .section-card:hover paper shadow — FAIL (intended TDD gate for Plan 02)
```

11 passed, 3 failed (3 failures are the Wave 0 TDD gate — Plans 02/03 make them green).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this is a test-only file update with no stubs.

## Self-Check: PASSED

- `apps/web/__tests__/theme-aa-tones.test.ts` exists and is modified
- Commit `c469345` exists and contains the changes
- All Task 1 acceptance criteria verified by grep
- All Task 2 acceptance criteria verified by grep
- Vitest run confirms: 11 passed, 3 RED (intended), 0 unexpected failures
