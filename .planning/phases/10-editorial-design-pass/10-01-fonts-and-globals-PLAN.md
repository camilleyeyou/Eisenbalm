---
phase: 10-editorial-design-pass
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/web/app/layout.tsx
  - apps/web/app/globals.css
autonomous: true
requirements:
  - DES-01
  - DES-03
  - DES-04
must_haves:
  truths:
    - "Playfair Display is imported from next/font/google and exposed as CSS variable --font-display-loaded"
    - "Lora is imported from next/font/google and exposed as CSS variable --font-body-loaded"
    - "globals.css defines a .prose-measure utility constraining width to 68ch on screens >= 768px and full-width on mobile"
    - "globals.css defines a .drop-cap CSS rule using ::first-letter targeting the first paragraph of a marked container, scaling ~3.5em float left"
    - "globals.css defines a .ornament-divider utility rendering a Unicode ornament (e.g. ❦ or asterism) centered with vertical rhythm, NOT a default <hr>"
    - "globals.css defines a .eyebrow utility for small-caps section labels"
    - "Body line-height is >= 1.55 in globals.css for the body font"
    - "next/font/google is the ONLY font loader — no <link href=\"https://fonts.googleapis.com\"> anywhere"
    - "pnpm --filter web build exits 0"
    - "pnpm --filter web test:unit still exits 0 (Phase 7 + Phase 2 + Phase 8 tests not regressed)"
  artifacts:
    - path: "apps/web/app/layout.tsx"
      provides: "next/font/google import for Playfair Display + Lora (display + body) with weight subsets sufficient for an editorial hierarchy"
      contains: "Playfair_Display"
    - path: "apps/web/app/globals.css"
      provides: "Typography scale, drop-cap rule, ornament divider, prose-measure utility, eyebrow utility"
      contains: ".prose-measure"
  key_links:
    - from: "apps/web/app/layout.tsx"
      to: "apps/web/app/globals.css"
      via: "import './globals.css'"
      pattern: "import.*globals\\.css"
    - from: "apps/web/app/globals.css"
      to: "Phase 2 theme injection"
      via: "still defines :root --color-* variables consumed by issue layout"
      pattern: "--color-primary"
---

<objective>
Lay down the Phase 10 typography foundation. Confirm Playfair Display (display serif)
+ Lora (body serif) as the editorial pairing via next/font/google. Add the typographic
utilities the issue redesign (10-02) will consume: drop-cap CSS, ornament divider,
60-68ch prose measure, small-caps eyebrow, and a generous body line-height (>= 1.55).
This plan touches NO component file — only the root layout (font config) and globals.css.

Purpose: A single foundation plan means 10-02 can refactor components against stable,
named CSS utilities ("apply .prose-measure to the prose container") rather than
inline magic numbers. This is the typographic vocabulary of the redesign.

Output:
- apps/web/app/layout.tsx — Playfair Display + Lora confirmed (already present from Phase 2);
  weight subsets extended to support drop-cap + section header weights.
- apps/web/app/globals.css — drop-cap rule, ornament divider, prose-measure, eyebrow utilities.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@apps/web/app/layout.tsx
@apps/web/app/globals.css
@apps/web/lib/theme.ts

<interfaces>
<!-- Existing next/font/google setup (apps/web/app/layout.tsx lines 11-41) -->
<!-- Playfair Display + Lora + Inter are ALREADY imported as CSS variables.    -->
<!-- This plan extends weight subsets and adds typography utilities to globals.css. -->

From apps/web/app/layout.tsx:
```typescript
import { Playfair_Display, Lora, Inter } from 'next/font/google'

const fontDisplay = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display-loaded',
  weight: ['600'],
})

const fontBody = Lora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body-loaded',
  weight: ['400'],
})
```

From apps/web/app/globals.css (Tailwind v4 @theme block; existing tokens):
```css
@theme {
  --color-primary: var(--color-primary);
  --color-accent: var(--color-accent);
  --font-display: var(--font-display);
  --font-body: var(--font-body);
}

:root {
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body: 'Lora', Georgia, serif;
}

html {
  font-family: var(--font-body);
  font-size: 18px;
  line-height: 1.65;
}
```

