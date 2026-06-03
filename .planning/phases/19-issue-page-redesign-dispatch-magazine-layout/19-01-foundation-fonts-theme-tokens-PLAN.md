---
phase: 19-issue-page-redesign-dispatch-magazine-layout
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/package.json
  - apps/web/app/layout.tsx
  - apps/web/lib/theme.ts
  - apps/web/app/globals.css
  - apps/web/__tests__/theme-aa-tones.test.ts
  - apps/web/__tests__/issue-page-dispatch.test.ts
autonomous: true
requirements: [P19-02, P19-03, P19-06, DES-01, WEB-07, WEB-08, WEB-09, AGT-14]
must_haves:
  truths:
    - "Fraunces, Newsreader, and IBM Plex Mono load via next/font/google (no runtime HTTP font fetch)"
    - "FONT_WHITELIST contains all 9 fonts including the 3 new ones"
    - "BRAND_DEFAULTS resolves to oxblood/cream when no theme is supplied"
    - "serializeThemeCss and applyTheme emit --color-bg and --color-text"
    - "globals.css :root carries the oxblood/cream palette + new structural tokens"
    - "framer-motion is an installed dependency"
    - "All existing tests stay green; theme-aa-tones asserts the new palette"
  artifacts:
    - path: "apps/web/lib/theme.ts"
      provides: "Oxblood/cream BRAND_DEFAULTS, 9-entry FONT_WHITELIST, extended serializeThemeCss + applyTheme"
      contains: "Fraunces"
    - path: "apps/web/app/layout.tsx"
      provides: "Fraunces/Newsreader/IBM_Plex_Mono next/font wiring (sitewide)"
      contains: "IBM_Plex_Mono"
    - path: "apps/web/app/globals.css"
      provides: "oxblood/cream :root tokens + structural tokens (--color-prose, --color-surface-accent, --color-accent-deep)"
      contains: "--color-prose"
    - path: "apps/web/__tests__/issue-page-dispatch.test.ts"
      provides: "Phase 19 source-scan tripwires (fonts, whitelist, suppression-off, framer-motion, a11y attrs)"
      min_lines: 40
  key_links:
    - from: "apps/web/app/layout.tsx"
      to: "apps/web/app/globals.css"
      via: "--font-display-loaded / --font-body-loaded / --font-ui-loaded CSS variables"
      pattern: "font-display-loaded"
    - from: "apps/web/lib/theme.ts serializeThemeCss"
      to: "--color-bg / --color-text"
      via: "validated palette serialization"
      pattern: "--color-bg"
---

<objective>
Lay the sitewide foundation for the Dispatch redesign: swap the three fonts (Fraunces / Newsreader / IBM Plex Mono), retoken the palette to oxblood/cream, extend the theme engine to emit per-issue bg+text, install framer-motion, and update the test gate. This is the Wave 0 + foundation plan — it must land before any component work and must keep the 259-test baseline green (with `theme-aa-tones.test.ts` UPDATED to the new palette).

Purpose: Every downstream plan depends on these fonts, tokens, and the framer-motion dependency. The theme.ts security invariants (hex regex, FONT_WHITELIST membership, WCAG AA gate, setProperty-only) MUST remain intact — this plan extends, never weakens, them.
Output: Updated theme.ts, layout.tsx, globals.css; installed framer-motion; new tripwire test file; updated AA-tones test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md
@.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-RESEARCH.md

<interfaces>
Current theme.ts surface (apps/web/lib/theme.ts) — EXTEND, do not rewrite:
- `export const FONT_WHITELIST = Object.freeze([...] as const)` — 6 entries today
- `export type WhitelistedFont = (typeof FONT_WHITELIST)[number]`
- `export const BRAND_DEFAULTS = Object.freeze({ bg, text, primary, accent, fontDisplay, fontBody, fontUi } as const)`
- `resolvePalette(theme): ResolvedPalette` — already computes `p.bg` and `p.text`
- `serializeThemeCss(theme): string` — currently emits --color-accent, --color-primary, --font-body, --font-display ONLY
- `applyTheme(element, theme): void` — currently sets --color-primary, --color-accent, --font-display, --font-body via setProperty

