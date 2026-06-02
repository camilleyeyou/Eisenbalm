/**
 * P17-04 source-scan tripwire — Phase 17 Wave 0.
 *
 * Asserts that four loading.tsx skeleton files exist at the required App Router
 * route segments, and that none of them nest a <main> landmark (the root layout
 * owns <main id="main">; loading.tsx files must use <div> or semantic elements).
 *
 * All four existence assertions are intentionally RED on the current
 * pre-implementation codebase (the loading.tsx files do not exist yet); they
 * turn GREEN when Wave 2 (Plan 17-04) creates the four skeleton files.
 *
 * Same pattern as archive-cardswap.test.ts (Phase 11): readFileSync + existsSync,
 * no DOM, no React render, no mocks.
 *
 * If any assertion fails, DO NOT delete it or weaken it. Fix the source instead.
 * This file IS the codebase-level guard for Phase 17 P17-04.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

// ─── Target paths (relative to this test file) ────────────────────────────────

const LOADING_PATHS = [
  resolve(__dirname, '../app/issue/[slug]/loading.tsx'),
  resolve(__dirname, '../app/archive/loading.tsx'),
  resolve(__dirname, '../app/charities/loading.tsx'),
  resolve(__dirname, '../app/charities/[slug]/loading.tsx'),
] as const

// ─── P17-04: loading.tsx files exist at all 4 route segments ─────────────────

describe('P17-04: loading.tsx skeleton files exist at required route segments', () => {
  it('app/issue/[slug]/loading.tsx exists', () => {
    expect(existsSync(LOADING_PATHS[0])).toBe(true)
  })

  it('app/archive/loading.tsx exists', () => {
    expect(existsSync(LOADING_PATHS[1])).toBe(true)
  })

  it('app/charities/loading.tsx exists', () => {
    expect(existsSync(LOADING_PATHS[2])).toBe(true)
  })

  it('app/charities/[slug]/loading.tsx exists', () => {
    expect(existsSync(LOADING_PATHS[3])).toBe(true)
  })
})

// ─── P17-04: no loading.tsx nests a <main> landmark ──────────────────────────

describe('P17-04: loading.tsx files must not nest a <main> element', () => {
  // Guard the readFileSync with existsSync: if the file is missing, the
  // existence test above already provides the clear RED signal. Reading a
  // non-existent file would throw and obscure the root cause.

  it('app/issue/[slug]/loading.tsx has no <main> element', () => {
    if (!existsSync(LOADING_PATHS[0])) return
    const src = readFileSync(LOADING_PATHS[0], 'utf-8')
    expect(src).not.toContain('<main')
  })

  it('app/archive/loading.tsx has no <main> element', () => {
    if (!existsSync(LOADING_PATHS[1])) return
    const src = readFileSync(LOADING_PATHS[1], 'utf-8')
    expect(src).not.toContain('<main')
  })

  it('app/charities/loading.tsx has no <main> element', () => {
    if (!existsSync(LOADING_PATHS[2])) return
    const src = readFileSync(LOADING_PATHS[2], 'utf-8')
    expect(src).not.toContain('<main')
  })

  it('app/charities/[slug]/loading.tsx has no <main> element', () => {
    if (!existsSync(LOADING_PATHS[3])) return
    const src = readFileSync(LOADING_PATHS[3], 'utf-8')
    expect(src).not.toContain('<main')
  })
})
