---
phase: 55-public-site-redesign
plan: 02
subsystem: ui
tags: [copy, voice, price, section-primitives, chrome-switch]
requires: []
provides:
  - "lib/site.ts: BALM_PRICE_CENTS = 899, formatUsd"
  - "lib/dispatch/copy.ts: all Phase 55 copy constants, SECTION_META, bonusLabel, fundButtonLabel, buyLead"
  - "components/dispatch/NumberedSection.tsx"
  - "components/dispatch/ChromeSwitch.tsx (isDispatchRoute, ChromeSwitch)"
affects: [55-06, 55-07, 55-08, 55-09, 55-10, 55-11]
key-files:
  created:
    - apps/web/lib/dispatch/copy.ts
    - apps/web/components/dispatch/NumberedSection.tsx
    - apps/web/components/dispatch/ChromeSwitch.tsx
    - apps/web/__tests__/dispatch-voice.test.ts
    - apps/web/__tests__/numbered-section.test.tsx
    - apps/web/__tests__/chrome-switch.test.ts
  modified:
    - apps/web/lib/site.ts
key-decisions:
  - "Price label derived from BALM_PRICE_CENTS; no 8.99 literal in copy.ts or components/dispatch (enforced by test)"
  - "Voice denylist test scans copy.ts and components/dispatch/** for the whole phase"
metrics:
  completed: 2026-10-17
  tasks: 2
  files: 7
---

# Phase 55 Plan 02: Copy Primitives Summary

Jesse-voice copy constants with a single price constant, plus the NumberedSection (one h2 per section) and ChromeSwitch primitives, guarded by a phase-wide voice denylist test.

## Commits
- 8f30d216: copy constants, BALM_PRICE_CENTS, voice denylist test
- 2581da9f: NumberedSection and ChromeSwitch with tests

## Verification
- `pnpm --filter web test`: 54 files passed, 511 tests passed
- `pnpm --filter web typecheck`: clean

## Deviations from Plan
- Voice test strips comments before scanning string literals for "!" (apostrophes in comments mis-paired the quote regex). Test-only adjustment.
- Fixed a wrong selector and non-null assertions in my own numbered-section test during authoring.

## Known Stubs
None.

## Self-Check: PASSED
