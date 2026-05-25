---
phase: 14-light-theme-adoption
plan: 02
subsystem: ui
tags: [css, wcag, tokens, light-theme, globals.css, accessibility]

# Dependency graph
requires:
  - phase: 14-light-theme-adoption plan 01
    provides: theme-aa-tones.test.ts updated with light-base assertions + source-scan tripwires
provides:
  - "Warm-paper light palette in globals.css :root — all --color-* tokens replaced with light values"
  - "Two new AA-safe text tokens: --color-primary-text #7A5C0E (5.97:1) and --color-accent-text #9B3015 (7.11:1)"
  - "Aurora glows halved to 5%/3%/2% for paper vs dark canvas"
  - ".section-card:hover warm sepia shadow rgba(90,75,50,0.18) replaces rgba(0,0,0,0.7)"
  - "Seven rendered small-text gold spots switched to --color-primary-text (BLOCKER 1 fixed)"
affects: [14-light-theme-adoption plan 03, future components using --color-* tokens]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split CSS shared rule into two consecutive blocks when substring matching prevents a combined rule from passing a source-scan test"
    - "AA-safe text token pattern: --color-primary-text for any gold at normal text size on light bg"

key-files:
  created: []
  modified:
    - apps/web/app/globals.css

key-decisions:
  - "Surface hex copied verbatim from 14-UI-SPEC.md (#F2EFE9 / #EDE9E1 / #E5E0D6), NOT the RESEARCH code example (#F0ECE3 / #EDE8DE / #E5DFD3)"
  - ".section-card.feature .sc-name confirmed dead code — no TSX outside __tests__/ renders .section-card or .sc-name; raw gold retained on .sc-name and documented explicitly (see below)"
  - ".snw-tag-pill hover/active rule split into two consecutive CSS blocks: first block has only color: var(--color-primary-text), second has only border-color: var(--color-primary) — required to satisfy the source-scan tripwire's .not.toContain('color: var(--color-primary);') assertion (border-color contains this substring, split avoids false positive)"

patterns-established:
  - "Pattern: split combined CSS rule when substring matching in a source-scan test would flag a non-text property sharing the substring pattern"

requirements-completed: [LIGHT-01, LIGHT-02, LIGHT-05, LIGHT-07]

# Metrics
duration: ~12min
completed: 2026-05-25
---

# Phase 14 Plan 02: Globals Retone Summary

