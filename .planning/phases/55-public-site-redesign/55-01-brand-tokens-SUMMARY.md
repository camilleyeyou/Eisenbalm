---
phase: 55-public-site-redesign
plan: 01
subsystem: ui
tags: [brand, css, manrope, a11y, tokens]
requires: []
provides:
  - "lib/brand.ts: PALETTE, NEUTRALS, INK, PAPER, TONE_ORDER, ACCENT_OFFSET, toneForIssue, accentForIssue, rotationForIssue, inkFor, serializeAccentCss"
  - "app/dispatch.css scoped .dispatch token layer and d-* class contract"
  - "Manrope as --font-dispatch"
affects: [55-02, 55-06, 55-07, 55-08, 55-09, 55-10, 55-11]
tech-stack:
  added: []
  patterns: ["frozen palette constants; hex confined to one CSS block", "source-scan guard tests covering components/dispatch/**/*.css"]
key-files:
  created:
    - apps/web/lib/brand.ts
    - apps/web/app/dispatch.css
    - apps/web/__tests__/brand-accent.test.ts
    - apps/web/__tests__/brand-tokens.test.ts
    - apps/web/__tests__/dispatch-css-responsive.test.ts
    - apps/web/__tests__/dispatch-a11y.test.ts
  modified:
    - apps/web/app/layout.tsx
key-decisions:
  - "Issue 2 = green via ACCENT_OFFSET=2; ink chosen by repo contrastRatio, not luminance threshold"
  - "lib/theme.ts untouched"
requirements-completed: [P55-SC1, P55-SC4, P55-SC6, PUB-01, PUB-02, PUB-13, PUB-14]
duration: 10min
completed: 2026-10-17
---

# Phase 55 Plan 01: Brand Tokens Summary

Fixed Dispatch palette module with deterministic weekly accent rotation, scoped `dispatch.css` class contract, Manrope font, and four guard test files.

## Tasks
1. brand.ts + brand-accent tests - 4e02fcfa
2. dispatch.css + Manrope in layout + brand-tokens tests - 78128aff
3. responsive + a11y guard tests - 1260c5a9

## Verification
Full web suite: 487 passed, 13 todo. `tsc --noEmit` clean. theme.ts unchanged.

## Deviations from Plan
**[Rule 3 - Blocking]** `noUncheckedIndexedAccess` rejected `TONE_ORDER[i]` indexing; added a private `toneAt()` helper in brand.ts. Behaviour identical.

## Known Stubs
None.

## Self-Check: PASSED
