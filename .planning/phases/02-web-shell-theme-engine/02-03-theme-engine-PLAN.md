---
phase: 02-web-shell-theme-engine
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/lib/theme.ts
  - apps/web/lib/theme.test.ts
autonomous: true
requirements: [WEB-06, WEB-07, WEB-08, WEB-09]
must_haves:
  truths:
    - "Hex colors are validated against /^#[0-9a-fA-F]{6}$/ before any CSS variable is set — named colors like 'red' are rejected"
    - "Theme injection uses element.style.setProperty exclusively — no template-literal CSS strings, no cssText, no unvalidated inline style"
    - "WCAG AA contrast (>= 4.5:1) is computed via the WCAG luminance formula; failing themes apply the brand fallback palette without throwing"
    - "Font names are validated against a Phase 2 whitelist of 6 fonts before injection"
    - "FOUC is avoided by exposing a server-side helper that returns a validated, safe-to-inline CSS string for the <style> tag in the issue layout <head>"
  artifacts:
    - path: apps/web/lib/theme.ts
      provides: "applyTheme, validateHex, passesWcagAA, FONT_WHITELIST, BRAND_DEFAULTS, serializeThemeCss"
      exports: ["applyTheme", "validateHex", "passesWcagAA", "relativeLuminance", "contrastRatio", "FONT_WHITELIST", "BRAND_DEFAULTS", "serializeThemeCss"]
      min_lines: 200
    - path: apps/web/lib/theme.test.ts
      provides: "Smoke tests verifying the security contract"
      contains: "validateHex, passesWcagAA, serializeThemeCss, applyTheme"
  key_links:
    - from: apps/web/lib/theme.ts
      to: apps/web/lib/sanity/types.ts
      via: "IssueTheme type import"
      pattern: "import type \\{ IssueTheme"
    - from: apps/web/lib/theme.ts
      to: WCAG luminance formula (no third-party lib)
      via: "manual implementation"
      pattern: "0\\.2126.*0\\.7152.*0\\.0722"
---

<objective>
Build the security-critical theme engine module at `apps/web/lib/theme.ts`. This is the single point where Sanity-supplied theme data (`primaryColor`, `accentColor`, `backgroundColor`, `textColor`, `fontDisplay`, `fontBody`) becomes CSS variables on the issue page. Every theme value must pass:
1. Strict hex regex `/^#[0-9a-fA-F]{6}$/` before injection (WEB-07)
2. Font whitelist membership before injection
3. WCAG AA contrast check (>= 4.5:1) — failing pairs apply brand fallback (WEB-09)
4. Injection via `element.style.setProperty(...)` ONLY (WEB-08)

The brand fallback palette is the editorial off-white / forest / deep crimson set from UI-SPEC color section. This module also exposes a server-side `serializeThemeCss(theme)` helper that Plan 02-06 (issue layout) can inline into a `<style>` tag in `<head>` to avoid FOUC — the returned string is built from validated values only, never raw user input.

Purpose: Centralize the theme security contract in one auditable file before any route or component touches theme data. Wave 3 plans depend on this module.
Output: A 200+ line `apps/web/lib/theme.ts` with the contract enforced, plus a small `theme.test.ts` that smoke-tests the validators and WCAG math.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/02-web-shell-theme-engine/02-CONTEXT.md
@.planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md
@.planning/research/PITFALLS.md
@CLAUDE.md
@apps/web/lib/sanity/types.ts

<interfaces>
<!-- IssueTheme type from Plan 02-02. -->
<!-- The applyTheme function consumes this shape (which mirrors weeklyIssue.theme schema). -->

From apps/web/lib/sanity/types.ts:
```typescript
export type IssueTheme = {
  primaryColor?: string
  accentColor?: string
  backgroundColor?: string
  textColor?: string
  fontDisplay?: string
  fontBody?: string
  visualDirection?: string
} | null
```

UI-SPEC Color System (LOCKED — copy exactly):
- CSS variables: --color-primary, --color-accent, --color-bg, --color-text,
  --color-surface (DERIVED via color-mix), --color-text-muted (DERIVED),
  --color-border (DERIVED)
- Font CSS variables: --font-display, --font-body
- --font-ui is NEVER overridden by theme

