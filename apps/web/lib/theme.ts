/**
 * Theme engine — security-critical. WEB-06, WEB-07, WEB-08, WEB-09.
 *
 * INVARIANTS (must hold across every code path):
 *   1. No CSS variable is set without passing validateHex (for colors) or
 *      FONT_WHITELIST membership (for fonts).
 *   2. element.style.setProperty(name, value) is the ONLY DOM API used to
 *      inject theme values at runtime. Never cssText, never innerHTML,
 *      never style=string-concat.
 *   3. Server-side serializeThemeCss returns a string built ONLY from
 *      validated values; it is safe to embed in a <style> tag in <head>.
 *   4. Contrast check (>= 4.5:1) gates bg+text; failing pairs fall back to
 *      BRAND_DEFAULTS.bg + BRAND_DEFAULTS.text.
 *   5. No third-party color/contrast lib — ~50 lines of WCAG math.
 *
 * Security contract references:
 *   - WEB-07: hex regex /^#[0-9a-fA-F]{6}$/ before any CSS variable is set
 *   - WEB-08: element.style.setProperty() ONLY for DOM injection
 *   - WEB-09: WCAG AA contrast check (>= 4.5:1); fallback on failure
 *   - D-10 / D-12 from 02-CONTEXT.md: brand fallback palette definition
 */

