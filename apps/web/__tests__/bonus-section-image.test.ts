/**
 * P17-01 source-scan tripwire — Phase 17 Wave 0.
 *
 * Asserts that BonusSection.tsx uses next/image (with fill) for storyboard
 * rendering, not a raw <img> element. These tests are intentionally RED on the
 * current pre-implementation codebase; they turn GREEN when Wave 2 (Plan 17-02)
 * converts BonusSection to next/image.
 *
 * Same pattern as archive-cardswap.test.ts (Phase 11): readFileSync at test
 * runtime, no DOM, no React render, no mocks.
 *
 * If any assertion fails, DO NOT delete it or weaken it. Fix the source instead.
 * This file IS the codebase-level guard for Phase 17 P17-01.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

// ─── Path ─────────────────────────────────────────────────────────────────────

const BONUS_PATH = resolve(__dirname, '../components/issue/BonusSection.tsx')

// ─── Comment-stripping helper ─────────────────────────────────────────────────

/**
 * Strip block, JSX block, and line comments so pattern matches target code
 * behavior (identifiers, attributes, JSX) rather than documentation prose.
 * Mirrors the codeOnly() helper in archive-cardswap.test.ts.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments (incl. JSDoc)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')  // JSX block comments {/* ... */}
    .replace(/(^|[^:])\/\/.*$/gm, '$1')    // line comments (don't eat URL ://)
}

// ─── P17-01: BonusSection uses next/image not raw img for storyboards ─────────

describe('P17-01: BonusSection uses next/image not raw img for storyboards', () => {
  const src = readFileSync(BONUS_PATH, 'utf-8')

  it("imports Image from 'next/image'", () => {
    expect(src).toContain("from 'next/image'")
  })

  it('uses <Image component for storyboard rendering', () => {
    expect(src).toContain('<Image')
  })

  it('uses fill prop on the Image component', () => {
    expect(src).toContain('fill')
  })

  it('has no raw <img> element in code (eslint-disable removed)', () => {
    // Strip all comments before asserting no raw <img>
    // This prevents a comment like "/* keep <img> */" from matching
    const code = codeOnly(src)
    expect(code).not.toContain('<img')
  })

  it('has no eslint-disable no-img-element comment', () => {
    expect(src).not.toContain('@next/next/no-img-element')
  })

  it('storyboard wrapper has relative positioning for fill (relative aspect-video)', () => {
    expect(src).toContain('relative aspect-video')
  })

  it('provides sizes prop for responsive image optimization', () => {
    expect(src).toContain('sizes=')
  })
})
