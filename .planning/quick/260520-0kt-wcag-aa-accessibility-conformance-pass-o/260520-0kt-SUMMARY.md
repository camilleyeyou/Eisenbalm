---
phase: quick-260520-0kt
plan: 01
subsystem: apps/web
tags: [a11y, wcag, css, markup, accessibility]
dependency_graph:
  requires: []
  provides: [WCAG-A11Y-PASS]
  affects: [apps/web/app/globals.css, apps/web/app/layout.tsx, apps/web/components/AnchorCopyButton.tsx, apps/web/components/SiteHeader.tsx, apps/web/components/archive/ArchiveList.tsx, apps/web/components/issue/IssueHero.tsx, apps/web/app/charities/page.tsx, apps/web/app/archive/page.tsx]
tech_stack:
  added: []
  patterns: [prefers-reduced-motion media query, sr-only focus pattern, min-h-11 touch targets, single-main-landmark]
key_files:
  created: []
  modified:
    - apps/web/app/globals.css
    - apps/web/app/layout.tsx
    - apps/web/components/AnchorCopyButton.tsx
    - apps/web/components/SiteHeader.tsx
    - apps/web/components/archive/ArchiveList.tsx
    - apps/web/components/issue/IssueHero.tsx
    - apps/web/app/charities/page.tsx
    - apps/web/app/archive/page.tsx
decisions:
  - "Charities page comment placed as JS comment before return() — not as JSX {/* */} at the top of the return expression, which caused a TS1005 parse error (JSX comment as sole root is invalid)"
  - "Verification command grep -c '<main' matched comment text in layout.tsx and charities; actual JSX element count is correct — the real check is grep '^\s*<main' which shows only layout.tsx:131"
metrics:
  duration: ~8 min
  completed: "2026-05-20"
  tasks: 4
  files: 8
---

# Quick Task 260520-0kt: WCAG AA Accessibility Conformance Pass — Summary

Four small, related, low-risk WCAG AA conformance fixes applied to `apps/web`. Markup/CSS-only: no behavior changes, no data changes, no color changes. Each fix landed as an atomic commit.

## Tasks Completed

### Task 1 — prefers-reduced-motion guard (FIX 1)
**Commit:** `12e4bcc`
**File:** `apps/web/app/globals.css`

Appended a `@media (prefers-reduced-motion: reduce)` block after `.metadata-block dd` (the final rule, L261). The block targets `*, *::before, *::after` and sets only:
- `animation-duration: 0.01ms !important`
- `animation-iteration-count: 1 !important`
- `transition-duration: 0.01ms !important`
- `scroll-behavior: auto !important`

No color, layout, sizing, or font properties inside the block. Zero effect under normal motion preference. Covers: DeliberationSlot chevron rotate, prose link opacity fades, shadcn tooltip zoom.

### Task 2 — 44px touch targets across four components (FIX 2)
**Commit:** `b56bea2`
**Files:** `AnchorCopyButton.tsx`, `SiteHeader.tsx`, `ArchiveList.tsx`, `IssueHero.tsx`

- **AnchorCopyButton:** `h-6 w-6` → `min-h-11 min-w-11`. Icon stays `size={14}`. `aria-label`, `print:hidden`, `focus-visible:outline*` classes preserved verbatim.
- **SiteHeader nav links:** Added `inline-flex items-center min-h-11 py-2` to existing className. All existing color/hover/underline-offset classes unchanged.
- **ArchiveList sort buttons:** Added `inline-flex items-center min-h-11` to both active and inactive arms of the ternary className expression for both "Newest first" and "Oldest first" buttons.
- **IssueHero PDF link:** `inline-block` → `inline-flex items-center min-h-11`. `target`, `rel`, `download`, `text-[color:var(--color-primary)]`, `underline underline-offset-2`, `transition-opacity hover:opacity-75` preserved.

No hardcoded colors. No glyph/font-size changes. No behavior changes.

### Task 3 — Skip-to-content link (FIX 3)
**Commit:** `c617d85`
**File:** `apps/web/app/layout.tsx`

Inserted an `<a href="#main">Skip to content</a>` as the first child of `<body>`, before `<ConvexClientProvider>`. Uses `sr-only focus:not-sr-only` pattern:
- Hidden via `sr-only` by default
- On focus: `focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[color:var(--color-bg)] focus:px-4 focus:py-2 focus:text-[color:var(--color-text)]`
- Relies on the existing global `:focus-visible` ring in globals.css (not duplicated)
- Targets existing `<main id="main">` at layout.tsx L131
- All colors remain `var(--color-*)` references

### Task 4 — Single `<main>` landmark reconciliation (FIX 4)
**Commits:** `e7b1b16`, `19bf834`
**Files:** `apps/web/app/archive/page.tsx`, `apps/web/app/charities/page.tsx`

- **archive/page.tsx:** Nested `<main className="...">` → `<div className="...">` (open and close tags; all classes and children unchanged). Removes the duplicate-landmark violation (main-in-main).
- **charities/page.tsx:** Already used `<div>` — no element change. Added two-line JS comment before `return()` explaining the single-main-landmark pattern so future editors don't "fix" it back to `<main>`.
- **about/page.tsx:** Untouched (uses `<article>`, already correct pattern).
- **layout.tsx:** Remains the sole `<main id="main">` landmark for all routes.

Result: exactly one `<main id="main">` per page. The skip-link `href="#main"` resolves unambiguously.

## Verification

| Check | Result |
|---|---|
| `pnpm --filter web test:unit` | 79 pass / 29 fail (baseline unchanged; 29 are Phase 8 Wave 0 sentinels, pre-existing, out of scope) |
| `pnpm --filter web typecheck` | Pre-existing Phase 8 sentinel errors only (missing stripe/checkout route handlers); zero new errors from this plan |
| `theme.ts` modified | No |
| `GameSlot.tsx` modified | No |
| Hardcoded color values introduced | None — all colors remain `var(--color-*)` |
| `<main>` elements outside layout.tsx | None |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Charities JSX comment caused TS1005 parse error**
- **Found during:** Task 4 typecheck
- **Issue:** The JSX comment `{/* ... */}` was placed as the sole root expression inside `return (...)` before the `<div>`. TypeScript (and JSX) cannot have a comment as the root of a return expression — it must be a JSX element.
- **Fix:** Moved the comment to a standard JS comment (`// ...`) immediately before the `return (` statement, which is valid.
- **Files modified:** `apps/web/app/charities/page.tsx`
- **Commit:** `19bf834`

## Known Stubs

None. This plan makes no data or behavior changes — purely markup/CSS accessibility fixes with no stub paths.

## Self-Check: PASSED

All committed files exist and all commit hashes are present in git log.
