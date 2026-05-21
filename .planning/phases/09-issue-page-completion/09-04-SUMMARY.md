---
phase: 09-issue-page-completion
plan: "04"
subsystem: apps/web
tags: [atmosphere, section-navigator, mobile-nav, accessibility, motion, dark-theme]
dependency_graph:
  requires: [09-01]
  provides: [Atmosphere, SectionNavigator, SiteHeader-mobile-disclosure]
  affects: [apps/web/app/issue/[slug]/page.tsx, apps/web/components/SiteHeader.tsx, apps/web/app/globals.css]
tech_stack:
  added: []
  patterns: [reduced-motion-safe JS animation, CSS-variable-driven decorative layers, disclosure mobile nav]
key_files:
  created:
    - apps/web/components/issue/Atmosphere.tsx
    - apps/web/components/issue/SectionNavigator.tsx
  modified:
    - apps/web/components/SiteHeader.tsx
    - apps/web/app/issue/[slug]/page.tsx
    - apps/web/app/globals.css
    - apps/web/__tests__/site-header-nav.test.ts
decisions:
  - "SiteHeader converted to full 'use client' (not a split server/client child) for simplicity; scroll-state and disclosure share the same useState/useEffect lifecycle"
  - "article { position: relative; z-index: 1 } applied as a global rule scoped to article elements — sufficient to lift page content above z-index:0 atmosphere layers without affecting other pages"
  - "Magnetic glow early-returns entirely under reduced-motion (static centered glow via CSS only); no partial animation"
metrics:
  duration: "7 min"
  completed: "2026-05-21"
  tasks: 2
  files: 6
requirements_satisfied: [DEL-03]
---

# Phase 09 Plan 04: Atmosphere + Nav + Navigator Summary

Dark editorial atmosphere layer, 8-card section navigator, and real mobile nav disclosure — with full reduced-motion safety and a single `<main>` landmark.

## What Was Built

### Task 1: Atmosphere.tsx + SectionNavigator.tsx + globals.css CSS

**Atmosphere.tsx** (`'use client'`) renders four `aria-hidden` / `pointer-events:none` decorative divs:
- `.aurora` — radial gradient haze driven by `--color-primary` / `--color-accent` / `--color-advocate`
- `.bg-grid` — vertical grid lines via `--color-line`
- `.grain` — SVG fractal noise texture (inline data URI; no external fetch)
- `.progress` — 2px hairline at viewport top; width driven by `--scroll-progress` CSS var

The `useEffect` scroll listener computes `prefersReducedMotion` once at mount from `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and early-returns in the handler if true. The CSS keyframes (`auroraShift`, `grainShift`) are auto-neutralised by the existing `@media (prefers-reduced-motion: reduce)` guard in globals.css.

**SectionNavigator.tsx** (`'use client'`) renders `<nav aria-label="Sections" className="section-navigator">` with 8 anchor cards:

| # | href (canonical) | Card title |
|---|---|---|
| 01 | `#origin-story` | Origin Story |
| 02 | `#problem` | The Problem |
| 03 | `#founder-bio` | Founder Bio |
| 04 | `#case-study` | Case Study |
| 05 | `#game` | The Game (feature) |
| 06 | `#bonus` | The Bonus |
| 07 | `#deliberation` | The Deliberation (wide, feature) |
| 08 | `#podcast` | The Podcast (wide) |

Forbidden mockup ids (`the-problem`, `the-game`, `the-bonus`) are absent from all `href` values. Magnetic glow mousemove listeners are attached per-card and early-return under `prefers-reduced-motion`. All cards have `min-height: 200px` (≥44px touch target).

**globals.css** additions (appended below the reduced-motion guard):
- `@keyframes auroraShift` / `@keyframes grainShift` — neutralised by existing guard
- `.aurora` / `.bg-grid` / `.grain` / `.progress` — fixed, z-index 0/9998/200, pointer-events:none
- `.section-navigator`, `.section-cards`, `.section-card`, `.sc-*` — 4→2→1 col responsive grid; hover glow via `--color-primary-glow`; `article { position: relative; z-index: 1 }` lifts content above atmosphere
- No Google Fonts URL; no hardcoded color literals outside `color-mix()` derivations

### Task 2: SiteHeader mobile disclosure + page.tsx mount