The theme engine (apps/web/lib/theme.ts) already validates `'Playfair Display'`
and `'Lora'` in FONT_WHITELIST. Per-issue themes via Phase 2 inject only the four
hex colors and the two font family names — the next/font/google @font-face
declarations from layout.tsx provide the actual font files. No HTTP font loading.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend next/font/google weight subsets in layout.tsx</name>
  <files>apps/web/app/layout.tsx</files>
  <read_first>
    - apps/web/app/layout.tsx (the file being modified — confirm Playfair_Display + Lora are imported from 'next/font/google')
    - apps/web/lib/theme.ts (confirm 'Playfair Display' and 'Lora' are in FONT_WHITELIST so per-issue theme overrides don't crash)
  </read_first>
  <action>
Extend the existing Playfair Display + Lora imports in apps/web/app/layout.tsx with
the weight subsets needed for editorial hierarchy:

1. Locate the existing `Playfair_Display({ ... weight: ['600'] })` block. Replace the
   weight array with `weight: ['400', '600', '700']`. Rationale: the redesign needs
   400 for the drop cap (large + light reads as editorial restraint), 600 for the
   current charity-name h1 + section h2 headers, 700 for occasional emphasis. All
   three weights are subset-bundled at build time by next/font/google.

2. Locate the existing `Lora({ ... weight: ['400'] })` block. Replace with
   `weight: ['400', '500', '700']`. Rationale: 400 for body prose, 500 for emphasized
   inline runs, 700 for strong/bold marks (Portable Text `strong` mark already wants
   semibold per Phase 2 PortableTextRenderer).

3. Add an `italic` weight subset to Lora by extending to:
   `Lora({ subsets: ['latin'], display: 'swap', variable: '--font-body-loaded',
            weight: ['400', '500', '700'], style: ['normal', 'italic'] })`.
   Rationale: editorial prose uses italics for em marks and the case study sidebar.

4. Leave `Inter` (--font-ui-loaded) untouched — UI font is locked at weight 400/600.

5. Do NOT change the `variable` names (`--font-display-loaded`, `--font-body-loaded`,
   `--font-ui-loaded`). The :root selector in globals.css references these names.

6. Do NOT change the className application on `<html>`. The existing
   `${fontDisplay.variable} ${fontBody.variable} ${fontUi.variable}` chain is correct.

7. NO new imports — only modify the existing three Google-Fonts import call sites.

8. Do NOT add a `<link>` tag anywhere; do NOT import @fontsource/* — next/font/google
   subsetting is the ONLY contract.
  </action>
  <verify>
    <automated>grep -q "weight: \[.*'400'.*'600'.*'700'.*\]" apps/web/app/layout.tsx &amp;&amp; grep -q "style: \['normal', 'italic'\]" apps/web/app/layout.tsx &amp;&amp; pnpm --filter web build</automated>
  </verify>
  <acceptance_criteria>
    - grep -E "Playfair_Display\(\{[^}]*weight: \['400', '600', '700'\]" apps/web/app/layout.tsx returns ≥1 match (multi-line; use perl -0777 if grep -E fails on multiline: `perl -0777 -ne 'exit !/Playfair_Display\(\{[^}]*weight: \[..400.., ..600.., ..700..\]/s' apps/web/app/layout.tsx` exits 0)
    - grep -q "style: \['normal', 'italic'\]" apps/web/app/layout.tsx
    - grep -c "from 'next/font/google'" apps/web/app/layout.tsx returns 1 (no duplicate import added)
    - grep -c "fonts.googleapis.com" apps/web/app/layout.tsx returns 0
    - grep -c "@import.*fonts" apps/web/app/layout.tsx returns 0
    - pnpm --filter web build exits 0 (Next compiles + subsets the new weights)
  </acceptance_criteria>
  <done>
    next/font/google imports for Playfair Display and Lora now include the weight
    + style subsets the redesign needs; pnpm --filter web build still succeeds.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add typography scale, prose measure, drop cap, ornament divider, and eyebrow utilities to globals.css</name>
  <files>apps/web/app/globals.css</files>
  <read_first>
    - apps/web/app/globals.css (the file being modified — confirm Tailwind v4 @theme block and :root with --color-* / --font-* variables)
    - apps/web/lib/theme.ts (confirm BRAND_DEFAULTS so utility colors fall back correctly when theme is missing)
    - apps/web/components/issue/EditorialSection.tsx (confirm the .eyebrow label pattern this utility will replace)
  </read_first>
  <action>
Append a `/* Phase 10 — Editorial Design Pass */` block at the END of
apps/web/app/globals.css (after the shadcn variable shim block, before EOF).
Do NOT modify any existing rule. The new block contains:

```css
/* ═══════════════════════════════════════════════════════════════════════
   Phase 10 — Editorial Design Pass
   Typography utilities: prose-measure, drop-cap, ornament-divider, eyebrow.
   Consumed by apps/web/components/issue/* in Plan 10-02. NO color values
   are hardcoded here — every color references --color-text / --color-accent
   / --color-primary so per-issue theme injection (Phase 2) still drives palette.
   ═══════════════════════════════════════════════════════════════════════ */

/* Body prose line-height bumped to >= 1.55 (DES-03). The existing html { line-height: 1.65 }
   above already satisfies this; this block documents the contract. */

/* .prose-measure
   Constrains body prose to a comfortable measure on >= 768px screens.
   Full-width with horizontal padding on mobile. (DES-03) */
.prose-measure {
  max-width: 68ch;
  margin-inline: auto;
  padding-inline: 1.25rem; /* 20px mobile gutter */
}
@media (min-width: 768px) {
  .prose-measure {
    padding-inline: 1.5rem; /* 24px desktop gutter */
  }
}

/* .drop-cap
   Apply to a container; styles the first ::first-letter of the first <p>.
   ~3.5x body size, baseline-aligned with second line, hanging left.
   Renders correctly on mobile down to 320px (no overflow). (DES-02) */
.drop-cap > p:first-of-type::first-letter {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 3.5em;
  line-height: 0.85;
  float: left;
  padding-right: 0.08em;
  padding-top: 0.05em;
  margin-bottom: -0.1em;
  color: var(--color-primary);
}
@media (max-width: 360px) {
  /* Slightly smaller drop cap on the narrowest mobile so it doesn't overflow */
  .drop-cap > p:first-of-type::first-letter {
    font-size: 3em;
  }
}

/* .ornament-divider
   Between-section separator. NOT a default <hr>. Uses a Unicode ornament
   (FLEURON U+2766 ❦) centered with consistent vertical rhythm. (DES-04) */
.ornament-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-block: 2.5rem;
  font-family: var(--font-display);
  font-size: 1.25rem;
  color: var(--color-text);
  opacity: 0.5;
  letter-spacing: 0.5em;
}
.ornament-divider::before {
  content: "\2766"; /* ❦ FLEURON */
}

