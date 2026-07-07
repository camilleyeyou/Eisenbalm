/**
 * Phase 32 (D-05, Plan 32-01 Wave 0 RED) — galley game-embed validator
 * parity tests.
 *
 * D-06/32-RESEARCH.md anti-pattern: do NOT import
 * `apps/web/lib/game-validator.ts` directly (cross-app coupling) — that
 * 131-line, zero-dependency module is duplicated into
 * `apps/dispatch-control/lib/galley/galleyGameValidator.ts` instead. This
 * test asserts PARITY with the apps/web original (same BANNED_PATTERNS
 * count, same rejection/acceptance behavior) so the galley's sandboxed
 * game iframe (`srcdoc` + `sandbox="allow-scripts"`) gets the identical
 * defence-in-depth static scan before the sandbox ever mounts.
 *
 * RED at authoring time: `../lib/galley/galleyGameValidator` does not
 * exist yet. Turns GREEN in Plan 32-05/32-06.
 */
import { describe, it, expect } from 'vitest'
import { validateEmbedCode, BANNED_PATTERNS } from '../lib/galley/galleyGameValidator'

describe('galleyGameValidator — parity with apps/web/lib/game-validator.ts', () => {
  it('BANNED_PATTERNS has at least 13 entries (apps/web parity)', () => {
    expect(BANNED_PATTERNS.length).toBeGreaterThanOrEqual(13)
  })

  it('rejects a fetch-inside-script payload', () => {
    const result = validateEmbedCode('<script>fetch("/x")</script>')
    expect(result.valid).toBe(false)
  })

  it('rejects window.parent access', () => {
    const result = validateEmbedCode('window.parent.location')
    expect(result.valid).toBe(false)
  })

  it('rejects window.top access', () => {
    const result = validateEmbedCode('window.top.location')
    expect(result.valid).toBe(false)
  })

  it('rejects document.cookie access', () => {
    const result = validateEmbedCode('console.log(document.cookie)')
    expect(result.valid).toBe(false)
  })

  it('rejects an external <script src=...> tag', () => {
    const result = validateEmbedCode('<script src="https://evil.example/x.js"></script>')
    expect(result.valid).toBe(false)
  })

  it('accepts a benign canvas + inline-script payload', () => {
    const result = validateEmbedCode('<canvas></canvas><script>let x=1</script>')
    expect(result.valid).toBe(true)
  })

  it('rejects an empty embed code', () => {
    const result = validateEmbedCode('')
    expect(result.valid).toBe(false)
  })
})
