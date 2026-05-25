---
phase: 14-light-theme-adoption
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/__tests__/theme-aa-tones.test.ts
autonomous: true
requirements: [LIGHT-03, LIGHT-04, LIGHT-05]
nyquist_compliant: true

must_haves:
  truths:
    - "theme-aa-tones.test.ts asserts every text/UI token passes WCAG AA on the new light base #FAFAF8"
    - "Raw gold #CDA434 is asserted BELOW AA on light (decorative-only); the two new -text tokens (#7A5C0E, #9B3015) are asserted to PASS AA"
    - "Source scans fail if .snw-*/.sc- 11px classes still use --color-primary (not --color-primary-text), if DeliberationSlot editor chip still uses raw gold text, or if rgba(0,0,0, appears in .section-card"
  artifacts:
    - path: "apps/web/__tests__/theme-aa-tones.test.ts"
      provides: "Light-base AA ratio assertions + source-scan tripwires (the Wave 0 test gate for Plans 02/03)"
      contains: "LIGHT_BG"
  key_links:
    - from: "apps/web/__tests__/theme-aa-tones.test.ts"
      to: "apps/web/lib/theme.ts contrastRatio()"
      via: "import { contrastRatio } from '@/lib/theme'"
      pattern: "contrastRatio\\("
    - from: "apps/web/__tests__/theme-aa-tones.test.ts"
      to: "apps/web/app/globals.css + components/issue/DeliberationSlot.tsx"
      via: "readFileSync source-scan tripwires"
      pattern: "readFileSync"
---

<objective>
Update the AA-contrast test file from the dark-base assertions (Phase 9) to the locked light-base assertions, and add the source-scan tripwires that gate the Plan 02 globals.css re-tone and the Plan 03 component reconciliation. This is the Wave 0 / TDD gate: the test must reflect the LIGHT target BEFORE the globals.css + component changes land, so the implementation is verified against the locked light-base ratios (14-VALIDATION.md Dimension 8).

Purpose: Encode the locked light-palette WCAG ratios + the no-raw-gold-as-text contract as executable assertions, so Plans 02/03 turn them green.
Output: Updated `apps/web/__tests__/theme-aa-tones.test.ts` (light-base AA assertions + new -text tokens + flipped raw-gold assertion + 3 source-scan tripwires).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/14-light-theme-adoption/14-UI-SPEC.md
@.planning/phases/14-light-theme-adoption/14-RESEARCH.md
@.planning/phases/14-light-theme-adoption/14-VALIDATION.md
@apps/web/__tests__/theme-aa-tones.test.ts
@apps/web/lib/theme.ts