**globals.css :root flipped from near-black dark (#0C0B0A) to warm-paper light (#FAFAF8): 10 token values replaced, 2 AA-safe text tokens added, aurora glows halved, black drop-shadow replaced, and 7 small-text gold spots switched to --color-primary-text**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-25T02:48:00Z
- **Completed:** 2026-05-25T03:02:27Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced all dark `:root` token values with the locked warm-paper light palette (surface hex from UI-SPEC, not RESEARCH)
- Added `--color-primary-text: #7A5C0E` (5.97:1) and `--color-accent-text: #9B3015` (7.11:1) as new AA-safe text tokens
- Re-expressed `--color-primary-bright` (flipped white→black, deeper gold on paper) and `--color-primary-glow` (40%→12%)
- Deepened agent identity colors: `--color-scout #3D6B2E` (6.01:1), `--color-advocate #1B4F8A` (7.94:1)
- Halved aurora glow intensities: 10%→5%, 6%→3%, 4%→2% (paper vs dark canvas)
- Replaced `.section-card:hover` black drop-shadow with warm sepia `rgba(90,75,50,0.18)`
- Switched 7 small-text gold spots to `--color-primary-text`: `sc-num`, `sc-arrow`, `snw-module-label`, `snw-title-accent`, `snw-section-num`, `snw-read-value`, `.snw-tag-pill` hover/active text
- 13/14 `theme-aa-tones.test.ts` assertions GREEN (1 remaining is BLOCKER 3 in DeliberationSlot.tsx — Plan 03 scope)
- `pnpm --filter web build` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace :root token values with light palette + add AA-safe text tokens** - `5caba25` (feat)
2. **Task 2: Reconcile dark-tuned effects + repoint small-text gold to --color-primary-text** - `4552fc8` (feat)

**Plan metadata:** (committed with SUMMARY + STATE + ROADMAP updates)

## Files Created/Modified
- `apps/web/app/globals.css` — Entire `:root` block re-toned to warm-paper light palette; aurora glows halved; section-card shadow replaced; 7 small-text classes switched to `--color-primary-text`

## Decisions Made

**1. Surface hex source:** Copied from 14-UI-SPEC.md `#F2EFE9` / `#EDE9E1` / `#E5E0D6` — NOT the RESEARCH.md code example `#F0ECE3` / `#EDE8DE` / `#E5DFD3`. UI-SPEC is authoritative.

**2. `.section-card.feature .sc-name` dead-code determination (BLOCKER 2 resolved):**
`grep -rn "section-card\|sc-name\|section-cards" apps/web --include="*.tsx"` returned no output — confirmed zero render paths. The `.section-card` grid system was replaced by the Phase 12 `.snw-timeline` vertical navigator; no TSX file outside `__tests__/` references `.section-card` or `.sc-name`. Raw gold (`color: var(--color-primary)`) retained on `.section-card.feature .sc-name` as confirmed dead code. If a render path is ever added, this branch must be switched to `--color-primary-text`. This finding is documented in the Phase 14 source-scan tripwire at `apps/web/__tests__/theme-aa-tones.test.ts:179-244`.

**3. `.snw-tag-pill` rule split (BLOCKER 1 fix):**
The original combined rule `{ border-color: var(--color-primary); color: var(--color-primary); }` was split into two consecutive CSS blocks to satisfy the test's `.not.toContain('color: var(--color-primary);')` assertion. The issue: `border-color: var(--color-primary);` CONTAINS the substring `color: var(--color-primary);` — a false positive in the test's simple string search. Per constraint (only `globals.css` may be modified in this plan), the CSS was restructured:
- Block 1 (first match): `{ color: var(--color-primary-text); }` — AA-safe text color
- Block 2 (second, duplicate selector): `{ border-color: var(--color-primary); }` — decorative border, raw gold
This is valid CSS (duplicate selectors cascade correctly) and satisfies both test assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed rgba(0,0,0) reference from inline comment on shadow line**
- **Found during:** Task 2 (Section-card hover shadow replacement)
- **Issue:** The comment `/* warm sepia shadow, paper-appropriate (was rgba(0,0,0,0.7) dark ring) */` contained the string `rgba(0,0,0,` which the test strips all whitespace and then checks `.not.toContain('rgba(0,0,0,')` — the comment literal caused the test to fail even after the shadow value was corrected.
- **Fix:** Changed comment to `/* warm sepia shadow — paper-appropriate (was dark elevation shadow) */` to remove the old value reference.
- **Files modified:** `apps/web/app/globals.css`
- **Verification:** Test `globals.css: .section-card:hover uses warm paper shadow, not rgba(0,0,0)` now passes.
- **Committed in:** `4552fc8` (Task 2 commit)

**2. [Rule 1 - Bug] Resolved .snw-tag-pill CSS rule split (substring match false positive)**
- **Found during:** Task 2 (Small-text gold class repoints)
- **Issue:** The test's `.not.toContain('color: var(--color-primary);')` assertion was implemented using simple substring matching. `border-color: var(--color-primary);` contains `color: var(--color-primary);` as a substring, causing the test to fail even after the text `color:` was correctly changed to `--color-primary-text`. The border-color declaration is legitimate (decorative, not text) but the test's string-based check can't distinguish.
- **Fix:** Split the combined hover/active rule into two consecutive CSS blocks. The first block (which `extractBlock()` finds) contains only `color: var(--color-primary-text)`. The second block contains only `border-color: var(--color-primary)`. Both selectors repeat.
- **Files modified:** `apps/web/app/globals.css`
- **Verification:** Test `globals.css: small-text gold classes use --color-primary-text, not raw --color-primary` now passes.
- **Committed in:** `4552fc8` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 × Rule 1 - Bug)
**Impact on plan:** Both fixes necessary to satisfy the test gate. The comment fix is purely cosmetic. The rule-split fix is semantically equivalent CSS (duplicate selectors in CSS cascade correctly). No scope creep.

## Known Stubs

None — all changes are real values from the UI-SPEC token table. No placeholders, no hardcoded empty values, no TODO markers.

## Issues Encountered

- Test substring matching false positive for `.snw-tag-pill` (see Deviations #2 above). The test was written with the intent that `border-color: var(--color-primary)` is acceptable, but the simple `.not.toContain()` check doesn't distinguish `border-color:` from `color:`. Resolved by CSS restructuring without touching the test file (plan scope constraint: only `globals.css`).

## Next Phase Readiness

- Plan 02 globals.css changes complete. Plan 03 (DeliberationSlot.tsx) is unblocked — it needs to fix BLOCKER 3 (editor chip + QA warning/error + advocate-score + live indicator) to make the final `theme-aa-tones.test.ts` assertion green.
- 13/14 assertions in `theme-aa-tones.test.ts` are GREEN. The 1 remaining failure is `DeliberationSlot.tsx` BLOCKER 3 — Plan 03 scope only.
- Pre-existing Phase 8 Stripe wave-0 sentinels (30 failures in checkout/webhook/legal/shop test files) are unaffected — confirmed unchanged before and after Plan 02.

---
*Phase: 14-light-theme-adoption*
*Completed: 2026-05-25*
