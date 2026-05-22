---
phase: 12
plan: "04"
subsystem: apps/web
tags: [navigator, css, vertical-timeline, reading-progress, reduced-motion, MED-04]
dependency_graph:
  requires: [12-01]
  provides: [SectionNavigator Vertical Timeline, Phase 12 CSS classes]
  affects: [apps/web/components/issue/SectionNavigator.tsx, apps/web/app/globals.css]
tech_stack:
  added: []
  patterns:
    - IntersectionObserver reading-progress (scroll-driven section tracking)
    - --mx/--my radial cursor glow (preserved from Phase 11)
    - CSS custom property spine fill via --spine-progress
    - prefers-reduced-motion early-return (JS) + 0.01ms transition guard (CSS)
key_files:
  created: []
  modified:
    - apps/web/components/issue/SectionNavigator.tsx
    - apps/web/app/globals.css
decisions:
  - "renderTitle() splits title on italicWord and wraps in <em> — plain fallback if word absent or not found"
  - "spine fill via inline style + CSS var (--spine-progress) set by scroll listener on navRef"
  - "activeSection state drives both node .active class and READ STATUS percentage (0%/100%)"
  - "readFileSync pattern + comment-stripping in machine-editorial-components.test.ts preserved"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-05-22"
  tasks: 2
  files: 2
requirements: [MED-04]
---

# Phase 12 Plan 04: Section Navigator Vertical Timeline Summary

Rebuilt `SectionNavigator.tsx` from the Phase 11 4-column card grid into the board's Vertical Timeline (MED-04): full-height spine, 8 node-dot rows with `§ NN` numbers, Cormorant titles with one `<em>` italic word, Lora subtitles, and a right-aligned Inter `READ STATUS: N%` machine-readout. Also added BOTH Phase 12 CSS blocks (navigator + deliberation flow-line) to `globals.css` under a single Phase 12 banner, so Plan 05 only touches `DeliberationSlot.tsx`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Phase 12 navigator + flow-line CSS blocks to globals.css | af015c8 | apps/web/app/globals.css |
| 2 | Rebuild SectionNavigator.tsx to the Vertical Timeline (MED-04) | fc87001 | apps/web/components/issue/SectionNavigator.tsx |

## What Was Built

**Task 1 — globals.css Phase 12 additions (additive only):**
- Phase 12 banner: `/* ═══ PHASE 12 — MACHINE EDITORIAL DESIGN ADOPTION (MED-04 navigator + MED-05 flow) ═══ */`
- Full Navigator Vertical Timeline block: `.snw-timeline`, `.snw-module-label`, `.snw-title-plain`, `.snw-title-accent`, `.snw-spine`, `.snw-spine-line`, `.snw-spine-progress`, `.snw-node`, `.snw-node.active`, `.snw-section-num`, `.snw-row`, `.snw-row:first-child`, `.snw-row::before`, `.snw-row:hover::before`, `.snw-row:hover`, `.snw-row.active`, `.snw-content`, `.snw-tag-pill`, `.snw-row:hover .snw-tag-pill`, `.snw-row.active .snw-tag-pill`, `.snw-section-title`, `.snw-section-title em`, `.snw-subtitle`, `.snw-read-status`, `.snw-read-label`, `.snw-read-value`, `.snw-read-dash`, and `@media (max-width: 480px)` override.
- Full DeliberationSlot Flow Line block: `.del-flow`, `.del-flow-node`, `.del-flow-circle`, `.del-flow-connector`, `.del-flow-label`, `.del-flow-action`, `.del-confidence-bar-track`, `.del-confidence-bar-fill`, and winner-glow comment.
- Zero new hex literals; all colors via existing `--color-*` tokens.

**Task 2 — SectionNavigator.tsx Vertical Timeline:**
- `SectionCard` interface extended with `subtitle?: string` and `italicWord?: string`; `wide?`/`feature?` dropped (unused in timeline).
- CARDS array populated with all 8 canonical hrefs + editorial titles, tags, subtitles, and italicWords per UI-SPEC Copywriting Contract.
- `renderTitle()` helper splits title string on `italicWord` and wraps that token in `<em>`; renders plain if absent or not found.
- Effect 1 (cursor glow): reads `prefers-reduced-motion` inside `useEffect`; early-returns if set; attaches `mousemove` to each `.snw-row` setting `--mx`/`--my` percentages; returns cleanup.
- Effect 2 (reading progress): `IntersectionObserver` (threshold 0.3) calls `setActiveSection(entry.target.id)` on intersection; scroll listener sets `--spine-progress` on `navRef` as percentage fraction; both cleanup on unmount.
- JSX structure: header block (`snw-module-label` + `snw-title-plain` / `snw-title-accent`), `snw-timeline` container, 8 `snw-row` anchors each containing `snw-spine` (spine-line, spine-progress, node dot, section-num), `snw-content` (tag-pill, section-title, subtitle), `snw-read-status` (read-label, read-value, read-dash).
- Outer `<nav className="section-navigator">` preserved (print block still hides it).
- No `<main>` tag; no `role="main"`; no hardcoded hex.

## Verification Results

- `pnpm --filter web test:unit -- machine-editorial-components`: **5/5 PASS** (all MED-04/MED-05 tripwires green)
- `pnpm --filter web test:unit`: **173 pass / 29 fail** (29 failures are pre-existing Phase 8 Stripe/Commerce sentinels — out of scope)
- All in-scope tripwires green: `machine-editorial-components`, `issue-page-typography`, `theme-aa-tones`, `site-header-nav`, `game-sandbox`, `motion-polish`, `archive-cardswap`
- `pnpm --filter web build`: **exits 0**

## Acceptance Criteria Check

- [x] All 8 canonical hrefs present: `#origin-story`, `#problem`, `#founder-bio`, `#case-study`, `#game`, `#bonus`, `#deliberation`, `#podcast`
- [x] `prefers-reduced-motion` early-return preserved
- [x] `IntersectionObserver` and `--mx` present
- [x] `snw-timeline`, `snw-row`, `snw-node`, `snw-section-num`, `snw-read-status`, `snw-module-label` all present
- [x] `subtitle` and `italicWord` fields on SectionCard interface
- [x] `className="section-navigator"` on outer `<nav>`; no `<main>` tag
- [x] No hardcoded hex color in SectionNavigator.tsx
- [x] globals.css contains `Phase 12 MED-04` and `Phase 12 MED-05` banner comments
- [x] globals.css contains `.snw-timeline`, `.snw-spine-progress`, `.snw-node.active`, `.snw-row::before`, `.snw-read-value`, `.del-flow`, `.del-confidence-bar-track`
- [x] No new hex literals in Phase 12 CSS block
- [x] Existing `.section-card` / `.pitch-card-list` / `:root` declarations untouched (git diff shows additions only at end of file)
- [x] SectionNavigator.tsx: 290 lines (min_lines 150 requirement satisfied)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The reading-progress READ STATUS value is 0% for non-active sections and 100% for the active section — this is a simplified but functional implementation consistent with the spec's planner discretion guidance ("planner may render 0% for all and only the active row as 100%/in-progress per discretion").

## Self-Check

- [x] `apps/web/components/issue/SectionNavigator.tsx` — FOUND
- [x] `apps/web/app/globals.css` — FOUND (Phase 12 block appended)
- [x] Commit `af015c8` — FOUND (globals.css Phase 12 CSS)
- [x] Commit `fc87001` — FOUND (SectionNavigator rebuild)
- [x] `machine-editorial-components.test.ts` — 5/5 PASS
- [x] `pnpm --filter web build` — exits 0

## Self-Check: PASSED
