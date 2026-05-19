/**
 * Phase 7 game embed-code validator and srcdoc head injector.
 *
 * Threat surface (07-RESEARCH §Threat Model): the iframe is sandboxed
 * with `sandbox="allow-scripts"` (no allow-same-origin), so the page
 * has a null origin and cannot reach the parent cookie jar, storage,
 * or DOM. This module adds two defence layers:
 *
 *   1. validateEmbedCode — static string/regex scan that rejects known
 *      forbidden constructs before the iframe ever mounts. Mirrors
 *      FORBIDDEN_CONSTRUCTS in
 *      packages/pipeline/src/eisenbalm_pipeline/agents/game.py.
 *      KEEP IN SYNC if either list changes.
 *
 *   2. injectGameHead — prepends a CSP meta tag (connect-src 'none')
 *      plus a viewport meta and mobile CSS reset into the srcdoc.
 *      The CSP backstop catches obfuscated forms the validator misses
 *      (e.g. `window["fetch"]`). The CSS reset prevents the embedded
 *      game from overflowing a 360px viewport (GAM-06).
 *
 * Both functions are pure (no I/O, no React, no Convex). The Convex
 * write on validation failure lives in GameSlot.tsx (Plan 07-03).
 */

// ─── Deny-list (mirrors Python FORBIDDEN_CONSTRUCTS) ──────────────────────
//
// Order matters only for the reason string returned on first match.
// The 13 entries below cover the 10 Python entries PLUS the 3 extras
// called out in the ROADMAP requirement text (GAM-02):
//   top.          property access on top global
//   parent.       property access on parent global
//   document.domain   same-origin policy bypass
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
//
// Why each directive (07-RESEARCH §CSP Injection — Detailed Notes):
//   default-src 'none'        deny by default; every unlisted directive
//                             falls back to none.
//   script-src 'unsafe-inline'  required — game JS is inline and dynamic;
//                             no nonce/hash possible.
//   style-src 'unsafe-inline'   inline <style> in the game.
//   img-src data:             allow base64 sprites; block HTTP images.
//   connect-src 'none'        BACKSTOP for fetch/XHR/WebSocket. Catches
//                             obfuscated forms the deny-list misses.
//   frame-src 'none'          no nested iframes.
//   object-src 'none'         no plugins.
//   base-uri 'none'           no <base> tag redirect of relative URLs.
//   form-action 'none'        no form submission.
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
//
// Pitfall 4 (07-RESEARCH): the meta CSP MUST appear before any inline
// <script>. Always prepend to the document rather than chasing <head>
// — browsers apply meta CSP at parse time, not DOM-order time, but
// prepending is the only guarantee for malformed LLM HTML output.
//
// The mobile reset (GAM-06 substrate):
//   * { box-sizing: border-box }       prevent width-overflow surprises
//   html, body { overflow-x:hidden; max-width:100%; margin:0; padding:0 }
//   canvas, svg, img { max-width:100% !important; height:auto }
//
// The iframe container in GameSlot has overflow-hidden, but a game
// with a hardcoded 800px canvas would be clipped — partial render.
// The reset coerces the canvas to fit, which is the correct UX even
// if it means the canvas re-rasterizes at the smaller size.
const GAME_HEAD: string = [
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
 * embed code. Always prepend (Pitfall 4) — do not try to match <head>
 * because LLM output may omit it.
 */
export function injectGameHead(embedCode: string): string {
  return `${GAME_HEAD}\n${embedCode}`
}
