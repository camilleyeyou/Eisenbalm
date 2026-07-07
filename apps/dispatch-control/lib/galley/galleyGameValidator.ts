/**
 * Phase 32 (D-05) — galley game-embed validator and srcdoc head injector.
 *
 * This is a deliberate DUPLICATE (per D-06 cross-app decoupling — the
 * galley never imports from the reader site) of the reader site's
 * lib/game-validator.ts. KEEP IN SYNC: if the banned-construct list or
 * head-injection behavior changes in the reader site's module, mirror the
 * change here.
 *
 * Threat surface: the galley's game preview mounts inside an iframe
 * sandboxed with `sandbox="allow-scripts"` (no allow-same-origin), so the
 * page has a null origin and cannot reach the parent cookie jar, storage,
 * or DOM. This module adds two defence layers:
 *
 *   1. validateEmbedCode — static string/regex scan that rejects known
 *      forbidden constructs before the iframe ever mounts.
 *
 *   2. injectGameHead — prepends a CSP meta tag (connect-src 'none')
 *      plus a viewport meta and mobile CSS reset into the srcdoc. The CSP
 *      backstop catches obfuscated forms the validator misses (e.g.
 *      `window["fetch"]`). The CSS reset prevents the embedded game from
 *      overflowing a 360px viewport.
 *
 * Both functions are pure (no I/O, no React, no Convex).
 */

// ─── Deny-list ─────────────────────────────────────────────────────────────
export const BANNED_PATTERNS: ReadonlyArray<{
  readonly pattern: string | RegExp
  readonly label: string
}> = [
  { pattern: 'window.parent',    label: 'parent frame access (window.parent)' },
  { pattern: 'window.top',       label: 'top frame access (window.top)' },
  { pattern: /\btop\./,          label: 'top global property access (top.)' },
  { pattern: /\bparent\./,       label: 'parent global property access (parent.)' },
  { pattern: 'fetch(',           label: 'network request (fetch)' },
  { pattern: 'XMLHttpRequest',   label: 'network request (XMLHttpRequest)' },
  { pattern: 'document.cookie',  label: 'cookie access (document.cookie)' },
  { pattern: 'document.domain',  label: 'document.domain' },
  { pattern: 'localStorage',     label: 'storage access (localStorage)' },
  { pattern: 'eval(',            label: 'dynamic evaluation (eval)' },
  { pattern: 'import(',          label: 'dynamic import' },
  { pattern: /<script[^>]+src\s*=/i,  label: 'external script (<script src=...>)' },
  { pattern: /<link[^>]+href\s*=/i,   label: 'external stylesheet (<link href=...>)' },
]

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

export function validateEmbedCode(embedCode: string): ValidationResult {
  if (typeof embedCode !== 'string' || embedCode.length === 0) {
    return { valid: false, reason: 'Embed code is empty' }
  }
  for (const { pattern, label } of BANNED_PATTERNS) {
    const found = typeof pattern === 'string'
      ? embedCode.includes(pattern)
      : pattern.test(embedCode)
    if (found) {
      return { valid: false, reason: `Forbidden construct: ${label}` }
    }
  }
  return { valid: true }
}

// ─── CSP policy ───────────────────────────────────────────────────────────
export const GAME_CSP_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

// ─── Head injection (CSP + viewport + mobile reset) ───────────────────────
export const GAME_HEAD: string = [
  `<meta http-equiv="Content-Security-Policy" content="${GAME_CSP_POLICY}">`,
  `<meta name="viewport" content="width=device-width, initial-scale=1">`,
  `<style>`,
  `  * { box-sizing: border-box; }`,
  `  html, body { margin: 0; padding: 0; overflow-x: hidden; max-width: 100%; }`,
  `  canvas, svg, img { max-width: 100% !important; height: auto; }`,
  `</style>`,
].join('\n')

/**
 * Prepend the CSP meta tag, viewport tag, and mobile CSS reset to the
 * embed code. Always prepend — do not try to match `<head>` because LLM
 * output may omit it.
 */
export function injectGameHead(embedCode: string): string {
  return `${GAME_HEAD}\n${embedCode}`
}