<interfaces>
<!-- The test imports the existing WCAG math from theme.ts — do NOT reimplement it. -->
From apps/web/lib/theme.ts:
```typescript
export function contrastRatio(hexA: string, hexB: string): number
```
Existing test constants (keep AA, AA_LARGE; rename DARK_BG → LIGHT_BG):
```typescript
const AA = 4.5          // WCAG AA, normal text
const AA_LARGE = 3.0    // WCAG AA, large text (≥18px or ≥14px bold)
```
The current test asserts on DARK_BG = '#0C0B0A'. Phase 14 flips the whole describe block to LIGHT_BG = '#FAFAF8'.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Flip theme-aa-tones.test.ts to light-base AA assertions + add the two new -text tokens</name>
  <files>apps/web/__tests__/theme-aa-tones.test.ts</files>
  <read_first>
    - apps/web/__tests__/theme-aa-tones.test.ts (the file being rewritten)
    - .planning/phases/14-light-theme-adoption/14-UI-SPEC.md (§"theme-aa-tones.test.ts Target Ratios" table, lines ~297-319 — the authoritative new values)
    - .planning/phases/14-light-theme-adoption/14-RESEARCH.md (§"theme-aa-tones.test.ts target state" code block, lines ~363-418)
  </read_first>
  <action>
    Rewrite the contrast assertions in apps/web/__tests__/theme-aa-tones.test.ts to assert on the LIGHT base. Copy these EXACT values from 14-UI-SPEC.md — do not re-derive:

    1. Rename the constant `const DARK_BG = '#0C0B0A'` → `const LIGHT_BG = '#FAFAF8'`. Replace ALL usages of DARK_BG with LIGHT_BG. Keep `const AA = 4.5` and `const AA_LARGE = 3.0` unchanged.
    2. Rename the describe block from "Phase 9 house secondary tones — WCAG AA on dark bg (#0C0B0A)" → "Phase 14 house tones — WCAG AA on light bg (#FAFAF8)".
    3. Update the file's top doc-comment to say the test asserts light-base ratios on #FAFAF8 (Phase 14), not dark #0C0B0A.
    4. Replace each `it()` with these light-base assertions (exact hex + threshold per UI-SPEC table):
       - `--color-text #1A1A1A`: `expect(contrastRatio('#1A1A1A', LIGHT_BG)).toBeGreaterThan(15.0)` (16.65:1)
       - `--color-text-dim #595047`: assert `toBeGreaterThanOrEqual(AA)` AND `toBeGreaterThan(7.0)` (7.55:1)
       - `--color-text-mute #706860`: assert `toBeGreaterThanOrEqual(AA)` only — no >5 guard, it just clears (5.24:1)
       - `--color-scout #3D6B2E`: assert `toBeGreaterThanOrEqual(AA)` AND `toBeGreaterThan(5.5)` (6.01:1)
       - `--color-advocate #1B4F8A`: assert `toBeGreaterThanOrEqual(AA)` AND `toBeGreaterThan(7.0)` (7.94:1)
       - `--color-primary #CDA434` (gold): FLIP to `expect(contrastRatio('#CDA434', LIGHT_BG)).toBeLessThan(AA)` (2.24:1 — decorative only). Comment: "gold fails AA as text on light; use --color-primary-text for text."
       - `--color-accent #C2502A` (rust): assert `toBeGreaterThanOrEqual(AA_LARGE)` AND `toBeLessThan(AA)` (4.49:1 — large/UI use only).
    5. ADD two new `it()` assertions for the new -text tokens:
       - `--color-primary-text #7A5C0E`: `expect(contrastRatio('#7A5C0E', LIGHT_BG)).toBeGreaterThanOrEqual(AA)` (5.97:1). Comment: "gold darkened for text/link use".
       - `--color-accent-text #9B3015`: `expect(contrastRatio('#9B3015', LIGHT_BG)).toBeGreaterThanOrEqual(AA)` (7.11:1). Comment: "rust darkened for text/link use".
    6. Replace the rejected-value doc `it()`: was `#615B4D fails dark`. Now assert the DARK mute `#938A77` FAILS on light: `expect(contrastRatio('#938A77', LIGHT_BG)).toBeLessThan(AA)` (3.89:1). Comment: "the old dark --color-text-mute #938A77 fails AA on the light base; replaced by #706860."
  </action>
  <verify>
    <automated>cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "DARK_BG" apps/web/__tests__/theme-aa-tones.test.ts` == 0
    - `grep "LIGHT_BG = '#FAFAF8'" apps/web/__tests__/theme-aa-tones.test.ts` matches
    - `grep "contrastRatio('#1A1A1A', LIGHT_BG)" apps/web/__tests__/theme-aa-tones.test.ts` matches
    - `grep "contrastRatio('#7A5C0E', LIGHT_BG)" apps/web/__tests__/theme-aa-tones.test.ts` matches
    - `grep "contrastRatio('#9B3015', LIGHT_BG)" apps/web/__tests__/theme-aa-tones.test.ts` matches
    - `grep "contrastRatio('#CDA434', LIGHT_BG)).toBeLessThan(AA)" apps/web/__tests__/theme-aa-tones.test.ts` matches (raw gold flipped to below-AA)
    - `grep "contrastRatio('#938A77', LIGHT_BG)).toBeLessThan(AA)" apps/web/__tests__/theme-aa-tones.test.ts` matches (dark mute rejected on light)
    - `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` exits 0 (these are pure math assertions — they pass independently of globals.css since hex values are inline literals)
  </acceptance_criteria>
  <done>theme-aa-tones.test.ts asserts the locked light-base ratios; raw gold below-AA; the two new -text tokens pass AA; dark mute documented as failing on light; the file exits 0.</done>
</task>

<task type="auto">
  <name>Task 2: Add the three source-scan tripwires (no-raw-gold-as-text in CSS classes, editor chip, no rgba(0,0,0) in .section-card)</name>
  <files>apps/web/__tests__/theme-aa-tones.test.ts</files>
  <read_first>
    - apps/web/__tests__/theme-aa-tones.test.ts (after Task 1)
    - apps/web/app/globals.css (the .snw-* / .sc-* / .section-card classes the scan targets — confirm current literals)
    - apps/web/components/issue/DeliberationSlot.tsx (agentChipStyle editor branch + QA_SEVERITY — confirm current literals)
    - .planning/phases/14-light-theme-adoption/14-VALIDATION.md (§"Wave 0 Requirements" source-scan bullets, lines ~58-61)
    - apps/web/__tests__/game-sandbox.test.ts (the readFileSync source-scan PATTERN to mirror — same repo convention)
  </read_first>
  <action>
    Append a new `describe('Phase 14 source-scan tripwires', ...)` block to apps/web/__tests__/theme-aa-tones.test.ts. Mirror the existing repo source-scan pattern (readFileSync + grep at test runtime, inside each it() body so collection never throws — see game-sandbox.test.ts and the Phase 9 note in STATE.md: readFileSync must be inside each it()). Use `readFileSync(resolve(__dirname, '..', 'app/globals.css'), 'utf8')` and the DeliberationSlot path. Import `readFileSync` from 'node:fs' and `resolve` from 'node:path'.

    Add exactly these three tripwires (they will be RED until Plans 02/03 land — that is the intended TDD gate):

    1. `it('globals.css: small-text gold classes use --color-primary-text, not raw --color-primary')`:
       Read globals.css. For each of these six selectors, assert the declaration block uses `--color-primary-text` and NOT `color: var(--color-primary)`: `.snw-section-num`, `.snw-module-label`, `.snw-read-value`, `.snw-title-accent`, `.sc-num`, `.sc-arrow`.
       Implementation: a robust approach is to assert `expect(css).toContain('color: var(--color-primary-text)')` AND assert the count of small-text gold misuse is gone. Concretely: write a helper that extracts each selector's block (substring from the selector name to the next `}`) and asserts it does NOT contain `color: var(--color-primary);` (the trailing semicolon distinguishes the `color:` declaration from `border-color:`/`background:` uses). Assert each of the six blocks instead references `var(--color-primary-text)`.
       NOTE FOR EXECUTOR: do NOT assert on `.sc-name` (27px display title), `.drop-cap` (decorative large glyph), border-color declarations, or `.section-card.feature` — those legitimately keep raw `--color-primary` and are OUT of this scan. Scope the scan to the six named selectors only.

    2. `it('DeliberationSlot.tsx: editor agent chip + QA warning/error use AA-safe -text variants')`:
       Read DeliberationSlot.tsx. Assert:
       - The `agentChipStyle` editor branch uses `'var(--color-primary-text)'` for `color` (not `'var(--color-primary)'`).
       - `QA_SEVERITY.warning.color` is `'var(--color-primary-text)'` (not `'var(--color-primary)'`).
       - `QA_SEVERITY.error.color` is `'var(--color-accent-text)'` (not `'var(--color-accent)'`).
       Use targeted substring assertions, e.g. `expect(tsx).toContain("warning: { color: 'var(--color-primary-text)'")` (allow for whitespace variance — prefer a normalized-whitespace check or a regex that tolerates spacing).

    3. `it('globals.css: .section-card hover shadow uses warm paper shadow, not rgba(0,0,0)')`:
       Read globals.css. Extract the `.section-card:hover` block. Assert it does NOT contain `rgba(0, 0, 0` (any spacing) and DOES contain `rgba(90, 75, 50, 0.18)`.
       Implementation tolerant of spacing: strip spaces inside the rgba() args before comparing, or assert `cssNoSpace.includes('rgba(90,75,50,0.18)')` and `!cssNoSpace.includes('rgba(0,0,0,0.7)')` where `cssNoSpace = css.replace(/\s+/g, '')`.
  </action>
  <verify>
    <automated>cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts 2>&1 | grep -E "Phase 14 source-scan|passed|failed"</automated>
  </verify>
  <acceptance_criteria>
    - `grep "Phase 14 source-scan tripwires" apps/web/__tests__/theme-aa-tones.test.ts` matches
    - `grep "readFileSync" apps/web/__tests__/theme-aa-tones.test.ts` matches
    - `grep -- "--color-primary-text" apps/web/__tests__/theme-aa-tones.test.ts` matches (scan references the AA-safe token)
    - `grep -- "--color-accent-text" apps/web/__tests__/theme-aa-tones.test.ts` matches
    - `grep "rgba(90, 75, 50, 0.18)\|rgba(90,75,50,0.18)" apps/web/__tests__/theme-aa-tones.test.ts` matches
    - The three new tripwires are RED now (globals.css + DeliberationSlot not yet changed) — confirm by running and seeing exactly the 3 new source-scan it() blocks failing while the contrast it() blocks pass: `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` reports failures only in the "Phase 14 source-scan tripwires" describe.
  </acceptance_criteria>
  <done>Three source-scan tripwires exist and are RED (intended) until Plans 02/03 land; the contrast assertions from Task 1 stay green. The file is the Wave 0 gate for the re-tone.</done>
</task>

</tasks>

<verification>
- `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` — contrast it() blocks PASS (pure math); the 3 source-scan tripwires are RED until Plans 02/03 land (intended TDD gate).
- No DARK_BG references remain; LIGHT_BG = '#FAFAF8' is the only base constant.
- theme.ts is NOT modified (only the test file imports contrastRatio).
</verification>

<success_criteria>
- theme-aa-tones.test.ts asserts the locked light-base ratios verbatim from 14-UI-SPEC.md (LIGHT-03).
- The two new -text tokens are asserted to pass AA; raw gold asserted below AA (LIGHT-03).
- Source-scan tripwires encode the no-raw-gold-as-text class contract (LIGHT-05), the editor chip + QA warning/error -text contract (LIGHT-04), and the no-rgba(0,0,0)-in-.section-card contract (LIGHT-05).
- No new npm dependency; theme.ts untouched.
</success_criteria>

<output>
After completion, create `.planning/phases/14-light-theme-adoption/14-01-SUMMARY.md`
</output>
