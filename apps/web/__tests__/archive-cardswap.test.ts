/**
 * ARC-01 source-scan tripwire — Phase 11 Wave 0.
 *
 * Asserts the ARC-01 acceptance contract for the CardSwap archive component,
 * the archive page wiring, the no-new-npm-dependency constraint, and the
 * FONT_WHITELIST security invariant. Same pattern as game-sandbox.test.ts
 * (Phase 7 GAM-03) and issue-page-typography.test.ts (Phase 10): readFileSync
 * at test runtime, no DOM, no React render, no mocks.
 *
 * CardSwap.tsx does NOT exist yet (Plan 02 creates it). All CardSwap-dependent
 * assertions read the file INSIDE each it() callback via readCardSwap() so
 * Vitest collection does not throw while the file is absent — the assertions
 * simply fail with ENOENT, which is the expected RED state until Plan 02.
 *
 * Files that already exist (archive/page.tsx, package.json, theme.ts) are read
 * at describe scope in the normal pattern.
 *
 * If any assertion fails, DO NOT delete it or weaken it. Fix the source instead.
 * This file IS the codebase-level guard for Phase 11 ARC-01.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

// ─── Paths ────────────────────────────────────────────────────────────────────

const CARDSWAP_PATH      = resolve(__dirname, '../components/archive/CardSwap.tsx')
const ARCHIVE_PAGE_PATH  = resolve(__dirname, '../app/archive/page.tsx')
const PACKAGE_JSON_PATH  = resolve(__dirname, '../package.json')
const THEME_PATH         = resolve(__dirname, '../lib/theme.ts')

// ─── Comment-stripping helper ─────────────────────────────────────────────────

/**
 * Strip block, JSX block, and line comments so pattern matches target code
 * behavior (identifiers, attributes, JSX) rather than documentation prose.
 * Mirrors the codeOnly() helpers in deliberation-no-model-names.test.ts and
 * issue-page-typography.test.ts.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments (incl. JSDoc)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')  // JSX block comments {/* ... */}
    .replace(/(^|[^:])\/\/.*$/gm, '$1')    // line comments (don't eat URL ://)
}

// ─── CardSwap lazy reader — inside it() callbacks so collection never throws ──

/**
 * Read CardSwap.tsx at assertion time (not at describe scope).
 * This pattern ensures Vitest can collect this file without error even when
 * CardSwap.tsx does not exist yet (Plan 01 Wave 0 → Plan 02 Wave 2 lifecycle).
 * See STATE.md Phase 9 decision: "readFileSync for non-existent files must be
 * inside each it() callback (not describe.skip body) — Vitest still evaluates
 * describe bodies during collection to register it blocks".
 */
function readCardSwap(): string {
  return readFileSync(CARDSWAP_PATH, 'utf-8')
}

// ─── ARC-01: CardSwap source-scan ─────────────────────────────────────────────

describe('ARC-01: CardSwap source-scan', () => {
  it('CardSwap.tsx exists and is non-empty', () => {
    expect(readCardSwap().length).toBeGreaterThan(0)
  })

  it('binds to ArchiveIssue prop — no hardcoded issue content', () => {
    const src = readCardSwap()
    // Must reference the ArchiveIssue type (type import or usage)
    expect(src).toContain('ArchiveIssue')
    // Must NOT contain hardcoded spec sample strings
    expect(codeOnly(src)).not.toContain('Project Solitude')
    expect(codeOnly(src)).not.toContain('Issue 042')
    expect(codeOnly(src)).not.toContain('Atacama')
  })

  it('declares the prefers-reduced-motion guard', () => {
    expect(readCardSwap()).toContain('prefers-reduced-motion')
  })

  it('uses matchMedia for the reduced-motion gate', () => {
    expect(readCardSwap()).toContain('matchMedia')
  })

  it('has data-print-hide="true" on the wrapper', () => {
    expect(readCardSwap()).toContain('data-print-hide="true"')
  })

  it('uses a <section> wrapper and adds no second <main>', () => {
    const src = readCardSwap()
    // No <main> in code (CardSwap is a sub-component, not a page root)
    expect(codeOnly(src)).not.toContain('<main')
    // Must use a semantic <section> wrapper
    expect(src).toContain('<section')
  })

  it('indicator/control buttons carry aria-label and aria-current', () => {
    const src = readCardSwap()
    expect(src).toContain('aria-label')
    expect(src).toContain('aria-current')
  })

  it('imports formatMonthYear from @/lib/format (no duplicate date formatter)', () => {
    expect(readCardSwap()).toContain('formatMonthYear')
  })

  it('has no CDN <script> tag or @import (no gsap, no Iconify)', () => {
    const code = codeOnly(readCardSwap())
    expect(code).not.toContain('<script')
    expect(code).not.toContain('@import')
    expect(code).not.toContain('cdnjs')
    expect(code).not.toMatch(/gsap/i)
    expect(code).not.toContain('framer-motion')
  })
})

// ─── ARC-01: archive page wires CardSwap ──────────────────────────────────────

describe('ARC-01: archive page wires CardSwap', () => {
  // archive/page.tsx already exists — read at describe scope is safe.
  const archivePageSource = readFileSync(ARCHIVE_PAGE_PATH, 'utf-8')

  it('archive/page.tsx imports CardSwap', () => {
    expect(archivePageSource).toContain('CardSwap')
  })

  it('archive/page.tsx renders <CardSwap issues=', () => {
    expect(archivePageSource).toMatch(/<CardSwap\s+issues=/)
  })
})

// ─── ARC-01: no new npm dependency ────────────────────────────────────────────

describe('ARC-01: no new npm dependency', () => {
  // package.json already exists — read at describe scope is safe.
  const packageJsonSource = readFileSync(PACKAGE_JSON_PATH, 'utf-8')

  it('apps/web/package.json declares no gsap or framer-motion dependency', () => {
    const pkg = JSON.parse(packageJsonSource) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const allDepKeys = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]
    expect(allDepKeys).not.toContain('gsap')
    expect(allDepKeys).not.toContain('framer-motion')
    expect(allDepKeys).not.toContain('@iconify/react')
  })

  it('apps/web/package.json dependency count is unchanged at the Phase 11 baseline', () => {
    const pkg = JSON.parse(packageJsonSource) as {
      dependencies?: Record<string, string>
    }
    // Phase 11 baseline — bump ONLY with an approved dependency decision
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(17)
  })
})

// ─── Security: FONT_WHITELIST unchanged ───────────────────────────────────────

describe('Security: FONT_WHITELIST unchanged', () => {
  // theme.ts already exists — read at describe scope is safe.
  const themeSource = readFileSync(THEME_PATH, 'utf-8')

  it('theme.ts FONT_WHITELIST still has exactly 6 entries', () => {
    // Assert each of the 6 canonical entries is present
    expect(themeSource).toContain("'Playfair Display'")
    expect(themeSource).toContain("'Lora'")
    expect(themeSource).toContain("'Inter'")
    expect(themeSource).toContain("'Cormorant Garamond'")
    expect(themeSource).toContain("'Merriweather'")
    expect(themeSource).toContain("'DM Serif Display'")
    // Assert no unapproved additions are present
    expect(themeSource).not.toContain('Spectral')
    expect(themeSource).not.toContain('IBM Plex Mono')
  })
})
