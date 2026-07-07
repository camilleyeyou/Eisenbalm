/**
 * Phase 32 (GLY-01, D-04) — whitelist-validated dynamic Google Fonts loader
 * for the galley (Review Desk native content renderer).
 *
 * No dynamic Google Fonts loading mechanism exists elsewhere in this
 * codebase — the reader site's theming uses `next/font/google` at build
 * time, which cannot take a runtime string. This module validates an
 * incoming theme font name against a duplicated `FONT_WHITELIST` (same
 * list/reasoning as the reader site's theme module — never trust the
 * draft's `theme.fontDisplay`/`fontBody` string directly) before injecting
 * a `<link rel="stylesheet">` tag, deduped by font name.
 *
 * Security invariants (duplicated from the reader site's theme engine,
 * D-06 cross-app decoupling — this file imports nothing from the reader
 * app):
 *   1. No font is loaded unless it is a member of FONT_WHITELIST.
 *   2. No color/accent is applied unless it passes the 6-digit hex regex.
 *   3. `element.style.setProperty()` is the ONLY DOM API used to inject
 *      accent values at runtime — never cssText, never innerHTML.
 */

/**
 * Duplicated verbatim from the reader site's theme module (9-name frozen
 * whitelist). Extending this list is a one-line append here — no other
 * change required.
 */
export const FONT_WHITELIST = Object.freeze([
  'Playfair Display',
  'Lora',
  'Inter',
  'Cormorant Garamond',
  'Merriweather',
  'DM Serif Display',
  'Fraunces',
  'Newsreader',
  'IBM Plex Mono',
] as const)

export type WhitelistedFont = (typeof FONT_WHITELIST)[number]

/** Strict 6-digit hex regex — rejects shorthand, named colors, rgb(), var(), etc. */
export const HEX_REGEX = /^#[0-9a-fA-F]{6}$/

/** Return `value` iff it is a whitelisted font name; else `null`. */
export function validateFont(value: unknown): WhitelistedFont | null {
  if (typeof value !== 'string') return null
  const whitelist: readonly string[] = FONT_WHITELIST
  return whitelist.includes(value) ? (value as WhitelistedFont) : null
}

/** Return `value` iff it matches the 6-digit hex regex; else `null`. */
export function validateHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return HEX_REGEX.test(value) ? value : null
}

/**
 * Injects a Google Fonts `<link>` for `fontName` iff whitelisted; deduped
 * by font family. Returns `true` if a valid font was applied
 * (already-present or newly injected), `false` if rejected. Never trusts
 * the raw theme string.
 */
export function ensureThemeFont(fontName: unknown): boolean {
  if (typeof document === 'undefined') return false

  const font = validateFont(fontName)
  if (!font) return false

  const existingLinks = Array.from(
    document.head.querySelectorAll('link[data-galley-font]')
  ) as Element[]
  const alreadyPresent = existingLinks.some(
    (el) => el.getAttribute('data-galley-font') === font
  )
  if (alreadyPresent) return true

  const family = encodeURIComponent(font).replace(/%20/g, '+')
  const href = `https://fonts.googleapis.com/css2?family=${family}:ital,wght@0,400;0,600;1,400&display=swap`

  const link = document.createElement('link')
  link.setAttribute('rel', 'stylesheet')
  link.setAttribute('href', href)
  link.setAttribute('data-galley-font', font)
  document.head.appendChild(link)
  return true
}

/**
 * Validates `accent` as a 6-digit hex color and, only on pass, applies it
 * to `el` via `setProperty` (never cssText/innerHTML). Returns `true` iff
 * applied.
 */
export function applyThemeAccent(accent: unknown, el: HTMLElement): boolean {
  const hex = validateHex(accent)
  if (!hex) return false
  el.style.setProperty('--galley-accent', hex)
  return true
}
