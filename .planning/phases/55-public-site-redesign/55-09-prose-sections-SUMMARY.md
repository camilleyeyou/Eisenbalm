---
phase: 55-public-site-redesign
plan: 09
subsystem: web/dispatch
tags: [sections, prose, pull-quote, stat-tiles, timeline]
requires: [55-01, 55-02, 55-03]
provides: [PullQuote, OriginSection, ProblemSection, FounderSection, CaseSection]
affects: [55-11]
key-files:
  created:
    - apps/web/components/dispatch/PullQuote.tsx
    - apps/web/components/dispatch/sections/OriginSection.tsx
    - apps/web/components/dispatch/sections/ProblemSection.tsx
    - apps/web/components/dispatch/sections/FounderSection.tsx
    - apps/web/components/dispatch/sections/CaseSection.tsx
    - apps/web/components/dispatch/sections.css
    - apps/web/__tests__/prose-sections.test.tsx
metrics:
  completed: 2026-10-17
---

# Phase 55 Plan 09: Prose Sections Summary

Sections 01-04 as NumberedSection colour blocks with real headlines/bodies via PortableTextRenderer, stat tiles with sentence fallback, authored-only timeline and pull quotes (omitted when absent).

## Decisions
- Founder: no title prop, so the label is the single h2; headline renders as a heading-tier paragraph in the left column.
- `.d-founder-cols > *` flex-basis set to min(100%, 220px) (plan said 420px; the responsive CSS test forbids px basis >= 312).

## Deviations
- [Rule 1] Founder column basis 420px -> 220px to satisfy dispatch-css-responsive gate.
- Both tasks were written together; committed as two commits split by file.

## Verification
Full web suite 63 files / 640 tests pass; `tsc --noEmit` clean; no hex in sections.css; no inline styles.

## Self-Check: PASSED