UI-SPEC Brand Default Palette (when theme is missing or fails):
- --color-bg:     #FAFAF8  (off-white, warm editorial)
- --color-surface: #F0EFE9 (warm cream — but in code, derived via color-mix from bg)
- --color-text:   #1A1A18  (near-black)
- --color-primary: #2D5016 (forest green)
- --color-accent:  #8B1A1A (deep crimson)

UI-SPEC Default Font Whitelist (Phase 2; Phase 5 extends):
- 'Playfair Display'      (serif display — default --font-display)
- 'Lora'                  (serif body — default --font-body)
- 'Inter'                 (sans-serif UI — never themed; in whitelist for safety)
- 'Cormorant Garamond'    (alt display)
- 'Merriweather'          (alt body)
- 'DM Serif Display'      (alt display)

Hex regex (UI-SPEC + WEB-07): /^#[0-9a-fA-F]{6}$/

Contrast threshold: 4.5:1 (WCAG AA for body text).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement apps/web/lib/theme.ts (validators + WCAG + applyTheme + serializeThemeCss)</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md (Typography, Color System, Security Contract sections — lines that define hex regex, color variable names, brand defaults, font whitelist, WCAG threshold)
    - .planning/phases/02-web-shell-theme-engine/02-CONTEXT.md (D-10, D-11, D-12)
    - .planning/research/PITFALLS.md (CSS injection CVE GHSA-97v6-998m-fp4g context — search for "Theme injection" or "CSS injection")
    - apps/web/lib/sanity/types.ts (IssueTheme shape)
  </read_first>
  <behavior>
    Module surface and behavior contracts:

    1. `validateHex(value: unknown): string | null`
       - Returns the value if it matches /^#[0-9a-fA-F]{6}$/, else null.
       - Test cases:
         - validateHex('#FF0000') === '#FF0000'
         - validateHex('#abc123') === '#abc123'
         - validateHex('#FFF') === null      (3-digit shorthand rejected)
         - validateHex('red') === null       (named color rejected)
         - validateHex('rgb(255,0,0)') === null
         - validateHex('#GG0000') === null   (non-hex char)
         - validateHex('') === null
         - validateHex(undefined) === null
         - validateHex(null) === null
         - validateHex(42) === null

    2. `relativeLuminance(hex: string): number`
       - Implements WCAG 2.1 relative luminance formula.
       - For sRGB channel c in [0, 1]:
         - If c <= 0.03928: linear = c / 12.92
         - Else: linear = ((c + 0.055) / 1.055) ** 2.4
       - L = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear
       - Test cases:
         - relativeLuminance('#FFFFFF') === 1 (within float precision)
         - relativeLuminance('#000000') === 0
         - relativeLuminance('#808080') ≈ 0.215861 (mid-gray; assert within 0.001)

    3. `contrastRatio(fg: string, bg: string): number`
       - (L_lighter + 0.05) / (L_darker + 0.05)
       - Test cases:
         - contrastRatio('#000000', '#FFFFFF') === 21 (within 0.01)
         - contrastRatio('#FFFFFF', '#FFFFFF') === 1
         - contrastRatio('#FAFAF8', '#1A1A18') > 15 (brand default pair passes)

    4. `passesWcagAA(textColor: string, bgColor: string): boolean`
       - Returns true iff contrastRatio >= 4.5
       - Returns false if either input fails validateHex
       - Test cases:
         - passesWcagAA('#1A1A18', '#FAFAF8') === true
         - passesWcagAA('#CCCCCC', '#FFFFFF') === false (low contrast)
         - passesWcagAA('red', '#FFFFFF') === false (invalid input)

    5. `FONT_WHITELIST: readonly string[]`
       - Frozen array of exactly six names from UI-SPEC default set.

    6. `BRAND_DEFAULTS: Readonly<{ primary, accent, bg, text, fontDisplay, fontBody, fontUi }>`
       - Hex defaults from UI-SPEC Brand Default Palette.
       - Font defaults: Playfair Display (display), Lora (body), Inter (ui).

    7. `serializeThemeCss(theme: IssueTheme): string`
       - Returns a CSS string of `--var: value;` declarations suitable for inline
         `<style>` injection in the server-rendered <head>.
       - All values are validated; invalid values fall back to brand defaults.
       - Contrast check applied; if failing, bg+text revert to brand defaults
         (primary/accent retain their validated values).
       - Output is wrapped in `:root { ... }` for global scope.
       - NEVER includes raw user input; every value passed through validateHex/whitelist.

    8. `applyTheme(element: HTMLElement, theme: IssueTheme): void`
       - Client-side counterpart. Uses element.style.setProperty(name, value) ONLY.
       - FORBIDDEN patterns inside this function: cssText, innerHTML, template literals
         used to construct CSS strings injected into <style> tags.
       - Validates each value identically to serializeThemeCss.
       - On WCAG failure: applies fallback bg+text via setProperty; console.warn the failing pair + ratio.
       - On font validation failure: applies BRAND_DEFAULTS.fontDisplay / fontBody.
       - Never throws — wraps internal logic in try/catch returning early on unexpected errors.
  </behavior>
  <files>apps/web/lib/theme.ts</files>
  <action>
    Create `apps/web/lib/theme.ts`. Implementation skeleton (executor fills in WCAG math and full function bodies):

    ```typescript
    /**
     * Theme engine — security-critical. WEB-06, WEB-07, WEB-08, WEB-09.
     *
     * INVARIANTS (must hold across every code path):
     *   1. No CSS variable is set without passing validateHex (for colors) or
     *      FONT_WHITELIST membership (for fonts).
     *   2. element.style.setProperty(name, value) is the ONLY DOM API used to
     *      inject theme values at runtime. Never cssText, never innerHTML,
     *      never `style="..."`-string-concat.
     *   3. Server-side serializeThemeCss returns a string built ONLY from
     *      validated values; it is safe to embed in a <style> tag in <head>.
     *   4. Contrast check (>= 4.5:1) gates bg+text; failing pairs fall back to
     *      BRAND_DEFAULTS.bg + BRAND_DEFAULTS.text.
     *   5. No third-party color/contrast lib — ~50 lines of WCAG math.
     */

    import type { IssueTheme } from './sanity/types'

    // ─── Constants ────────────────────────────────────────────────────────────

    /** Strict hex regex — 6-digit only. Rejects shorthand, named colors, rgb(). */
    export const HEX_REGEX = /^#[0-9a-fA-F]{6}$/

    /** WCAG AA contrast threshold for body text. */
    export const WCAG_AA_THRESHOLD = 4.5

    /**
     * Phase 2 font whitelist. Phase 5 (DesignAgent) extends this after
     * Andrew/designer approval. ANY name not in this list is rejected.
     */
    export const FONT_WHITELIST = Object.freeze([
      'Playfair Display',
      'Lora',
      'Inter',
      'Cormorant Garamond',
      'Merriweather',
      'DM Serif Display',
    ] as const)

    export type WhitelistedFont = (typeof FONT_WHITELIST)[number]

    /**
     * Brand default palette — applied when theme is missing, has invalid
     * values, or fails WCAG AA contrast. Values from UI-SPEC color section.
     */
    export const BRAND_DEFAULTS = Object.freeze({
      bg:           '#FAFAF8',   // off-white, warm editorial
      text:         '#1A1A18',   // near-black, high contrast on default bg
      primary:      '#2D5016',   // forest green, editorial authority
      accent:       '#8B1A1A',   // deep crimson, restraint as CTA color
      fontDisplay:  'Playfair Display',
      fontBody:     'Lora',
      fontUi:       'Inter',  // NEVER overridden by theme
    } as const)

    // ─── Validators ───────────────────────────────────────────────────────────

    /**
     * Return value iff it matches the 6-digit hex regex; else null.
     * Rejects: undefined, null, non-strings, named colors, shorthand, rgb()/hsl().
     */
    export function validateHex(value: unknown): string | null {
      if (typeof value !== 'string') return null
      return HEX_REGEX.test(value) ? value : null
    }

    /** Whitelist-membership check for font names. */
    export function validateFont(value: unknown): WhitelistedFont | null {
      if (typeof value !== 'string') return null
      return (FONT_WHITELIST as readonly string[]).includes(value)
        ? (value as WhitelistedFont)
        : null
    }

    // ─── WCAG luminance math (no third-party lib) ─────────────────────────────

    /**
     * Convert 6-digit hex to [r, g, b] each in [0, 255].
     * Caller must have validated input via validateHex.
     */
    function hexToRgb(hex: string): [number, number, number] {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return [r, g, b]
    }

    /** sRGB channel (0-255) → linearized channel per WCAG 2.1. */
    function srgbToLinear(channel255: number): number {
      const c = channel255 / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }

    /**
     * Relative luminance per WCAG 2.1.
     * Returns NaN if input is not a valid hex string.
     */
    export function relativeLuminance(hex: string): number {
      const safe = validateHex(hex)
      if (safe === null) return NaN
      const [r, g, b] = hexToRgb(safe)
      const rL = srgbToLinear(r)
      const gL = srgbToLinear(g)
      const bL = srgbToLinear(b)
      return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL
    }

    /**
     * Contrast ratio per WCAG 2.1.
     * Returns 0 if either input is invalid (so passesWcagAA returns false).
     */
    export function contrastRatio(fg: string, bg: string): number {
      const Lfg = relativeLuminance(fg)
      const Lbg = relativeLuminance(bg)
      if (Number.isNaN(Lfg) || Number.isNaN(Lbg)) return 0
      const lighter = Math.max(Lfg, Lbg)
      const darker = Math.min(Lfg, Lbg)
      return (lighter + 0.05) / (darker + 0.05)
    }

    /** True iff contrast ratio meets WCAG AA threshold (4.5:1). */
    export function passesWcagAA(textColor: string, bgColor: string): boolean {
      return contrastRatio(textColor, bgColor) >= WCAG_AA_THRESHOLD
    }

    // ─── Internal: derive validated palette ───────────────────────────────────

    type ResolvedPalette = {
      bg: string
      text: string
      primary: string
      accent: string
      fontDisplay: WhitelistedFont
      fontBody: WhitelistedFont
      /** True if WCAG fallback was applied (bg+text reverted to defaults). */
      wcagFallback: boolean
      /** True if any invalid value was rejected. */
      hadInvalid: boolean
    }

    function resolvePalette(theme: IssueTheme): ResolvedPalette {
      let hadInvalid = false

      const candidateBg = theme && validateHex(theme.backgroundColor)
      const candidateText = theme && validateHex(theme.textColor)
      const candidatePrimary = theme && validateHex(theme.primaryColor)
      const candidateAccent = theme && validateHex(theme.accentColor)
      const candidateDisplay = theme && validateFont(theme.fontDisplay)
      const candidateBody = theme && validateFont(theme.fontBody)

      // Track invalid inputs (when theme provided a value that failed validation).
      if (theme) {
        if (theme.backgroundColor && !candidateBg) hadInvalid = true
        if (theme.textColor && !candidateText) hadInvalid = true
        if (theme.primaryColor && !candidatePrimary) hadInvalid = true
        if (theme.accentColor && !candidateAccent) hadInvalid = true
        if (theme.fontDisplay && !candidateDisplay) hadInvalid = true
        if (theme.fontBody && !candidateBody) hadInvalid = true
      }

      let bg = candidateBg ?? BRAND_DEFAULTS.bg
      let text = candidateText ?? BRAND_DEFAULTS.text
      const primary = candidatePrimary ?? BRAND_DEFAULTS.primary
      const accent = candidateAccent ?? BRAND_DEFAULTS.accent
      const fontDisplay = candidateDisplay ?? BRAND_DEFAULTS.fontDisplay
      const fontBody = candidateBody ?? BRAND_DEFAULTS.fontBody

      // WCAG AA gate on bg+text. If the candidate pair fails, fall back both.
      let wcagFallback = false
      if (!passesWcagAA(text, bg)) {
        bg = BRAND_DEFAULTS.bg
        text = BRAND_DEFAULTS.text
        wcagFallback = true
      }

      return { bg, text, primary, accent, fontDisplay, fontBody, wcagFallback, hadInvalid }
    }

    // ─── Server-side: serialize to inline <style> string (no FOUC) ────────────

    /**
     * Produce a `:root { --color-bg: #...; ... }` string from a validated palette.
     * Safe to embed in <style> in <head>. Every value passes validateHex or
     * FONT_WHITELIST before reaching the output.
     *
     * Per CONTEXT.md D-11: server-rendered inline <script>/<style> injects
     * theme on first paint to avoid FOUC. This is the helper that produces it.
     */
    export function serializeThemeCss(theme: IssueTheme): string {
      const p = resolvePalette(theme)
      // Order doesn't matter semantically; alphabetized for diff stability.
      return [
        ':root {',
        `  --color-accent: ${p.accent};`,
        `  --color-bg: ${p.bg};`,
        `  --color-primary: ${p.primary};`,
        `  --color-text: ${p.text};`,
        `  --font-body: '${p.fontBody}', serif;`,
        `  --font-display: '${p.fontDisplay}', serif;`,
        '}',
      ].join('\n')
    }

    // ─── Client-side: apply via setProperty (defense-in-depth) ────────────────

    /**
     * Inject theme onto element.style via setProperty. NEVER uses cssText,
     * innerHTML, or template-literal CSS. Per WEB-08.
     *
     * Idempotent: safe to call multiple times (hydration re-runs).
     */
    export function applyTheme(element: HTMLElement, theme: IssueTheme): void {
      try {
        const p = resolvePalette(theme)
        // ONLY setProperty. No exceptions.
        element.style.setProperty('--color-bg', p.bg)
        element.style.setProperty('--color-text', p.text)
        element.style.setProperty('--color-primary', p.primary)
        element.style.setProperty('--color-accent', p.accent)
        element.style.setProperty('--font-display', `'${p.fontDisplay}', serif`)
        element.style.setProperty('--font-body', `'${p.fontBody}', serif`)

        if (p.wcagFallback) {
          const ratio = theme
            ? contrastRatio(theme.textColor ?? '', theme.backgroundColor ?? '')
            : 0
          console.warn(
            `[theme] WCAG AA fallback applied. Theme contrast ${ratio.toFixed(2)}:1 < ${WCAG_AA_THRESHOLD}:1. Using brand default bg/text.`,
          )
        }
        if (p.hadInvalid && !p.wcagFallback) {
          console.warn(
            '[theme] Some theme values failed validation and fell back to brand defaults. Check Sanity theme fields.',
          )
        }
      } catch (err) {
        // Never crash the page over theme injection. Render brand default.
        console.warn('[theme] applyTheme threw; falling back to defaults.', err)
        try {
          element.style.setProperty('--color-bg', BRAND_DEFAULTS.bg)
          element.style.setProperty('--color-text', BRAND_DEFAULTS.text)
          element.style.setProperty('--color-primary', BRAND_DEFAULTS.primary)
          element.style.setProperty('--color-accent', BRAND_DEFAULTS.accent)
          element.style.setProperty('--font-display', `'${BRAND_DEFAULTS.fontDisplay}', serif`)
          element.style.setProperty('--font-body', `'${BRAND_DEFAULTS.fontBody}', serif`)
        } catch {
          /* if even setProperty throws, give up silently — page still renders. */
        }
      }
    }
    ```

    Forbidden patterns inside this file (executor must NOT introduce):
    - `element.style.cssText = ...`
    - `element.innerHTML = ...` referencing theme data
    - Backtick template strings constructing `<style>...${themeValue}...</style>` from unvalidated input

    Quoting `--font-display` / `--font-body` values uses single quotes so the CSS variable value is well-formed (`'Playfair Display', serif`). The font name itself comes from FONT_WHITELIST, which is hardcoded — no injection risk.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/lib/theme.ts && \
      grep -q 'HEX_REGEX = /\^#\[0-9a-fA-F\]{6}\$/' apps/web/lib/theme.ts && \
      grep -q 'WCAG_AA_THRESHOLD = 4\.5' apps/web/lib/theme.ts && \
      grep -q 'FONT_WHITELIST' apps/web/lib/theme.ts && \
      grep -q "'Playfair Display'" apps/web/lib/theme.ts && \
      grep -q "'Lora'" apps/web/lib/theme.ts && \
      grep -q "'Inter'" apps/web/lib/theme.ts && \
      grep -q "'Cormorant Garamond'" apps/web/lib/theme.ts && \
      grep -q "'Merriweather'" apps/web/lib/theme.ts && \
      grep -q "'DM Serif Display'" apps/web/lib/theme.ts && \
      grep -q "bg:.*'#FAFAF8'" apps/web/lib/theme.ts && \
      grep -q "text:.*'#1A1A18'" apps/web/lib/theme.ts && \
      grep -q "primary:.*'#2D5016'" apps/web/lib/theme.ts && \
      grep -q "accent:.*'#8B1A1A'" apps/web/lib/theme.ts && \
      grep -q 'export function validateHex' apps/web/lib/theme.ts && \
      grep -q 'export function passesWcagAA' apps/web/lib/theme.ts && \
      grep -q 'export function relativeLuminance' apps/web/lib/theme.ts && \
      grep -q 'export function contrastRatio' apps/web/lib/theme.ts && \
      grep -q 'export function serializeThemeCss' apps/web/lib/theme.ts && \
      grep -q 'export function applyTheme' apps/web/lib/theme.ts && \
      grep -q '0\.2126' apps/web/lib/theme.ts && \
      grep -q '0\.7152' apps/web/lib/theme.ts && \
      grep -q '0\.0722' apps/web/lib/theme.ts && \
      grep -q "element\.style\.setProperty" apps/web/lib/theme.ts && \
      ! grep -q "element\.style\.cssText" apps/web/lib/theme.ts && \
      ! grep -q "innerHTML.*theme" apps/web/lib/theme.ts && \
      [ $(wc -l < apps/web/lib/theme.ts) -gt 180 ]
    </automated>
  </verify>
  <done>
    `theme.ts` exports validateHex, passesWcagAA, relativeLuminance, contrastRatio, applyTheme, serializeThemeCss, FONT_WHITELIST, BRAND_DEFAULTS. WCAG math is implemented inline (no third-party color lib). applyTheme uses ONLY setProperty. serializeThemeCss returns a `:root {}` string from validated values. File is >180 lines.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Smoke-test theme.ts validators and WCAG math</name>
  <read_first>
    - apps/web/lib/theme.ts (the file produced by Task 1)
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md (Security Contract section — assertions to encode as tests)
  </read_first>
  <behavior>
    Validate behavior described in Task 1's behavior block. Tests run via `node --test` (no test runner dep added — Node 22 includes test runner natively). All tests must pass.

    Required assertions:
    - validateHex accepts '#FF0000', '#abc123', rejects '#FFF', 'red', 'rgb(255,0,0)', '#GG0000', '', undefined, null, 42
    - relativeLuminance('#FFFFFF') is approximately 1; relativeLuminance('#000000') === 0
    - contrastRatio('#000000', '#FFFFFF') approximately 21
    - passesWcagAA('#1A1A18', '#FAFAF8') === true (brand default pair)
    - passesWcagAA('#CCCCCC', '#FFFFFF') === false
    - passesWcagAA('red', '#FFFFFF') === false (invalid input)
    - serializeThemeCss(null) returns ':root { ... }' containing only brand defaults
    - serializeThemeCss({ primaryColor: 'not-a-hex', backgroundColor: '#FAFAF8', textColor: '#1A1A18', fontDisplay: 'Comic Sans MS', fontBody: 'Lora' }) — primary falls back to default; fontDisplay falls back to Playfair Display; fontBody stays as Lora
    - serializeThemeCss with invalid theme never throws and never contains the literal 'not-a-hex' substring
    - FONT_WHITELIST contains exactly 6 entries
  </behavior>
  <files>apps/web/lib/theme.test.ts</files>
  <action>
    Create `apps/web/lib/theme.test.ts`:

    ```typescript
    /**
     * Smoke tests for the theme engine security contract.
     * Run with: node --test --import tsx/esm apps/web/lib/theme.test.ts
     *
     * Phase 2 ships these as a lightweight check — no test framework dep.
     * Phase 5 may extend with a proper Vitest/Jest setup if test surface grows.
     */
    import { test } from 'node:test'
    import assert from 'node:assert/strict'
    import {
      validateHex,
      relativeLuminance,
      contrastRatio,
      passesWcagAA,
      serializeThemeCss,
      FONT_WHITELIST,
      BRAND_DEFAULTS,
      HEX_REGEX,
    } from './theme'

    test('validateHex: accepts 6-digit hex (lower/upper)', () => {
      assert.equal(validateHex('#FF0000'), '#FF0000')
      assert.equal(validateHex('#abc123'), '#abc123')
      assert.equal(validateHex('#0A1B2C'), '#0A1B2C')
    })

    test('validateHex: rejects 3-digit shorthand', () => {
      assert.equal(validateHex('#FFF'), null)
      assert.equal(validateHex('#abc'), null)
    })

    test('validateHex: rejects named colors', () => {
      assert.equal(validateHex('red'), null)
      assert.equal(validateHex('blue'), null)
      assert.equal(validateHex('rebeccapurple'), null)
    })

    test('validateHex: rejects rgb/hsl/var', () => {
      assert.equal(validateHex('rgb(255,0,0)'), null)
      assert.equal(validateHex('hsl(0, 100%, 50%)'), null)
      assert.equal(validateHex('var(--whatever)'), null)
    })

    test('validateHex: rejects non-hex characters', () => {
      assert.equal(validateHex('#GG0000'), null)
      assert.equal(validateHex('#ZZZZZZ'), null)
    })

    test('validateHex: rejects non-strings', () => {
      assert.equal(validateHex(undefined), null)
      assert.equal(validateHex(null), null)
      assert.equal(validateHex(42), null)
      assert.equal(validateHex({}), null)
      assert.equal(validateHex(''), null)
    })

    test('relativeLuminance: white is 1, black is 0', () => {
      assert.ok(Math.abs(relativeLuminance('#FFFFFF') - 1) < 1e-6)
      assert.equal(relativeLuminance('#000000'), 0)
    })

    test('relativeLuminance: invalid input returns NaN', () => {
      assert.ok(Number.isNaN(relativeLuminance('red')))
      assert.ok(Number.isNaN(relativeLuminance('#FFF')))
    })

    test('contrastRatio: black on white is ~21', () => {
      assert.ok(Math.abs(contrastRatio('#000000', '#FFFFFF') - 21) < 0.01)
    })

    test('contrastRatio: same-color is 1', () => {
      assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1)
    })

    test('contrastRatio: invalid input returns 0', () => {
      assert.equal(contrastRatio('red', '#FFFFFF'), 0)
      assert.equal(contrastRatio('#000000', 'invalid'), 0)
    })

    test('passesWcagAA: brand default pair passes', () => {
      assert.equal(passesWcagAA(BRAND_DEFAULTS.text, BRAND_DEFAULTS.bg), true)
    })

    test('passesWcagAA: light gray on white fails', () => {
      assert.equal(passesWcagAA('#CCCCCC', '#FFFFFF'), false)
    })

    test('passesWcagAA: invalid input fails', () => {
      assert.equal(passesWcagAA('red', '#FFFFFF'), false)
    })

    test('FONT_WHITELIST: exactly 6 entries', () => {
      assert.equal(FONT_WHITELIST.length, 6)
      assert.ok(FONT_WHITELIST.includes('Playfair Display'))
      assert.ok(FONT_WHITELIST.includes('Lora'))
      assert.ok(FONT_WHITELIST.includes('Inter'))
    })

    test('serializeThemeCss: null theme produces brand-default :root block', () => {
      const css = serializeThemeCss(null)
      assert.ok(css.startsWith(':root {'))
      assert.ok(css.endsWith('}'))
      assert.ok(css.includes(BRAND_DEFAULTS.bg))
      assert.ok(css.includes(BRAND_DEFAULTS.text))
      assert.ok(css.includes(BRAND_DEFAULTS.primary))
      assert.ok(css.includes(BRAND_DEFAULTS.accent))
      assert.ok(css.includes("'Playfair Display'"))
      assert.ok(css.includes("'Lora'"))
    })

    test('serializeThemeCss: rejects invalid hex and falls back', () => {
      const css = serializeThemeCss({
        primaryColor: 'not-a-hex',
        accentColor: '"><script>alert(1)</script>',
        backgroundColor: '#FAFAF8',
        textColor: '#1A1A18',
        fontDisplay: 'Comic Sans MS',
        fontBody: 'Lora',
      })
      // The literal injection attempt must NOT appear in output.
      assert.ok(!css.includes('not-a-hex'))
      assert.ok(!css.includes('<script>'))
      assert.ok(!css.includes('Comic Sans MS'))
      // Falls back for invalid; accepts valid Lora.
      assert.ok(css.includes(BRAND_DEFAULTS.primary)) // fallback applied
      assert.ok(css.includes(BRAND_DEFAULTS.accent))  // fallback applied
      assert.ok(css.includes("'Playfair Display'"))   // font fallback
      assert.ok(css.includes("'Lora'"))               // valid font kept
    })

    test('serializeThemeCss: low-contrast theme reverts bg+text', () => {
      // Light gray text on white bg — fails WCAG AA.
      const css = serializeThemeCss({
        primaryColor: '#2D5016',
        accentColor: '#8B1A1A',
        backgroundColor: '#FFFFFF',
        textColor: '#CCCCCC',
        fontDisplay: 'Playfair Display',
        fontBody: 'Lora',
      })
      // Bg+text fell back to brand defaults.
      assert.ok(css.includes(BRAND_DEFAULTS.bg))
      assert.ok(css.includes(BRAND_DEFAULTS.text))
      // Primary+accent retained.
      assert.ok(css.includes('#2D5016'))
      assert.ok(css.includes('#8B1A1A'))
    })

    test('HEX_REGEX is exactly the locked pattern', () => {
      assert.equal(HEX_REGEX.source, '^#[0-9a-fA-F]{6}$')
    })
    ```
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/lib/theme.test.ts && \
      grep -q "node:test" apps/web/lib/theme.test.ts && \
      grep -q "validateHex" apps/web/lib/theme.test.ts && \
      grep -q "passesWcagAA" apps/web/lib/theme.test.ts && \
      grep -q "serializeThemeCss" apps/web/lib/theme.test.ts && \
      grep -q "HEX_REGEX" apps/web/lib/theme.test.ts && \
      grep -q "not-a-hex" apps/web/lib/theme.test.ts && \
      grep -q "<script>" apps/web/lib/theme.test.ts && \
      pnpm --filter web exec node --test --import tsx/esm apps/web/lib/theme.test.ts 2>&1 | tail -5
    </automated>
  </verify>
  <done>
    `apps/web/lib/theme.test.ts` exists and `node --test` runs all assertions without failure. Tests cover: hex validation (positive/negative cases), WCAG math endpoints, contrast pass/fail, font whitelist size, serializeThemeCss safety (injection attempt does NOT appear in output), WCAG fallback path.

    Note: If `tsx` is not in apps/web devDependencies, the executor may either (a) add `tsx@^4.19.0` to apps/web/devDependencies and re-install, or (b) run the test via apps/studio's tsx (which is workspace-resolvable from repo root): `pnpm exec tsx --test apps/web/lib/theme.test.ts`. Either is acceptable. Document the chosen approach in the SUMMARY.
  </done>
</task>

</tasks>

<verification>
- `apps/web/lib/theme.ts` exists, >180 lines, exports validateHex/passesWcagAA/relativeLuminance/contrastRatio/applyTheme/serializeThemeCss/FONT_WHITELIST/BRAND_DEFAULTS
- Hex regex is exactly `/^#[0-9a-fA-F]{6}$/`
- WCAG luminance coefficients (0.2126, 0.7152, 0.0722) present
- `element.style.setProperty` is the only DOM-mutation API used
- `cssText` and theme-data `innerHTML` are absent
- `node --test apps/web/lib/theme.test.ts` exits 0
</verification>

<success_criteria>
- All four WEB-* security requirements satisfied: WEB-06 (CSS variables for theme), WEB-07 (hex regex validation), WEB-08 (setProperty only), WEB-09 (WCAG AA + fallback)
- Brand default palette matches UI-SPEC exactly (#FAFAF8, #1A1A18, #2D5016, #8B1A1A)
- FONT_WHITELIST contains the 6 fonts in UI-SPEC default set
- serializeThemeCss never emits unvalidated input — tests prove injection attempts are filtered
- applyTheme never throws; falls back silently on unexpected error
</success_criteria>

<output>
After completion, create `.planning/phases/02-web-shell-theme-engine/02-03-theme-engine-SUMMARY.md` recording: exported surface, WCAG threshold, whitelist size, and a one-line note that Phase 5 will extend FONT_WHITELIST (and that doing so is a one-line append — no other code change required).
</output>