import type { IssueTheme } from './sanity/types'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Strict hex regex — 6-digit only.
 * Rejects: 3-digit shorthand (#FFF), named colors (red), rgb(), hsl(),
 * var(), empty string, non-strings, 8-digit hex (with alpha), non-hex chars.
 */
export const HEX_REGEX = /^#[0-9a-fA-F]{6}$/

/** WCAG AA contrast threshold for body text. */
export const WCAG_AA_THRESHOLD = 4.5

/**
 * Phase 2 font whitelist — 6 safe Google Fonts that work for both
 * next/font/google (web) and WeasyPrint (Phase 6 PDF rendering).
 *
 * Phase 5 (DesignAgent) extends this list after Andrew/designer approval.
 * Extending the whitelist is a one-line append here — no other code change
 * required.
 *
 * ANY font name not in this list is rejected and falls back to the brand
 * default for that role.
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
 * values, or fails WCAG AA contrast. Values from UI-SPEC color section
 * and CONTEXT.md D-12.
 *
 * Rationale: reads like a well-edited print magazine — muted, warm,
 * high-contrast. Does NOT look like a SaaS product or charity template.
 */
export const BRAND_DEFAULTS = Object.freeze({
  bg:          '#FAFAF8',   // off-white; warm, editorial, not clinical
  text:        '#1A1A18',   // near-black; high contrast on default bg
  primary:     '#2D5016',   // forest green; editorial authority
  accent:      '#8B1A1A',   // deep crimson; restraint as CTA color
  fontDisplay: 'Playfair Display' as WhitelistedFont,
  fontBody:    'Lora' as WhitelistedFont,
  fontUi:      'Inter' as WhitelistedFont,  // NEVER overridden by theme
} as const)

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * Return value iff it matches the 6-digit hex regex; else null.
 *
 * Rejects: undefined, null, non-strings, named colors (e.g. "red"),
 * shorthand hex (#FFF), rgb(), hsl(), var(), 8-digit hex, non-hex chars.
 *
 * @example
 *   validateHex('#FF0000')      // => '#FF0000'
 *   validateHex('#abc123')      // => '#abc123'
 *   validateHex('#FFF')         // => null (3-digit rejected)
 *   validateHex('red')          // => null (named color rejected)
 *   validateHex('rgb(255,0,0)') // => null
 *   validateHex('#GG0000')      // => null (non-hex char)
 *   validateHex('')             // => null
 *   validateHex(undefined)      // => null
 *   validateHex(null)           // => null
 *   validateHex(42)             // => null
 */
export function validateHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return HEX_REGEX.test(value) ? value : null
}

/**
 * Whitelist-membership check for font names.
 *
 * Returns the font name as a WhitelistedFont if it is in FONT_WHITELIST;
 * otherwise null. Case-sensitive — font names must match exactly.
 *
 * @example
 *   validateFont('Lora')           // => 'Lora'
 *   validateFont('Comic Sans MS')  // => null
 *   validateFont(undefined)        // => null
 */
export function validateFont(value: unknown): WhitelistedFont | null {
  if (typeof value !== 'string') return null
  return (FONT_WHITELIST as readonly string[]).includes(value)
    ? (value as WhitelistedFont)
    : null
}

// ─── WCAG luminance math (no third-party lib) ─────────────────────────────────

/**
 * Convert 6-digit hex to [r, g, b] each in [0, 255].
 * Caller must ensure input has already passed validateHex.
 */
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

/**
 * sRGB channel (0–255) → linearized channel per WCAG 2.1.
 *
 * Formula:
 *   c_norm = channel / 255
 *   if c_norm <= 0.03928: linear = c_norm / 12.92
 *   else: linear = ((c_norm + 0.055) / 1.055) ^ 2.4
 */
function srgbToLinear(channel255: number): number {
  const c = channel255 / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * Relative luminance per WCAG 2.1.
 *
 * L = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear
 *
 * Returns NaN if input is not a valid 6-digit hex string (so callers
 * downstream get Number.isNaN === true rather than an erroneous ratio).
 *
 * @example
 *   relativeLuminance('#FFFFFF')  // => ~1
 *   relativeLuminance('#000000')  // => 0
 *   relativeLuminance('red')      // => NaN
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
 *
 * ratio = (L_lighter + 0.05) / (L_darker + 0.05)
 *
 * Returns 0 if either input is invalid (so passesWcagAA returns false,
 * triggering the fallback palette — the safe behaviour).
 *
 * @example
 *   contrastRatio('#000000', '#FFFFFF')  // => ~21
 *   contrastRatio('#FFFFFF', '#FFFFFF')  // => 1
 *   contrastRatio('red', '#FFFFFF')      // => 0 (invalid input)
 */
export function contrastRatio(fg: string, bg: string): number {
  const Lfg = relativeLuminance(fg)
  const Lbg = relativeLuminance(bg)
  if (Number.isNaN(Lfg) || Number.isNaN(Lbg)) return 0
  const lighter = Math.max(Lfg, Lbg)
  const darker  = Math.min(Lfg, Lbg)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * True iff the contrast ratio between textColor and bgColor meets the
 * WCAG AA threshold (4.5:1) for normal body text.
 *
 * Returns false if either argument fails validateHex.
 *
 * @example
 *   passesWcagAA('#1A1A18', '#FAFAF8')  // => true  (brand defaults pass)
 *   passesWcagAA('#CCCCCC', '#FFFFFF')  // => false (low contrast)
 *   passesWcagAA('red',     '#FFFFFF')  // => false (invalid input)
 */
export function passesWcagAA(textColor: string, bgColor: string): boolean {
  return contrastRatio(textColor, bgColor) >= WCAG_AA_THRESHOLD
}

// ─── Internal: derive validated palette ───────────────────────────────────────

type ResolvedPalette = {
  bg:           string
  text:         string
  primary:      string
  accent:       string
  fontDisplay:  WhitelistedFont
  fontBody:     WhitelistedFont
  /** True if WCAG fallback was applied (bg+text reverted to BRAND_DEFAULTS). */
  wcagFallback: boolean
  /** True if any supplied theme value was rejected by validation. */
  hadInvalid:   boolean
}

/**
 * Validate all theme values and return a fully resolved, safe palette.
 *
 * - Invalid hex values → brand default for that role
 * - Font not in whitelist → brand default font for that role
 * - bg+text pair fails WCAG AA → both revert to BRAND_DEFAULTS.bg / text
 *   (primary+accent keep their validated values regardless)
 */
function resolvePalette(theme: IssueTheme): ResolvedPalette {
  let hadInvalid = false

  // Validate each theme field. `null && ...` short-circuits to false/null
  // so null theme is handled cleanly — all candidates become null.
  const candidateBg      = theme ? validateHex(theme.backgroundColor) : null
  const candidateText    = theme ? validateHex(theme.textColor)        : null
  const candidatePrimary = theme ? validateHex(theme.primaryColor)     : null
  const candidateAccent  = theme ? validateHex(theme.accentColor)      : null
  const candidateDisplay = theme ? validateFont(theme.fontDisplay)     : null
  const candidateBody    = theme ? validateFont(theme.fontBody)        : null

  // Track: was a value supplied but rejected (not merely absent)?
  if (theme) {
    if (theme.backgroundColor && !candidateBg)      hadInvalid = true
    if (theme.textColor        && !candidateText)   hadInvalid = true
    if (theme.primaryColor     && !candidatePrimary) hadInvalid = true
    if (theme.accentColor      && !candidateAccent) hadInvalid = true
    if (theme.fontDisplay      && !candidateDisplay) hadInvalid = true
    if (theme.fontBody         && !candidateBody)   hadInvalid = true
  }

  // Apply brand defaults for any missing/invalid value.
  let bg      = candidateBg      ?? BRAND_DEFAULTS.bg
  let text    = candidateText    ?? BRAND_DEFAULTS.text
  const primary    = candidatePrimary ?? BRAND_DEFAULTS.primary
  const accent     = candidateAccent  ?? BRAND_DEFAULTS.accent
  const fontDisplay = candidateDisplay ?? BRAND_DEFAULTS.fontDisplay
  const fontBody    = candidateBody    ?? BRAND_DEFAULTS.fontBody

  // WCAG AA gate: if the candidate bg+text pair fails, revert BOTH to brand
  // defaults. Primary and accent are not involved in the contrast check.
  let wcagFallback = false
  if (!passesWcagAA(text, bg)) {
    bg = BRAND_DEFAULTS.bg
    text = BRAND_DEFAULTS.text
    wcagFallback = true
  }

  return { bg, text, primary, accent, fontDisplay, fontBody, wcagFallback, hadInvalid }
}

// ─── Server-side: serialize to inline <style> string (no FOUC) ────────────────

/**
 * Produce a `:root { --color-bg: #...; ... }` CSS string from a validated
 * palette. Safe to embed in a `<style>` tag in `<head>` for FOUC prevention.
 *
 * Every value in the output passes validateHex or FONT_WHITELIST membership
 * before reaching the string — raw theme input never appears in the output.
 *
 * Per CONTEXT.md D-11: server-rendered inline <style> injects theme on first
 * paint; client-side applyTheme() re-validates on hydration as defense-in-depth.
 *
 * CSS variable names match UI-SPEC exactly:
 *   --color-primary, --color-accent, --color-bg, --color-text,
 *   --font-display, --font-body
 * (--font-ui is never overridden by theme per UI-SPEC)
 *
 * @param theme - The raw IssueTheme object from Sanity (may be null).
 * @returns A `:root { ... }` CSS string with validated values only.
 *
 * @example
 *   serializeThemeCss(null)
 *   // => ':root {\n  --color-accent: #8B1A1A;\n  ...\n}'
 */
export function serializeThemeCss(theme: IssueTheme): string {
  const p = resolvePalette(theme)
  // CSS variable names ordered alphabetically for diff stability.
  // Font values wrapped in single quotes for CSS correctness.
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

// ─── Client-side: apply via setProperty (defense-in-depth) ────────────────────

/**
 * Inject theme CSS variables onto element.style via setProperty ONLY.
 *
 * This is the client-side counterpart to serializeThemeCss. It runs after
 * hydration and re-validates all values as defense-in-depth against any
 * server-side bypass. Safe to call multiple times (idempotent).
 *
 * Forbidden patterns (do NOT introduce in any code path):
 *   - style.cssText assignment
 *   - innerHTML assigned from user-supplied data
 *   - Template literals constructing <style> tags from theme values
 *
 * Per WEB-08: element.style.setProperty('--variable-name', value) is the
 * ONLY DOM API used to inject theme values.
 *
 * CSS variable names match UI-SPEC exactly:
 *   --color-primary, --color-accent, --color-bg, --color-text,
 *   --font-display, --font-body
 * (--font-ui is never set by this function)
 *
 * @param element - The HTMLElement to apply theme to (typically document.documentElement).
 * @param theme   - Raw IssueTheme from Sanity (may be null).
 *
 * On WCAG failure: applies fallback bg+text, logs console.warn with ratio.
 * On font validation failure: applies BRAND_DEFAULTS font.
 * Never throws — wraps in try/catch, falls back to brand defaults on error.
 */
export function applyTheme(element: HTMLElement, theme: IssueTheme): void {
  try {
    const p = resolvePalette(theme)

    // ONLY setProperty. No exceptions. No cssText. No innerHTML.
    element.style.setProperty('--color-bg',      p.bg)
    element.style.setProperty('--color-text',    p.text)
    element.style.setProperty('--color-primary', p.primary)
    element.style.setProperty('--color-accent',  p.accent)
    element.style.setProperty('--font-display',  `'${p.fontDisplay}', serif`)
    element.style.setProperty('--font-body',     `'${p.fontBody}', serif`)

    if (p.wcagFallback) {
      // Log the actual failing values for debugging, without leaking them
      // into the DOM. The palette that was applied is already safe.
      const rawText = theme?.textColor ?? ''
      const rawBg   = theme?.backgroundColor ?? ''
      const ratio   = contrastRatio(rawText, rawBg)
      console.warn(
        `[theme] WCAG AA fallback applied.` +
        ` Contrast ${ratio.toFixed(2)}:1 < ${WCAG_AA_THRESHOLD}:1` +
        ` (text: "${rawText}", bg: "${rawBg}").` +
        ` Applied brand default bg/text instead.`
      )
    }

    if (p.hadInvalid && !p.wcagFallback) {
      console.warn(
        '[theme] One or more theme values failed hex/font validation and' +
        ' fell back to brand defaults. Check the Sanity theme fields for' +
        ' this issue.'
      )
    }
  } catch (err) {
    // Never crash the page over theme injection. Render with brand defaults.
    console.warn('[theme] applyTheme threw unexpectedly; falling back to brand defaults.', err)
    try {
      // Attempt minimal safe fallback using only BRAND_DEFAULTS.
      element.style.setProperty('--color-bg',      BRAND_DEFAULTS.bg)
      element.style.setProperty('--color-text',    BRAND_DEFAULTS.text)
      element.style.setProperty('--color-primary', BRAND_DEFAULTS.primary)
      element.style.setProperty('--color-accent',  BRAND_DEFAULTS.accent)
      element.style.setProperty('--font-display',  `'${BRAND_DEFAULTS.fontDisplay}', serif`)
      element.style.setProperty('--font-body',     `'${BRAND_DEFAULTS.fontBody}', serif`)
    } catch {
      // If even setProperty throws (e.g., null element), give up silently.
      // The page still renders — it will use whatever CSS was already applied.
    }
  }
}
