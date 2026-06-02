---
phase: 17-ui-ux-audit-follow-ups
plan: 04
subsystem: apps/web
tags: [loading-skeleton, a11y, wcag, animate-pulse, single-main-landmark, debug-route]
dependency_graph:
  requires: [17-01]
  provides: [P17-04, P17-06, P17-07]
  affects:
    - apps/web/app/issue/[slug]/loading.tsx
    - apps/web/app/archive/loading.tsx
    - apps/web/app/charities/loading.tsx
    - apps/web/app/charities/[slug]/loading.tsx
    - apps/web/app/%5Fdebug/convex/page.tsx
tech_stack:
  added: []
  patterns:
    - App Router loading.tsx skeleton pattern
    - animate-pulse shimmer with --color-line token
    - single-main-landmark (no main in route-level files)
key_files:
  created:
    - apps/web/app/issue/[slug]/loading.tsx
    - apps/web/app/archive/loading.tsx
    - apps/web/app/charities/loading.tsx
    - apps/web/app/charities/[slug]/loading.tsx
  modified:
    - apps/web/app/%5Fdebug/convex/page.tsx
decisions:
  - "JSDoc comments in loading.tsx files must not contain literal <main strings — the no-<main> test scans the entire file content including comments"
  - "Used main#main notation in JSDoc (instead of <main id='main'>) to avoid tripping the source-scan tripwire"
metrics:
  duration: ~3 min
  completed: "2026-06-02"
  tasks: 2
  files: 5
---

# Phase 17 Plan 04: Loading Skeletons and Debug-Main Fix — Summary

Four Next.js App Router `loading.tsx` skeleton files (issue, archive, charities, single-charity) plus a one-line `<main>`→`<div>` fix in the `/_debug/convex` route. Skeletons mirror each page's container width with `animate-pulse` shimmer bars using the `--color-line` token; none introduce a `<main>` landmark. The debug route fix restores the single-main-landmark invariant (WCAG 1.3.1).

## Tasks Completed

### Task 1: Create four loading.tsx skeleton files

**Commit:** `9edeed5`

Created all four files:

- `apps/web/app/issue/[slug]/loading.tsx` — `<article className="pb-0 animate-pulse">` root; hero block (`max-w-[860px]`) with 4 skeleton bars (eyebrow h-3, two title bars h-12, meta h-3); body block (`max-w-[680px]`) with 6 prose bars via `Array.from({length:6})`
- `apps/web/app/archive/loading.tsx` — `<div>` root, `max-w-[1100px]`; title bar h-8, subtitle h-3, CardSwap placeholder h-48, 5 row bars h-16
- `apps/web/app/charities/loading.tsx` — `<div>` root, `max-w-[1100px]`; title bar h-9, subtitle h-3, 3-col grid of 6 card blocks h-32
- `apps/web/app/charities/[slug]/loading.tsx` — `<div>` root, `max-w-[760px]`; name bar h-10, meta h-3, 5 prose bars

All four: no `<main>`, no `'use client'`, no hardcoded hex (`bg-[color:var(--color-line)]` only), `aria-hidden="true"` on all decorative bars, `animate-pulse` on root.

### Task 2: Fix duplicate `<main>` in `/_debug/convex` route

**Commit:** `5f119c4`

In `apps/web/app/%5Fdebug/convex/page.tsx`, changed:
- Line 50: `<main className="mx-auto max-w-2xl px-6 py-12">` → `<div className="mx-auto max-w-2xl px-6 py-12">`
- Line 72: `</main>` → `</div>`

All other content (the `'use client'` directive, `useQuery` calls, `<meta name="robots">`, heading, table) byte-unchanged.

## Verification

| Check | Result |
|---|---|
| `loading-skeletons.test.ts` | 8/8 GREEN |
| `debug-route.test.ts` | 2/2 GREEN |
| Full suite `pnpm --filter web test:unit` | 258 pass / 1 fail (pre-existing `about-page.test.ts` P17-05 — different plan) |
| `pnpm --filter web build` | exits 0 |
| No `<main` in any loading.tsx | Confirmed |
| No hardcoded hex in any loading.tsx | Confirmed |
| No `'use client'` in any loading.tsx | Confirmed |
| Single-main invariant (only layout.tsx has `<main`) | Confirmed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDoc comments in loading.tsx files triggered the no-<main> source-scan**
- **Found during:** Task 1 verification (first test run)
- **Issue:** The plan's template comments included `<main id="main">` as literal text in JSDoc, but the `loading-skeletons.test.ts` tripwire uses `src.not.toContain('<main')` which scans the entire file including comments — not just JSX elements
- **Fix:** Replaced `<main id="main">` in all JSDoc comment strings with `main#main` notation (equivalent meaning, no angle bracket)
- **Files modified:** All four loading.tsx files
- **No separate commit** (fixed before Task 1 commit)

## Known Stubs

None. All skeleton files are pure shimmer UI (no data) and the debug page fix is markup-only.

## Self-Check: PASSED
