---
phase: 02-web-shell-theme-engine
plan: 05
subsystem: apps/web
tags: [next.js, shadcn, tailwind-v4, fonts, layout, css-variables, print, seo]
dependency_graph:
  requires: [02-01, 02-02, 02-03]
  provides: [root-layout, shadcn-primitives, globals-css, site-constants, reading-time, json-ld, site-chrome]
  affects: [02-06, 02-09, 02-10, 02-11]
tech_stack:
  added:
    - class-variance-authority
    - clsx
    - tailwind-merge
    - tailwindcss-animate
    - "@radix-ui/react-tooltip"
    - "@radix-ui/react-slot"
  patterns:
    - next/font/google CSS variable loading
    - shadcn/ui hand-written primitives (CLI too interactive)
    - Tailwind v4 @theme directive for CSS variable system
    - serializeThemeCss(null) for FOUC-free default theme
    - color-mix() for derived palette tokens
key_files:
  created:
    - apps/web/components.json
    - apps/web/lib/utils.ts
    - apps/web/components/ui/button.tsx
    - apps/web/components/ui/tooltip.tsx
    - apps/web/app/globals.css
    - apps/web/lib/site.ts
    - apps/web/lib/format.ts
    - apps/web/lib/reading-time.ts
    - apps/web/components/JsonLd.tsx
    - apps/web/components/SiteHeader.tsx
    - apps/web/components/SiteFooter.tsx
    - apps/web/app/layout.tsx
    - apps/web/app/not-found.tsx
    - apps/web/app/error.tsx
    - apps/web/app/page.tsx
  modified:
    - apps/web/lib/sanity/image.ts
    - apps/web/lib/theme.test.ts
decisions:
  - shadcn CLI v3 is fully interactive (--base-color flag unsupported, --yes only skips one prompt); hand-wrote all four files with standard shadcn-ui v2 API
  - Added shadcn variable name shim to globals.css proactively (--background, --foreground etc) to prevent button/tooltip color miss
  - Reading time uses 238 WPM per UI-SPEC (overrides CONTEXT.md D-24 200 WPM reference)
  - Homepage stub page.tsx created for build to succeed; Plan 02-09 replaces it
  - Fixed two pre-existing blocking bugs (Rule 3 + Rule 1) to achieve typecheck 0 errors
metrics:
  duration_seconds: 987
  completed_date: "2026-05-12"
  tasks_completed: 8
  files_created: 15
  files_modified: 2
---

# Phase 02 Plan 05: Root Layout + Globals + shadcn Init — Summary

**One-liner:** Root app shell wired with Playfair Display/Lora/Inter fonts, Tailwind v4 CSS-variable theming, shadcn button+tooltip primitives hand-written (CLI interactive), and full print stylesheet.

## What Was Built

This plan delivered all the infrastructure that Wave 3 routes depend on:

1. **shadcn/ui primitives** — `components/ui/button.tsx` + `components/ui/tooltip.tsx` hand-written to shadcn v2 API spec; `components.json` registry config; `lib/utils.ts` cn() helper. Transitive deps installed: class-variance-authority, clsx, tailwind-merge, tailwindcss-animate, @radix-ui/react-tooltip, @radix-ui/react-slot.

2. **globals.css** — Tailwind v4 `@import "tailwindcss"` + `@theme` block wiring CSS variables into utility classes. `:root` block sets brand defaults: `#FAFAF8` bg, `#1A1A18` text, `#2D5016` primary, `#8B1A1A` accent. `color-mix()` derives surface/muted/border tokens. `@media print` hides site chrome and forces black-on-white 12pt Georgia serif. shadcn variable shim added at bottom (--background, --foreground etc map to UI-SPEC names).

3. **lib/site.ts** — `SITE_NAME`, `SITE_AUTHOR`, `SITE_DESCRIPTION`, `getSiteUrl()` all exported on their own `export const`/`export function` lines (grep-anchored).

4. **lib/format.ts** — `formatIssueDate`, `formatMonthYear`, `formatIssueLabel` with en-US locale and UTC timeZone (prevents Sanity date-only TZ drift).

5. **lib/reading-time.ts** — `countWords()` + `readingTime()` at **238 WPM** (UI-SPEC locked value, not 200 WPM from CONTEXT.md D-24). Rounded up, returns 0 for empty input.

6. **components/JsonLd.tsx** — Server component rendering `<script type="application/ld+json">` with `<` escaped to `<` via `safeJsonLdString()`.

7. **SiteHeader.tsx + SiteFooter.tsx** — Server components. Header: wordmark + nav (Archive, Charities, About, Shop). Footer: wordmark, copyright `© {year} Jesse A. Eisenbalm. All proceeds go to the featured charity.`, legal links. Both carry `data-site-header` / `data-site-footer` attributes targeted by the print stylesheet.

8. **app/layout.tsx** — Loads Playfair Display (display, weight 600), Lora (body, weight 400), Inter (UI, weights 400+600) via `next/font/google`. Inlines `serializeThemeCss(null)` default theme in `<head>` for FOUC prevention. Wraps tree in `<TooltipProvider delayDuration={0}>`. Sets OG/Twitter metadata with og-default.png.

9. **app/not-found.tsx** — "This page does not exist." with link to /archive. Jesse voice.

10. **app/error.tsx** — `'use client'`. "This issue could not be loaded. Try refreshing." with reset button.

11. **app/page.tsx** — Placeholder stub (`return null`). Plan 02-09 replaces this with the full homepage.

## Print-Hide Data Attributes (Downstream Components Must Emit)

The print stylesheet uses these attribute selectors. Wave 3 components must apply them:

| Component | Required attribute |
|-----------|-------------------|
| SiteHeader | `data-site-header` (already set) |
| SiteFooter | `data-site-footer` (already set) |
| ShopCallout | `data-shop-callout` |
| AnchorCopyButton | `data-anchor-copy` |
| Game slot | `data-game-slot` |
| Deliberation slot | `data-deliberation-slot` |
| Podcast slot | `data-podcast-slot` |
| Any other hidden element | `data-print-hide="true"` |

## Font Variables (next/font/google)

`next/font/google` injects CSS variable names into the `<html>` className:
- `--font-display-loaded` → Playfair Display (display font)
- `--font-body-loaded` → Lora (body font)
- `--font-ui-loaded` → Inter (UI font, never themed)

The `:root` in `globals.css` sets `--font-display`, `--font-body`, `--font-ui` with fallback stacks. Issue layouts override `--font-display` and `--font-body` via `serializeThemeCss(theme)`.

## shadcn Install Outcome

- **CLI version:** shadcn v3+ (pnpm dlx shadcn@latest) — fully interactive, `--base-color` flag unsupported
- **Method used:** Hand-written files per standard shadcn-ui v2 API
- **components.json:** Written manually with neutral base, css-variables: true, RSC: true
- **Shim block needed:** Yes — added to globals.css bottom to map `--background`/`--foreground` to UI-SPEC names; prevents button/tooltip primitives from rendering colorless if they reference shadcn's default variable names

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI v3 is fully interactive**
- **Found during:** Task 1
- **Issue:** `shadcn@latest` CLI v3 requires interactive prompts (component library selector). `--base-color` flag not recognized. `--yes` only skips one confirm dialog.
- **Fix:** Hand-wrote all four files (`components.json`, `lib/utils.ts`, `components/ui/button.tsx`, `components/ui/tooltip.tsx`) using standard shadcn-ui v2 API. Installed transitive deps manually via `pnpm --filter web add`.
- **Files modified:** All four files above
- **Commit:** a1ca2ac

**2. [Rule 3 - Blocking] @sanity/image-url type import path wrong (pre-existing from 02-02)**
- **Found during:** Task 8 (build)
- **Issue:** `lib/sanity/image.ts` imported `SanityImageSource` from `@sanity/image-url/lib/types/types` — path doesn't exist in the installed version. Blocked the full build.
- **Fix:** Changed import to `from '@sanity/image-url'` (package root exports the type).
- **Files modified:** `apps/web/lib/sanity/image.ts`
- **Commit:** 22baf89

**3. [Rule 1 - Bug] TS2532 in theme.test.ts (pre-existing from 02-03)**
- **Found during:** Task 8 (typecheck)
- **Issue:** `el.style.props['--font-display'].includes(...)` — indexer returns `string | undefined`, calling `.includes()` on possibly-undefined crashes strict TS.
- **Fix:** Added nullish coalescing: `(el.style.props['--font-display'] ?? '').includes(...)`.
- **Files modified:** `apps/web/lib/theme.test.ts`
- **Commit:** d8403a0

### Non-deviations (expected)

- **Homepage stub `app/page.tsx`:** Created with `return null` to allow build; Plan 02-09 replaces it. Documented in plan's Task 8 as expected pattern.
- **shadcn shim block in globals.css:** Added proactively per Task 2 instructions (plan explicitly says "add this shim only if shadcn primitives render without color in dev"). Added preventively since button/tooltip use class utilities that reference shadcn's variable names.

## Known Stubs

- `apps/web/app/page.tsx` — returns null; Plan 02-09 ships the homepage content.
- `apps/web/public/og-default.png` — referenced in layout.tsx metadata but not yet created; Plan 02-10 ships the placeholder image.
- `/legal/privacy` and `/legal/terms` — footer links exist, routes land in Phase 8.

## Verification Results

- `pnpm --filter web typecheck` exits 0 (after fixing two pre-existing bugs)
- `pnpm --filter web build` exits 0
- Build output: `/ ○` and `/_not-found ○` both statically generated
- All 15 files exist at expected paths

## Self-Check: PASSED

Files verified:
- apps/web/components.json: FOUND
- apps/web/lib/utils.ts: FOUND
- apps/web/components/ui/button.tsx: FOUND
- apps/web/components/ui/tooltip.tsx: FOUND
- apps/web/app/globals.css: FOUND
- apps/web/lib/site.ts: FOUND
- apps/web/lib/format.ts: FOUND
- apps/web/lib/reading-time.ts: FOUND
- apps/web/components/JsonLd.tsx: FOUND
- apps/web/components/SiteHeader.tsx: FOUND
- apps/web/components/SiteFooter.tsx: FOUND
- apps/web/app/layout.tsx: FOUND
- apps/web/app/not-found.tsx: FOUND
- apps/web/app/error.tsx: FOUND

Commits verified:
- a1ca2ac: feat(02-05): initialize shadcn/ui with button + tooltip primitives
- 5c320bb: feat(02-05): create globals.css with Tailwind v4 + default theme variables + print stylesheet
- ad822b2: feat(02-05): add lib/site.ts + lib/format.ts + lib/reading-time.ts
- 6035305: feat(02-05): add JsonLd server component for structured data
- 296ab17: feat(02-05): add SiteHeader + SiteFooter server components
- c4fda72: feat(02-05): create root layout with fonts, default theme, TooltipProvider
- e24daa6: feat(02-05): add not-found.tsx and error.tsx with Jesse-voice copy
- 22baf89: fix(02-05): fix @sanity/image-url type import path in lib/sanity/image.ts
- d8403a0: fix(02-05): fix TS2532 in theme.test.ts - optional chaining for style.props lookups
- 0c0390c: chore(02-05): add homepage placeholder stub (plan 02-09 replaces)