Current layout.tsx font wiring (apps/web/app/layout.tsx lines 11, 22-50):
- `import { Playfair_Display, Lora, Inter } from 'next/font/google'`
- exposes `--font-display-loaded`, `--font-body-loaded`, `--font-ui-loaded` via `.variable`
- `<html className={`${fontDisplay.variable} ${fontBody.variable} ${fontUi.variable}`}>`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install framer-motion + swap fonts in layout.tsx</name>
  <read_first>
    - apps/web/app/layout.tsx (current Playfair/Lora/Inter wiring, lines 11, 22-50, 86-103)
    - apps/web/package.json (dependency list, scripts)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (§Font Loading Contract lines 52-87)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-RESEARCH.md (Pattern 2 + Pitfall 7 + Pitfall 8: IBM_Plex_Mono identifier, axes:['opsz'])
  </read_first>
  <action>
    1. Install framer-motion at ^12.40.0: run `pnpm --filter web add framer-motion`. Confirm it lands in apps/web/package.json dependencies.
    2. In apps/web/app/layout.tsx, replace the `import { Playfair_Display, Lora, Inter } from 'next/font/google'` line with `import { Fraunces, Newsreader, IBM_Plex_Mono } from 'next/font/google'`.
    3. Replace the three font constants verbatim with the UI-SPEC §Font Loading Contract:
       - `const fontDisplay = Fraunces({ subsets: ['latin'], display: 'swap', variable: '--font-display-loaded', axes: ['opsz'], weight: ['300','400','500','600'], style: ['normal','italic'] })`
       - `const fontBody = Newsreader({ subsets: ['latin'], display: 'swap', variable: '--font-body-loaded', axes: ['opsz'], weight: ['300','400','500'], style: ['normal','italic'] })`
       - `const fontUi = IBM_Plex_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-ui-loaded', weight: ['400','500'] })` (NO axes — IBM Plex Mono is not a variable font).
    4. Leave the `<html className={`${fontDisplay.variable} ${fontBody.variable} ${fontUi.variable}`}>` line unchanged — the `.variable` names are identical so no consumer changes.
    5. Update the `viewport.themeColor` value from `'#FAFAF8'` to `'#FBFAF6'` (cream brand bg).
    Do NOT change SiteHeader/SiteFooter/skip-link/main structure.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck 2>&1 | tail -5; grep -c "framer-motion" package.json</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Fraunces\|Newsreader\|IBM_Plex_Mono" apps/web/app/layout.tsx` returns 3 or more
    - `grep -c "Playfair_Display\|Lora\|Inter" apps/web/app/layout.tsx` returns 0
    - `grep "framer-motion" apps/web/package.json` matches a dependency entry
    - `grep "axes: \['opsz'\]" apps/web/app/layout.tsx` matches (Fraunces + Newsreader)
    - `grep "'#FBFAF6'" apps/web/app/layout.tsx` matches (themeColor)
    - `pnpm --filter web typecheck` exits 0
  </acceptance_criteria>
  <done>framer-motion installed; layout.tsx loads Fraunces/Newsreader/IBM Plex Mono with opsz axes; typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 2: Extend theme.ts — FONT_WHITELIST, BRAND_DEFAULTS, serializeThemeCss + applyTheme emit bg/text</name>
  <read_first>
    - apps/web/lib/theme.ts (FULL FILE — FONT_WHITELIST lines 48-55, BRAND_DEFAULTS 67-75, resolvePalette 229-269, serializeThemeCss 295-307, applyTheme 338-383)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (§New BRAND_DEFAULTS lines 166-182, FONT_WHITELIST additions lines 82-87)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-RESEARCH.md (Pattern 3 + Pattern 4 + Pitfall 2 + Pitfall 3)
  </read_first>
  <action>
    Edit apps/web/lib/theme.ts. Preserve ALL security invariants (hex regex, validateFont, WCAG math, resolvePalette logic) byte-unchanged except where stated.
    1. APPEND three entries to FONT_WHITELIST (AFTER 'DM Serif Display', INSIDE the frozen array, BEFORE updating BRAND_DEFAULTS to avoid the WhitelistedFont type error per Pitfall 2): `'Fraunces',` `'Newsreader',` `'IBM Plex Mono',`. The array now has 9 entries. `WhitelistedFont` derives automatically via `[number]`.
    2. Replace the BRAND_DEFAULTS object body with:
       `bg: '#FBFAF6', text: '#1A1714', primary: '#9A3324', accent: '#9A3324', fontDisplay: 'Fraunces' as WhitelistedFont, fontBody: 'Newsreader' as WhitelistedFont, fontUi: 'IBM Plex Mono' as WhitelistedFont`.
    3. Extend `serializeThemeCss` return array to ALSO emit `--color-bg` and `--color-text` from the resolved palette (`p.bg`, `p.text`). Keep alphabetical ordering: insert `  --color-bg: ${p.bg};` after `--color-accent` and `  --color-text: ${p.text};` after `--color-primary`. The font lines stay. Result emits 6 lines: --color-accent, --color-bg, --color-primary, --color-text, --font-body, --font-display.
    4. Extend `applyTheme` to also call `element.style.setProperty('--color-bg', p.bg)` and `element.style.setProperty('--color-text', p.text)` (setProperty ONLY — WEB-08 invariant). Add the same two setProperty calls to the catch-block minimal fallback using BRAND_DEFAULTS.bg / BRAND_DEFAULTS.text.
    Do NOT touch HEX_REGEX, validateHex, validateFont, relativeLuminance, contrastRatio, passesWcagAA, or the WCAG fallback logic in resolvePalette.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "'Fraunces'\|'Newsreader'\|'IBM Plex Mono'" apps/web/lib/theme.ts` returns 3 or more
    - `grep "'#9A3324'" apps/web/lib/theme.ts` matches (oxblood primary+accent)
    - `grep "'#FBFAF6'" apps/web/lib/theme.ts` matches (cream bg)
    - `grep "'#1A1714'" apps/web/lib/theme.ts` matches (ink text)
    - `grep -c -- "--color-bg" apps/web/lib/theme.ts` returns 2 or more (serializeThemeCss + applyTheme)
    - `grep -c -- "--color-text" apps/web/lib/theme.ts` returns 2 or more
    - `grep -c "HEX_REGEX = /\^#\[0-9a-fA-F\]{6}\$/" apps/web/lib/theme.ts` returns 1 (regex unchanged)
    - `pnpm --filter web typecheck` exits 0
  </acceptance_criteria>
  <done>theme.ts has 9 whitelist fonts, oxblood/cream BRAND_DEFAULTS, and emits --color-bg/--color-text in both serialize + apply paths; all security invariants intact; typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 3: Re-token globals.css :root to oxblood/cream + structural tokens; update print hide-list</name>
  <read_first>
    - apps/web/app/globals.css (FULL :root block + @media print block — find with `grep -n ':root\|@media print\|--color-' apps/web/app/globals.css`)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (§Token Architecture lines 91-162, §Color lines 296-358, §Print Stylesheet Update lines 805-816)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-RESEARCH.md (Open Question 2 + 3 — derived-token decision)
  </read_first>
  <action>
    Edit apps/web/app/globals.css `:root` block. Replace the Phase 14 light palette token values with the Phase 19 oxblood/cream values from UI-SPEC §Token Architecture:
    - `--color-bg: #FBFAF6;` `--color-surface: #F3F0E8;` `--color-card-hover: #EBE7DC;`
    - `--color-text: #1A1714;` `--color-text-dim: #56514A;` `--color-text-mute: #8C8779;`
    - `--color-line: #E2DDD0;` `--color-line-strong: #CFC9B8;`
    - `--color-accent: #9A3324;` `--color-primary: #9A3324;`
    - `--color-scout: #5E7359;` `--color-advocate: #3D6285;` `--color-gold: #9C7A3C;`
    - `--font-display: 'Fraunces', Georgia, serif;` `--font-body: 'Newsreader', Georgia, serif;` `--font-ui: 'IBM Plex Mono', monospace;`
    ADD three NEW structural tokens (per RESEARCH Open Q2/Q3 — fixed constants in :root, NOT computed per-issue):
    - `--color-prose: #2C2823;` (long-form body prose only)
    - `--color-surface-accent: color-mix(in srgb, var(--color-accent) 12%, var(--color-bg));` (shop band bg; auto-tracks per-issue accent)
    - `--color-accent-deep: #6E2117;` (accent button hover)
    Keep the `@theme` Tailwind block mapping `--font-display-loaded`/`--font-body-loaded`/`--font-ui-loaded` intact (rename targets only if they reference old font names). The `nav, button { font-family: var(--font-ui) }` rule must remain — fallback is now `monospace`.
    In the `@media print` block: add `.rail` to the hide list; ensure `.shop` band hides (add `[data-shop-callout]` selector); KEEP `.briefing` and mission band visible (content, not chrome). Existing `[data-game-slot]`, `[data-deliberation-slot]`, `[data-podcast-slot]` print-hide rules stay.
    Do NOT delete the `.aurora`/`.bg-grid` rules in this plan — Plan 02 retires Atmosphere; leaving dead CSS here is harmless and avoids cross-plan churn.
  </action>
  <verify>
    <automated>cd apps/web && grep -c "#FBFAF6\|#1A1714\|#9A3324\|#2C2823" app/globals.css</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c -- "--color-bg: #FBFAF6" apps/web/app/globals.css` returns 1
    - `grep -c -- "--color-prose: #2C2823" apps/web/app/globals.css` returns 1
    - `grep -c -- "--color-accent: #9A3324" apps/web/app/globals.css` returns 1
    - `grep -c -- "--color-surface-accent" apps/web/app/globals.css` returns 1 or more
    - `grep -c -- "--color-accent-deep: #6E2117" apps/web/app/globals.css` returns 1
    - `grep -c "'Fraunces', Georgia, serif" apps/web/app/globals.css` returns 1
    - `grep -c "'IBM Plex Mono', monospace" apps/web/app/globals.css` returns 1
    - `grep -c "#FAFAF8\|#CDA434" apps/web/app/globals.css` returns 0 (no Phase 14 light/gold literals remain in :root)
  </acceptance_criteria>
  <done>globals.css :root carries oxblood/cream + 3 new structural tokens; fonts swapped; print hide-list updated for .rail + shop band.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Update theme-aa-tones.test.ts to Phase 19 palette + author issue-page-dispatch.test.ts tripwires</name>
  <read_first>
    - apps/web/__tests__/theme-aa-tones.test.ts (FULL FILE — Phase 14 LIGHT_BG assertions)
    - apps/web/__tests__/game-sandbox.test.ts (source-scan tripwire pattern to mirror)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-RESEARCH.md (Validation Architecture §Phase 19 palette AA values lines 678-684, Wave 0 Gaps lines 692-704)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (Dark Deliberation Band Tokens lines 146-162, Accessibility Contract lines 708-725)
  </read_first>
  <behavior>
    theme-aa-tones.test.ts (UPDATE):
    - `#1A1714` on `#FBFAF6` passes AA (~15.8:1)
    - `#9A3324` (oxblood) on `#FBFAF6` passes AA-large / asserted ratio ~5.5:1
    - `#5E7359` (scout) on `#1A1714` (dark band) passes AA (~4.6:1)
    - `#3D6285` (advocate) on `#1A1714` passes AA (~5.2:1)
    - `#E0B0A4` (accent-on-dark) on `#1A1714` passes AA (~5.9:1)
    - Remove/replace the Phase 14 `#FAFAF8` LIGHT_BG and gold `#CDA434` decorative-only assertions.
    issue-page-dispatch.test.ts (NEW source-scan tripwires):
    - layout.tsx imports Fraunces, Newsreader, IBM_Plex_Mono
    - theme.ts FONT_WHITELIST contains 'Fraunces', 'Newsreader', 'IBM Plex Mono'
    - theme.ts BRAND_DEFAULTS uses '#9A3324' and '#FBFAF6'
    - issue/[slug]/layout.tsx does NOT gate themeCss on DESIGNAGENT_SUPPRESSED (assert no `suppressed ? '' :` pattern) — RED until Plan 05
    - framer-motion is a dependency in package.json
  </behavior>
  <action>
    1. UPDATE apps/web/__tests__/theme-aa-tones.test.ts: change `LIGHT_BG = '#FAFAF8'` to `const PAPER_BG = '#FBFAF6'` and `const DARK_BAND = '#1A1714'`. Rewrite the per-tone assertions to the Phase 19 values listed in <behavior> using the existing `contrastRatio` import. Use `expect(contrastRatio('#1A1714', '#FBFAF6')).toBeGreaterThanOrEqual(4.5)` style. Remove the Phase 14 gold-fails-AA and dark-mute assertions (they reference retired tokens).
    2. CREATE apps/web/__tests__/issue-page-dispatch.test.ts following the game-sandbox.test.ts source-scan pattern (readFileSync + regex assertions). Author the tripwires in <behavior>. The `DESIGNAGENT_SUPPRESSED`-off assertion and the framer-motion-in-motion-components assertions reference files that land in Plans 02/03/05 — gate them so the source-scan reads files that exist NOW (layout.tsx, theme.ts, package.json) and mark the suppression-off + motion-component checks as the ones Plan 05 / Plan 02 turn green. For checks against files not yet rewritten, read the file if it exists and assert; if testing a not-yet-true condition, leave a `describe.todo` or a clearly-commented `it` that Plan 05/02 flips — do NOT assert a false condition that breaks Wave 1.
    Concretely: in THIS plan, only assert conditions already TRUE after Tasks 1-3 (fonts, whitelist, BRAND_DEFAULTS, framer-motion dep). Author the suppression-off + a11y-attr + framer-motion-component tripwires as `it.todo(...)` placeholders with the exact assertion in a comment, to be activated by the plan that makes them true.
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/__tests__/issue-page-dispatch.test.ts` exists
    - `grep -c "#FBFAF6\|#1A1714" apps/web/__tests__/theme-aa-tones.test.ts` returns 2 or more
    - `grep -c "#FAFAF8" apps/web/__tests__/theme-aa-tones.test.ts` returns 0
    - `grep -c "Fraunces" apps/web/__tests__/issue-page-dispatch.test.ts` returns 1 or more
    - `pnpm --filter web test:unit` exits 0 (entire suite green; no RED assertions for not-yet-true conditions)
  </acceptance_criteria>
  <done>theme-aa-tones asserts Phase 19 palette; issue-page-dispatch tripwire file exists with currently-true assertions + it.todo placeholders for Plan 02/05 conditions; full suite green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` exits 0 (≥259 tests, all green)
- `pnpm --filter web typecheck` exits 0
- framer-motion present in apps/web/package.json
- theme.ts security invariants (HEX_REGEX, validateFont, WCAG math) byte-unchanged
</verification>

<success_criteria>
- 3 new fonts wired sitewide + in FONT_WHITELIST (DES-01, AGT-14, P19-02)
- oxblood/cream BRAND_DEFAULTS + globals.css tokens (P19-03)
- serializeThemeCss/applyTheme emit --color-bg/--color-text (P19-03, WEB-08)
- framer-motion installed (P19-04 prerequisite)
- test gate updated + green (P19-06)
</success_criteria>

<output>
After completion, create `.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-01-SUMMARY.md`
</output>
