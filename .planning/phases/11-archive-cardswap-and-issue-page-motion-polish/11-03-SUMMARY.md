---
phase: 11-archive-cardswap-and-issue-page-motion-polish
plan: 03
subsystem: ui
tags: [animation, css-keyframes, server-component, clip-path, nextjs]

requires:
  - phase: 11-archive-cardswap-and-issue-page-motion-polish plan 01
    provides: Wave 0 RED test stubs for issue-hero-motion.test.ts (MOT-01 assertions)

provides:
  - IssueHero charity-name <h1> split into animated word spans with component-scoped @keyframes heroWordReveal
  - CSS-only clip-path + translateY + opacity reveal (no 'use client', no hooks)
  - Per-span animationDelay (80ms stagger) via inline style

affects: [issue-page, motion-polish]

tech-stack:
  added: []
  patterns:
    - "React 19 / Next 15 <style> tag in Server Component JSX for component-scoped @keyframes (hoisted to <head>, deduplicated)"
    - "opacity:0 and clip-path ONLY inside @keyframes from{} — never as base styles — so prefers-reduced-motion guard (duration→0.01ms) shows content instantly"
    - "charity.name.split(' ').map(...) with per-span animationDelay inline style for CSS-only stagger in Server Component"

key-files:
  created: []
  modified:
    - apps/web/components/issue/IssueHero.tsx

key-decisions:
  - "opacity:0 and clip-path placed ONLY inside @keyframes from{} — using animation-fill-mode:both for pre-animation visual state; globals.css reduced-motion guard (duration:0.01ms) collapses animation to instant without trapping words invisible"
  - "Component-scoped <style> tag in Server Component JSX used for @keyframes — React 19/Next 15 hoist pattern, no new CSS file needed"
  - "charity.name.split(' ') with arr.length index check for trailing space — preserves rendered name semantics and screen-reader text identically"

patterns-established:
  - "Pitfall-1 guard pattern: strip @keyframes block then assert no opacity:0 or clip-path in base styles — mirrors test assertion"

requirements-completed: [MOT-01]

duration: 1min
completed: 2026-05-21
---

# Phase 11 Plan 03: Issue Hero Clip-Path Reveal Summary

**CSS-only word-by-word clip-path + translateY + opacity reveal for IssueHero charity name — component-scoped @keyframes in a Server Component <style> tag, 80ms stagger per span, zero client JS**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-21T20:42:40Z
- **Completed:** 2026-05-21T20:43:51Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Split `charity.name` into animated word spans using `.split(' ')` with per-span `animationDelay: ${i * 80}ms`
- Added component-scoped `@keyframes heroWordReveal` in a `<style>` tag inside the Server Component (React 19/Next 15 pattern)
- `opacity:0`, `clip-path: inset(0 0 100% 0)`, and `transform: translateY(12px)` placed ONLY inside `@keyframes from{}` — never as base inline styles (Pitfall-1 guard)
- IssueHero remains a pure Server Component: no `'use client'`, no `useState`, no `useEffect`, no `useRef`
- `issue-hero-motion.test.ts` 7/7 GREEN; `issue-page-typography.test.ts` 42/42 GREEN; DES-04 eyebrow count 5 (unchanged)

## Task Commits

1. **Task 1: Split charity name into animated word spans with scoped @keyframes** - `9d738ec` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/web/components/issue/IssueHero.tsx` - Added `<style>` tag with `@keyframes heroWordReveal`, split `charity.name` into `.hero-word-span` elements with per-span `animationDelay`

## Decisions Made

- `opacity:0` and `clip-path` placed ONLY inside `@keyframes from{}` using `animation-fill-mode: both` so the browser's `to{}` end-state (fully visible) applies when the globals.css `prefers-reduced-motion` guard collapses duration to `0.01ms` — words never trapped invisible.
- `<style>` tag inside Server Component JSX is the correct React 19/Next 15 pattern for component-scoped keyframes (RESEARCH line 183); no new CSS file needed, no new dependencies.
- `charity.name.split(' ')` with `i < arr.length - 1 ? ' ' : ''` preserves whitespace between words so screen readers and text selection work identically to the original single text node.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MOT-01 complete. IssueHero word-span reveal is live and tested.
- Plan 11-04 (archive CardSwap or remaining motion polish) can proceed.
- `issue-hero-motion.test.ts` is now a permanent regression guard for the animation contract.

## Self-Check

- [x] `apps/web/components/issue/IssueHero.tsx` modified with `.split(`, `animationDelay`, `@keyframes heroWordReveal`, `.hero-word-span`
- [x] No `'use client'`, `useState`, `useEffect`, or `useRef` in modified file
- [x] `opacity:0` and `clip-path` only inside `@keyframes` block (not in base styles)
- [x] Eyebrow count: 5 (≥2, DES-04 preserved)
- [x] commit `9d738ec` exists: `git log --oneline | grep 9d738ec`

---
*Phase: 11-archive-cardswap-and-issue-page-motion-polish*
*Completed: 2026-05-21*
