/**
 * GAM-03 source-scan tripwire.
 *
 * Phase 7 deliberately does NOT add ESLint to apps/web (no eslint.config.js
 * exists). Instead, this Vitest test reads GameSlot.tsx from disk at
 * runtime and fails if the literal string `allow-same-origin` appears
 * anywhere in the file — including comments. It also positively asserts
 * that `sandbox="allow-scripts"` IS present, so a future edit that
 * removes the sandbox attribute entirely is also caught.
 *
 * Why two assertions:
 *   - Negative ("not contain allow-same-origin") catches additive errors.
 *   - Positive ("contains allow-scripts") catches removal errors.
 *
 * If this test fails, DO NOT delete it or weaken the assertions. Fix
 * the GameSlot.tsx source instead. The whole point is that this test
 * IS the codebase-level guard.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const GAME_SLOT_PATH = resolve(__dirname, '../components/issue/GameSlot.tsx')

describe('GAM-03: GameSlot sandbox security source-scan', () => {
  const source = readFileSync(GAME_SLOT_PATH, 'utf-8')

  it('never contains the literal string "allow-same-origin"', () => {
    // Negative assertion. allow-same-origin + allow-scripts together
    // defeats the sandbox: the sandboxed page can rewrite its own
    // sandbox attribute via DOM manipulation. This test fails the
    // build if any future edit (including a comment) reintroduces it.
    expect(source).not.toContain('allow-same-origin')
  })

  it('contains sandbox="allow-scripts" (positive sandbox contract)', () => {
    // Positive assertion. If a future edit removes the iframe entirely
    // or replaces the sandbox attribute, this test fails — surfacing
    // the change for review.
    expect(source).toContain('sandbox="allow-scripts"')
  })

  it('GameSlot.tsx file exists at the expected path', () => {
    // Tripwire for refactors that rename or move GameSlot. If the
    // component moves, this test must be updated to point at the new
    // path — the failure makes that maintenance step impossible to
    // overlook.
    expect(source.length).toBeGreaterThan(0)
  })
})
