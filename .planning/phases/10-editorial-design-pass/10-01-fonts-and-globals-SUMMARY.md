---
phase: 10-editorial-design-pass
plan: 01
subsystem: ui
tags: [typography, css, next-font, tailwind-v4, editorial-design, theme]

# Dependency graph
requires:
  - phase: 02-web-shell-theme-engine
    provides: "Playfair Display + Lora next/font/google imports, :root --color-* / --font-* CSS variables, @theme block, FONT_WHITELIST in lib/theme.ts"
  - phase: 07-game-rendering
    provides: "Vitest unit test infrastructure (game-sandbox.test.ts + game-validator.test.ts) — used as a regression guard for this plan"
provides:
  - "Playfair Display weight subsets [400, 600, 700] (was [600] only) — drop-cap, headlines, emphasis"
  - "Lora weight subsets [400, 500, 700] + italic style (was [400] only) — body prose, emphasized runs, strong marks, em + sidebar italics"
  - ".prose-measure utility (max-width 68ch, padded gutters) — readable measure on desktop"
  - ".drop-cap utility (3.5em first-letter on first <p>, 3em on <=360px screens) — editorial section opener"
  - ".ornament-divider utility (centered FLEURON U+2766 ❦) — between-section separator"
  - ".eyebrow utility (small-caps section label) — UI font, 0.18em letter-spacing"
  - ".metadata-block utility (case-study sidebar with accent border + tabular-nums) — structured stat display"
affects:
  - 10-02-issue-page-redesign  # consumes the five utilities for component-level rewrite
  - 10-03-visual-regression-tests  # tests the new utilities against rendered output

# Tech tracking
tech-stack:
  added: []  # no new libraries — pure CSS + next/font/google subset config
  patterns:
    - "Theme-variable-only utility classes — all colors via var(--color-*), all fonts via var(--font-*), so per-issue theme injection from Phase 2 still drives palette"
    - "Unicode-escape CSS content for editorial ornaments (\\2766 FLEURON) — no SVG, no image asset, no extra HTTP request"
    - "Append-only globals.css edits guarded by section-banner comment — Phase 10 utility block lives at EOF, separated from Phase 2 :root + @theme + html/body/print/shadcn-shim rules which are NOT touched"

key-files:
  created: []
  modified:
    - "apps/web/app/layout.tsx — Playfair Display + Lora weight subset extension (13 lines diff)"
    - "apps/web/app/globals.css — 5 new typography utility classes appended (105 lines added)"

key-decisions:
  - "Drop cap uses font-weight 400 (not 600) — large + light reads as editorial restraint per plan rationale; matches print-magazine convention"
  - "Ornament is FLEURON U+2766 (❦) — encoded as \\2766 in CSS content rather than image/SVG; no extra HTTP load, scales naturally with display font"
  - "Drop-cap mobile fallback at 360px breakpoint — narrowest supported viewport per Phase 2 UI-SPEC; size reduced 3.5em→3em to prevent first-line overflow"
  - "All five utilities reference existing CSS variables (--color-primary/text/accent + --font-display/body/ui) — preserves Phase 2's per-issue theme injection contract without re-validation"
  - "Inter (--font-ui-loaded) intentionally untouched — UI font is locked at 400/600 per Phase 2 UI-SPEC; not subject to editorial typography redesign"

patterns-established:
  - "Phase 10 utility block lives at EOF in globals.css behind a ═══ banner — Plan 10-02 components consume by class name only, no inline styles"
  - "Font weight rationale documented inline above each next/font/google block — future weight changes have explicit per-weight justification in the code"

requirements-completed:
  - DES-01
  - DES-03
  - DES-04

# Metrics
duration: 5min
completed: 2026-05-19
---

# Phase 10 Plan 01: Fonts and Globals Summary

**Editorial typography foundation: extended Playfair Display + Lora next/font/google subsets to support drop-cap, italic, and emphasis weights, and shipped five named CSS utilities (.prose-measure, .drop-cap, .ornament-divider, .eyebrow, .metadata-block) that Plan 10-02 will consume by class name.**

## Performance

