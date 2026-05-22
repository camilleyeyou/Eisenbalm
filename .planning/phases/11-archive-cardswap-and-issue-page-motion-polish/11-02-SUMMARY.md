---
phase: 11
plan: 02
subsystem: apps/web/components/archive
tags: [archive, cardswap, css-3d, animation, accessibility, reduced-motion]
dependency_graph:
  requires: [11-01]
  provides: [ARC-01]
  affects: [apps/web/app/archive/page.tsx, apps/web/components/archive/CardSwap.tsx]
tech_stack:
  added: []
  patterns:
    - CSS-3D perspective card stack with getCardStyle() positional transform
    - prefers-reduced-motion gate via window.matchMedia in useEffect at mount
    - setInterval auto-advance with pause-on-hover and cleanup ref
    - Server Component (archive/page.tsx) mounting Client Component (CardSwap.tsx)
key_files:
  created:
    - apps/web/components/archive/CardSwap.tsx
  modified:
    - apps/web/app/archive/page.tsx
decisions:
  - React.CSSProperties extended for position/width/height to satisfy TypeScript spread
  - Back cards use aria-hidden="true" and pointerEvents:'none' for accessibility
  - Badge uses color-mix() for primary tint background (no new CSS variable)
  - CardSwap guarded at page level with {issues && issues.length > 0} so empty state path is unaffected
metrics:
  duration: ~8m
  completed: 2026-05-22
  tasks_completed: 2
  files_changed: 2
---

# Phase 11 Plan 02: Archive CardSwap Summary

CSS-3D card stack component (CardSwap.tsx) bound to real ArchiveIssue[] data, mounted above ArchiveList in the archive page, with reduced-motion guard, hover-pause, accessible prev/next controls, and indicator dots.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Build CardSwap.tsx (CSS-3D card stack, data-bound, reduced-motion-safe) | b92f503 | apps/web/components/archive/CardSwap.tsx |
| 2 | Mount CardSwap in archive/page.tsx | 4d25a74 | apps/web/app/archive/page.tsx |

## What Was Built

**CardSwap.tsx** — A `'use client'` component that:
- Accepts `{ issues: ArchiveIssue[] }` props (typed, zero hardcoded content)
- Renders a CSS-3D perspective card stack (`perspective: 1200px`) with per-card `getCardStyle(relativeIndex, isTransitioning)` that applies translateZ/translateY/rotateX offsets
- Auto-advances every 6000ms via `setInterval`; pauses on `onMouseEnter` / resumes on `onMouseLeave`
- Reads `window.matchMedia('(prefers-reduced-motion: reduce)')` at mount; if true, timer never starts and all card transitions are set to `'none'`
- Front card is an `<a>` linking to `/issue/{slug}` with `aria-label`; back cards are `<div aria-hidden="true">`
- Indicator dots with `role="tablist"`, `aria-label="Issue N"`, `aria-current="true"` on active dot, `min-h-11 min-w-11` touch targets
- Prev/Next chevrons (`ChevronLeft`/`ChevronRight` from `lucide-react`) with `aria-label`, `min-h-11 min-w-11`
- `data-print-hide="true"` on the `<section>` wrapper
- Badge showing `{issues.length} ISSUES` using `color-mix()` for primary tint
- Card face binds `issue.issueNumber`, `formatMonthYear(issue.publishDate)`, `issue.charity.name`, `issue.charity.focusArea` (when non-null), `issue.charity.assetRange` (when non-null)

**archive/page.tsx** — Server Component modified to:
- Import `{ CardSwap }` from `@/components/archive/CardSwap`
- Render `{issues && issues.length > 0 && <CardSwap issues={issues} />}` after the description paragraph and before the `ArchiveList` wrapper div
- Preserve all existing `QUERY_ARCHIVE` fetch, metadata export, and `ArchiveList` rendering unchanged

## Verification

- `pnpm --filter web test:unit __tests__/archive-cardswap.test.ts`: **14/14 PASS** (all ARC-01 CardSwap source-scan + archive-page wiring + no-new-dep + FONT_WHITELIST assertions GREEN)
- `pnpm --filter web build`: **exits 0** (TypeScript + Next.js build clean)
- Pre-existing tripwires (game-sandbox, issue-page-typography, theme-aa-tones, deliberation-no-model-names, archive-cardswap no-new-dep/FONT_WHITELIST blocks) remain GREEN
- Pre-existing Phase 8 Wave 0 sentinel failures (33 tests, CMR-02..CMR-10) unchanged — out of scope

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written, with one minor TypeScript accommodation:

**1. [Rule 1 - Bug] TypeScript CSSProperties spread with positional overrides**
- **Found during:** Task 1
- **Issue:** Spreading `getCardStyle()` result onto `React.CSSProperties` object required a `CSSProperties` type alias to allow `position`, `width`, `height`, `transformStyle` string fields alongside standard React CSS types
- **Fix:** Defined `type CSSProperties = React.CSSProperties & { ... }` at module level for the `getCardStyle` return type; caller site uses `React.CSSProperties` for the card wrapper spread
- **Files modified:** apps/web/components/archive/CardSwap.tsx (internal type only)

## Known Stubs

None. All data fields derive from `ArchiveIssue[]` props. No placeholder content.

## Self-Check: PASSED
