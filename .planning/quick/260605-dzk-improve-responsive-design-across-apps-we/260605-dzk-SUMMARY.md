---
phase: quick-260605-dzk
plan: 01
type: quick
subsystem: frontend/css
tags: [responsive, mobile, tablet, cardswap, magazine-layout]
key-files:
  modified:
    - apps/web/components/archive/CardSwap.tsx
    - apps/web/app/globals.css
decisions:
  - Used min() CSS function for CardSwap width — browser-native, no JS needed
  - Placed 600px gutter block before @media print (logical document order, after all section rules)
  - Did not add .mission-band to 600px pass (horizontal reduction not required by scope; vertical 22px must never change)
metrics:
  duration: ~8 min
  completed: "2026-06-05"
  tasks: 2
  files: 2
---

# Quick 260605-dzk: Improve Responsive Design — Summary

One-liner: Fixed CardSwap 500px fixed-width mobile overflow and added 768px briefing/deliberation tablet breakpoints plus a 600px 18px-gutter pass across all full-bleed magazine sections.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix CardSwap fixed-width horizontal overflow | c6a5161 | apps/web/components/archive/CardSwap.tsx |
| 2 | Add tablet + small-mobile magazine breakpoints | 42622d6 | apps/web/app/globals.css |

## Changes Made

### Task 1 — CardSwap.tsx (line 120)

Changed `.cardswap-scene` inline style from `width: '500px'` to `width: 'min(500px, 100%)'`.

The element's `max-w-full` Tailwind class was already present but being defeated by the inline `width: 500px` override. The `min()` CSS function resolves this at the browser level: on viewports ≥500px the scene is 500px (unchanged appearance); on viewports <500px the scene shrinks to the container width, eliminating the horizontal scroll.

Unchanged: `perspective: '1200px'`, `height: '400px'`, all card transforms, reduced-motion logic, chevron/dot controls.

### Task 2 — globals.css (44 lines added)

Three additive `@media` blocks:

**(a) `@media (max-width: 768px)` — briefing-grid stacked dividers**
After the existing 980px collapse rule. Converts `border-right` column dividers to `border-bottom` row dividers when the grid is stacked, and removes the bottom border from the last column. Both the 980px and 768px rules set `grid-template-columns: 1fr` (idempotent).

**(b) `@media (max-width: 768px)` — delib-grid gap**
After the existing 980px grid collapse rule. Tightens gap from 56px to 28px in the tablet band (768px–980px is single-column already; this only affects the gap).

**(c) `@media (max-width: 600px)` — 18px gutter pass**
Placed before `@media print`. Reduces horizontal padding to 18px on `.masthead` (top also trimmed from 56px to 36px, matching `.game`/`.article-wrap` at 980px; bottom 36px preserved via longhand `padding-top`/`padding-left`/`padding-right`), `.ad-wrap`, `.pod`, `.shop`, `.delib`.

`.mission-band` intentionally excluded — horizontal reduction not in scope, and the 22px VERTICAL value must never change.

## Invariants Verified

- `.mission-band` still reads `padding: 22px 32px` (byte-identical, line 1131)
- `.sec-label` still reads `margin-bottom: 22px` (byte-identical, line 1211)
- `@media (prefers-reduced-motion: reduce)` block untouched (~line 1292)
- No new hex literals in globals.css — only `var(--color-line)` used in new rules
- No new npm deps; no CDN; FONT_WHITELIST unchanged

## Verification Gate Results

- `pnpm build:web`: **exit 0** — 39 static pages generated, 0 TypeScript errors
- `pnpm --filter web test`: **391 passed | 13 todo** (404 total) — meets ≥391/13 requirement

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- apps/web/components/archive/CardSwap.tsx — modified (min(500px, 100%) confirmed)
- apps/web/app/globals.css — modified (768px x2 + 600px x1 confirmed)
- Commit c6a5161 — exists
- Commit 42622d6 — exists

## Self-Check: PASSED