- **Duration:** ~5 min (311 seconds from start to final commit)
- **Started:** 2026-05-19T11:54:09Z
- **Completed:** 2026-05-19T11:59:20Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- **Font subset extension complete.** Playfair Display now ships 400/600/700; Lora ships 400/500/700 + italic. All subsets are bundled at build time by next/font/google — zero HTTP font loads. `pnpm --filter web build` succeeds (Next compiles + subsets the new weights in 11.1s).
- **Five named typography utilities published.** `.prose-measure` (68ch + responsive gutters), `.drop-cap` (3.5em first-letter w/ 360px fallback), `.ornament-divider` (FLEURON U+2766), `.eyebrow` (small-caps label), `.metadata-block` (case-study sidebar w/ tabular-nums) — all reference existing CSS variables so per-issue theme injection still drives palette.
- **Phase 2 theme contract preserved.** No modification to `@theme` block, `:root --color-*` values, html/body/h1-h3/focus-visible/@media-print/shadcn-shim rules. Only additive utility block at EOF.
- **Zero new font loaders.** `grep -r fonts.googleapis.com apps/web` returns 0. No new @import, no @font-face, no client-side font shims.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend next/font/google weight subsets in layout.tsx** — `002bc3e` (feat)
2. **Task 2: Add typography utilities to globals.css** — `8285f24` (feat)

## Files Created/Modified

- `apps/web/app/layout.tsx` — Extended Playfair Display weight to `['400','600','700']` (was `['600']`); extended Lora weight to `['400','500','700']` and added `style: ['normal','italic']` (was `weight: ['400']` only). Inter unchanged. Variable names (`--font-display-loaded`, `--font-body-loaded`, `--font-ui-loaded`) preserved.
- `apps/web/app/globals.css` — Appended 105-line Phase 10 utility block at EOF (after shadcn shim, before EOF). Five new classes: `.prose-measure`, `.drop-cap` (+ 360px media query), `.ornament-divider` (+ `::before` content), `.eyebrow`, `.metadata-block` (+ `dt`/`dd` rules). All colors via `var(--color-*)`, all fonts via `var(--font-*)`. Pre-existing rules untouched.

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- Drop cap weight 400 (editorial restraint); ornament U+2766 (no SVG); 360px mobile size fallback (3em); theme-variable-only colors; Inter UI font untouched.

## Deviations from Plan

Plan executed as written. One scope-boundary observation documented below for traceability:

### Out-of-Scope (Deferred Items)

**1. Phase 8 Wave 0 sentinel tests — pre-existing, NOT regressed**

- **Observed during:** Task 2 verification (`pnpm --filter web test:unit`)
- **State:** 37 pass / 29 fail, both BEFORE and AFTER this plan's edits (confirmed via `git stash` round-trip diff)
- **Source:** Phase 8 Plan 08-01 deliberately planted Wave 0 sentinel tests that fail until Plans 08-04..08-07 land. See STATE.md Plan 08-01 entry: "Wave 0 sentinel confirmed — 10 test files total (2 Phase 7 + 8 Phase 8), 66 tests, 37 pass / 29 fail. CMR-09 passes 5/5 (Phase 2 ShopCallout inheritance). Other 7 Phase 8 files fail at runtime because target route handlers + stripe npm package don't exist yet; Plans 08-04 through 08-07 drive each green one-by-one."
- **Phase 10's contract (Phase 2 + Phase 7 tests):** 32/32 passing — game-sandbox.test.ts (3), game-validator.test.ts (24), issue-page-shop-callout.test.ts (5). No regression.
- **Decision:** NOT fixed (SCOPE BOUNDARY rule). Plan 10-01's responsibility is unchanged-test-count, not test-suite-greenness. Phase 8 owns these sentinels.

## Self-Check

Verification of claims made in this summary:

- File exists: `apps/web/app/layout.tsx` — FOUND
- File exists: `apps/web/app/globals.css` — FOUND
- Commit exists: `002bc3e` — FOUND
- Commit exists: `8285f24` — FOUND
- `pnpm --filter web build` exits 0 — PASS (Task 1 + Task 2)
- Phase 2 + Phase 7 test count unchanged (37 pass / 29 fail, identical before+after) — PASS
- `grep -r fonts.googleapis.com apps/web` = 0 — PASS

## Self-Check: PASSED