/* .eyebrow
   Small-caps section label above section headlines. (DES-04) */
.eyebrow {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text);
  opacity: 0.6;
  display: inline-block;
  line-height: 1.5;
}

/* .metadata-block
   Sidebar / footnote treatment for case-study structured metadata.
   Smaller type, monospace tabular numerals, delineated panel. (DES-05) */
.metadata-block {
  font-family: var(--font-ui);
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--color-text);
  opacity: 0.75;
  border-left: 2px solid var(--color-accent);
  padding-left: 1rem;
  margin-block: 1.5rem;
  font-variant-numeric: tabular-nums;
}
.metadata-block dt {
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-size: 0.75rem;
  opacity: 0.7;
}
.metadata-block dd {
  margin-block: 0.25rem 0.75rem;
  font-variant-numeric: tabular-nums;
}
```

Constraints:
- The block lives at end-of-file, separated from existing rules by a comment banner.
- ALL color references use existing CSS variables (`var(--color-primary)`,
  `var(--color-text)`, `var(--color-accent)`) so per-issue theme injection still works.
- ALL font-family references use existing CSS variables (`var(--font-display)`,
  `var(--font-body)`, `var(--font-ui)`).
- The Unicode ornament is U+2766 (FLEURON) — encoded as `\2766` in CSS content.
- No new @import statements; no new @font-face declarations; no fetch() of remote CSS.
- Do NOT touch the existing @theme block, :root color values, html/body rules,
  focus-visible, @media print, or the shadcn shim block.
  </action>
  <verify>
    <automated>grep -q "\.prose-measure" apps/web/app/globals.css &amp;&amp; grep -q "\.drop-cap" apps/web/app/globals.css &amp;&amp; grep -q "::first-letter" apps/web/app/globals.css &amp;&amp; grep -q "\.ornament-divider" apps/web/app/globals.css &amp;&amp; grep -q "\.eyebrow" apps/web/app/globals.css &amp;&amp; grep -q "\.metadata-block" apps/web/app/globals.css &amp;&amp; grep -q "var(--color-primary)" apps/web/app/globals.css &amp;&amp; pnpm --filter web build</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "\.prose-measure" apps/web/app/globals.css returns ≥2 (definition + media query)
    - grep -c "\.drop-cap" apps/web/app/globals.css returns ≥2 (definition + 360px media query)
    - grep -q "p:first-of-type::first-letter" apps/web/app/globals.css
    - grep -q "max-width: 68ch" apps/web/app/globals.css
    - grep -q "\.ornament-divider" apps/web/app/globals.css
    - grep -q "\\\\2766" apps/web/app/globals.css (the Unicode fleuron escape)
    - grep -q "\.eyebrow" apps/web/app/globals.css
    - grep -q "\.metadata-block" apps/web/app/globals.css
    - grep -q "tabular-nums" apps/web/app/globals.css
    - grep -c "fonts.googleapis.com" apps/web/app/globals.css returns 0 (NO HTTP font loads)
    - grep -c "@import url" apps/web/app/globals.css returns 0 (only @import "tailwindcss" allowed)
    - grep -c "var(--color-" apps/web/app/globals.css returns ≥8 (theme variable consumption preserved — pre-existing + new utilities)
    - pnpm --filter web build exits 0
    - pnpm --filter web test:unit exits 0 (Phase 7 sandbox source-scan + Phase 2 + Phase 8 tests unchanged)
  </acceptance_criteria>
  <done>
    globals.css contains the .prose-measure, .drop-cap, .ornament-divider,
    .eyebrow, and .metadata-block utilities. All reference existing CSS
    variables so per-issue theme injection still drives accent colors.
    Build succeeds; pre-existing unit tests unchanged.
  </done>
</task>

</tasks>

<verification>
- pnpm --filter web build exits 0
- pnpm --filter web test:unit exits 0 (no test in Phase 10's surface depends on this plan yet — that arrives in 10-03)
- grep -c "fonts.googleapis.com" apps/web returns 0 (next/font/google is the only font loader)
- Phase 2 theme injection contract preserved: --color-primary, --color-accent, --color-text, --color-bg referenced in globals.css unchanged in count and meaning
</verification>

<success_criteria>
- Playfair Display + Lora imported via next/font/google with weight + style subsets
  sufficient for editorial hierarchy (display 400/600/700, body 400/500/700 + italic)
- globals.css exposes 5 named typography utilities (.prose-measure, .drop-cap,
  .ornament-divider, .eyebrow, .metadata-block) that Plan 10-02 will consume
- No HTTP font loading; no new @font-face declarations; no client-side font shims
- Per-issue theme CSS variable contract preserved
- Build still succeeds; pre-existing unit tests still pass
</success_criteria>

<output>
After completion, create `.planning/phases/10-editorial-design-pass/10-01-fonts-and-globals-SUMMARY.md`
recording: which weights were added to each font, the 5 CSS utility class names
exposed for Plan 10-02 consumption, and confirmation that Phase 7 (`game-sandbox.test.ts`)
+ Phase 2 + Phase 8 unit tests still pass.
</output>