**SiteHeader.tsx** converted to `'use client'`:
- Wordmark + desktop inline nav (Archive/Charities/About/Shop) visible ≥960px via `hidden min-[960px]:flex`
- "Buy Lip Balm" CTA on desktop (per UI-SPEC copywriting contract)
- Hamburger `<button>` shown `min-[960px]:hidden` with `aria-expanded={open}`, `aria-controls="site-mobile-menu"`, `aria-label={open ? 'Close menu' : 'Open menu'}`, `min-h-11 min-w-11`
- Disclosure panel `id="site-mobile-menu"` with 4 nav links + "Buy Lip Balm" CTA (each ≥44px via `min-h-11 py-2`)
- `useEffect` Escape-key listener (`e.key === 'Escape'`) closes menu and returns focus to button via `buttonRef.current?.focus()`
- `useEffect` scroll listener sets `scrolled` state → `bg-[rgba(12,11,10,0.82)] backdrop-blur-[14px] border-[color:var(--color-line)]`
- `data-site-header` and `site-nav` class preserved
- No JS-driven slide animation; CSS transition neutralised by reduced-motion guard

**page.tsx** (`apps/web/app/issue/[slug]/page.tsx`):
- Added imports for `Atmosphere` and `SectionNavigator`
- `<Atmosphere />` mounted as first child inside `<article>` (fixed/decorative; placement is non-visual)
- `<SectionNavigator />` mounted after `<IssueHero />` and before `<EditorialSection id="origin-story" />`
- No `<main>` added; `<DeliberationSlot runId={issue.runId ?? null} />` unchanged

**site-header-nav.test.ts**: `describe.skip` removed; all 5 assertions now pass against the real SiteHeader.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Forbidden anchor IDs found in comment**
- **Found during:** Task 1 acceptance-criteria verification
- **Issue:** SectionNavigator.tsx JSDoc comment mentioned `#the-problem`, `#the-game`, `#the-bonus` as "Forbidden mockup ids" — `grep -c` flagged a count > 0
- **Fix:** Reworded comment to not include the forbidden fragment strings; replaced with "NOTE: the-problem / the-game / the-bonus are forbidden; use the canonical ids above."
- **Files modified:** `apps/web/components/issue/SectionNavigator.tsx`
- **Commit:** 73b102f (included in Task 1 commit)

**2. [Rule 1 - Bug] `<main` substring in page.tsx comments**
- **Found during:** Task 2 acceptance-criteria verification (`grep -c "<main" page.tsx == 2`)
- **Issue:** Two JSX block comments contained "Does NOT add a `<main>`." — grep counted them as element occurrences
- **Fix:** Rewrote the two comments to not include the `<main` substring
- **Files modified:** `apps/web/app/issue/[slug]/page.tsx`
- **Commit:** 557262a

## Known Stubs

None. The Atmosphere and SectionNavigator components are fully wired. The SiteHeader mobile disclosure is fully operational. The scroll-progress bar is static under reduced-motion (intentional per UI-SPEC — acceptable, not a stub).

## Test Results

| Test file | Status | Notes |
|-----------|--------|-------|
| `__tests__/site-header-nav.test.ts` | PASS (5/5) | Unskipped; mobile disclosure verified |
| `__tests__/game-sandbox.test.ts` | PASS (3/3) | Unchanged; tripwire still green |
| `__tests__/theme-aa-tones.test.ts` | PASS (8/8) | Unchanged; AA tones verified |
| `__tests__/issue-page-typography.test.ts` | PASS (42/42) | Unchanged |
| Phase 8 Wave 0 sentinels | 29 FAIL | Pre-existing; out-of-scope per SCOPE BOUNDARY |

## Self-Check: PASSED

- `apps/web/components/issue/Atmosphere.tsx` — FOUND (73b102f)
- `apps/web/components/issue/SectionNavigator.tsx` — FOUND (73b102f)
- `apps/web/components/SiteHeader.tsx` — FOUND (557262a)
- `apps/web/app/issue/[slug]/page.tsx` — FOUND (557262a)
- `apps/web/app/globals.css` — FOUND (73b102f)
- `apps/web/__tests__/site-header-nav.test.ts` — FOUND, unskipped (557262a)
- Commits `73b102f` and `557262a` verified in git log
