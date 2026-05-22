---
phase: 12-machine-editorial-design-adoption-and-designagent-suppression
plan: "03"
subsystem: apps/web
tags: [theme-suppression, server-component, env-flag, MED-01, MED-02]
dependency_graph:
  requires: [12-01]
  provides: [MED-01, MED-02 web half]
  affects: [apps/web/app/issue/[slug]/layout.tsx, apps/web/components/issue/ThemeApplier.tsx]
tech_stack:
  added: []
  patterns:
    - "process.env read in Next.js Server Component (request-time, not build-time)"
    - "Optional boolean prop with early-return in client useEffect"
    - "Empty CSS string bypass to avoid BRAND_DEFAULTS regression"
key_files:
  created: []
  modified:
    - apps/web/components/issue/ThemeApplier.tsx
    - apps/web/app/issue/[slug]/layout.tsx
decisions:
  - "suppressed ? '' : serializeThemeCss(theme) — never serializeThemeCss(null), which emits the LIGHT BRAND_DEFAULTS palette and would regress the dark look"
  - "suppressed prop is optional (suppressed?: boolean) so no existing callers need updating"
  - "<style dangerouslySetInnerHTML={{ __html: themeCss }} /> remains unconditional — empty __html is valid and safest approach (Open Question 3)"
  - "process.env.DESIGNAGENT_SUPPRESSED NOT NEXT_PUBLIC_ — request-time server read, not build-time bake"
metrics:
  duration: "~10 min"
  completed: "2026-05-22"
  tasks: 2
  files: 2
---

# Phase 12 Plan 03: Web Theme Suppression Summary

Reversible server-side suppression flag wired into the issue layout and ThemeApplier — locking the site to the Machine Editorial dark palette (MED-01) while preserving a one-env-var flip to restore per-issue theming (MED-02 web half).

## What Was Built

**Task 1 — ThemeApplier.tsx (MED-02 web client):** Added optional `suppressed?: boolean` prop. The `useEffect` now early-returns (`if (suppressed) return`) before calling `applyTheme`, with `[theme, suppressed]` as the dependency array. `'use client'` remains line 1. The MED-02 docstring was added inline. No other theme.ts symbol introduced.

**Task 2 — layout.tsx (MED-01 / MED-02 web server):** The Server Component now reads `process.env.DESIGNAGENT_SUPPRESSED === 'true'` at request time (never `NEXT_PUBLIC_`). When suppressed, `themeCss` is set to `''` — NOT `serializeThemeCss(null)`, which would emit the LIGHT `BRAND_DEFAULTS` palette and regress the dark house look. The `<style dangerouslySetInnerHTML={{ __html: themeCss }} />` element is unconditional. `<ThemeApplier theme={theme} suppressed={suppressed} />` passes the flag through. A MED-01/MED-02 docstring was prepended to the file.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: ThemeApplier | b99cafa | feat(12-03): add suppressed prop to ThemeApplier (MED-02 web client) |
| Task 2: layout.tsx | 0bbc70a | feat(12-03): gate layout.tsx inline style + ThemeApplier on DESIGNAGENT_SUPPRESSED (MED-01/MED-02 web server) |

## Verification

- `__tests__/machine-editorial-components.test.ts` — 5/5 PASS (ThemeApplier tripwires from Plan 12-01 Wave 0)
- `pnpm --filter web build` — exits 0; `/issue/[slug]` route builds cleanly with Server Component env read
- `git diff apps/web/lib/theme.ts` — no diff (READ-ONLY contract honored)
- layout.tsx contains no `serializeThemeCss(null)` call (only in comments) and no `BRAND_DEFAULTS` reference
- layout.tsx contains no `NEXT_PUBLIC_` variable (only in comment: "NEVER NEXT_PUBLIC_")
- 29 pre-existing failing tests (Phase 8 Stripe Wave 0 sentinels) remain unchanged — out-of-scope per SCOPE BOUNDARY

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both files are fully implemented. The suppression flag works end-to-end:
- Server reads env var → determines suppressed boolean
- suppressed=true → themeCss='' → inline style injects nothing → globals.css :root dark palette wins
- suppressed=true → ThemeApplier.useEffect early-returns → applyTheme not called
- Flipping DESIGNAGENT_SUPPRESSED=false + redeploy restores per-issue theming with zero code change

## Key-Decisions

- Empty string `''` (not `serializeThemeCss(null)`) is the suppression path for inline CSS — avoids BRAND_DEFAULTS regression
- `suppressed` prop is optional so no existing callers break
- Server Component reads env at request time — no rebuild required to flip the flag

## Self-Check: PASSED
