/**
 * P17-05 source-scan tripwire — Phase 17 Wave 0.
 *
 * Asserts that the /about page no longer shows the "This page is being written"
 * placeholder string, and that the <article> structural wrapper is preserved.
 *
 * The "no placeholder" assertion is intentionally RED on the current
 * pre-implementation codebase (the placeholder IS present); it turns GREEN
 * when Wave 2 (Plan 17-05) replaces the placeholder with interim copy and a
 * TODO(Andrew) gate.
 *
 * The <article> assertion is GREEN immediately and acts as a regression guard
 * to ensure the structural wrapper is not accidentally removed during the copy
 * replacement.
 *
 * Same pattern as archive-cardswap.test.ts (Phase 11): readFileSync, no DOM.
 *
 * If any assertion fails, DO NOT delete it or weaken it. Fix the source instead.
 * This file IS the codebase-level guard for Phase 17 P17-05.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

// ─── Path ─────────────────────────────────────────────────────────────────────

const ABOUT_PATH = resolve(__dirname, '../app/about/page.tsx')

// ─── P17-05: /about page copy ────────────────────────────────────────────────

describe('P17-05: /about page has real copy (no placeholder text)', () => {
  const src = readFileSync(ABOUT_PATH, 'utf-8')

  it('does not contain the "This page is being written" placeholder', () => {
    expect(src).not.toContain('This page is being written')
  })

  it('has an <article> structural wrapper', () => {
    expect(src).toContain('<article')
  })
})
