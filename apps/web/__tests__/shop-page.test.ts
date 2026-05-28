/**
 * CMR-01 source-scan: /shop is server-rendered with charity callout, no
 * client flicker.
 *
 * Asserts:
 *   - apps/web/app/shop/page.tsx exists.
 *   - The first non-comment line is NOT 'use client' — the page is a
 *     server component.
 *   - The page imports sanityClient (server-side Sanity read).
 *   - The default export is `async function` (server component).
 *   - The page renders a <BuyButton /> (client-only purchase trigger).
 *   - The page declares ISR with `export const revalidate = N`.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const SHOP_PAGE_PATH = resolve(__dirname, '../app/shop/page.tsx')

describe('CMR-01: /shop server-rendered with charity callout (no client flicker)', () => {
  it('shop page file exists', () => {
    expect(existsSync(SHOP_PAGE_PATH)).toBe(true)
  })

  it('does NOT declare "use client" at the top of file', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    // Strip leading comments/whitespace then check first non-comment line.
    const firstNonCommentLine = source
      .split(/\n/)
      .find(
        (l) =>
          l.trim().length > 0 &&
          !l.trim().startsWith('//') &&
          !l.trim().startsWith('/*') &&
          !l.trim().startsWith('*'),
      )
    expect(firstNonCommentLine ?? '').not.toMatch(/^['"]use client['"]/)
  })

  it('imports sanityClient (server-side Sanity read)', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/from\s+['"]@\/lib\/sanity\/client['"]/)
  })

  it('exports an async default function (server component)', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/export\s+default\s+async\s+function/)
  })

  it('renders a BuyButton component (client-only purchase trigger)', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/<BuyButton/)
  })

  it('declares ISR with export const revalidate', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/export\s+const\s+revalidate\s*=\s*\d+/)
  })
})

describe('Phase 15: /shop long-scroll structure', () => {
  it('renders BuyButton in at least 2 positions', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source.match(/<BuyButton/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('renders #shop-hero section', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/id=["']shop-hero["']/)
  })

  it('renders #shop-features section', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/id=["']shop-features["']/)
  })

  it('renders #shop-buy section', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/id=["']shop-buy["']/)
  })

  it('renders #shop-faq section', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/id=["']shop-faq["']/)
  })

  it('hero tagline is present verbatim', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/Stop\. Breathe\. Balm\./)
  })

  it('no urgency vocabulary in shop page source (CMR-09 extension)', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    // Strip block comments, JSX comment blocks, and line comments (Phase 8 codeOnly() pattern).
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\/.*$/gm, '')
    expect(codeOnly).not.toMatch(/\blimited\b/i)
    expect(codeOnly).not.toMatch(/only\s+\d+\s+left/i)
    expect(codeOnly).not.toMatch(/\bcountdown\b/i)
    expect(codeOnly).not.toMatch(/\bhurry\b/i)
    expect(codeOnly).not.toMatch(/\bact\s+now\b/i)
  })

  it('no hardcoded 6-digit hex values in shop page source (SHOP-09)', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    // Strip comments so doc-strings cannot trip the rule; assert against code only.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\/.*$/gm, '')
    expect(codeOnly).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })

  it('includes at least one TODO(Andrew) marker (image slots / price / edition)', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/TODO\(Andrew\)/)
  })

  it('uses native <details>/<summary> for the FAQ accordion (zero-JS)', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/<details/)
    expect(source).toMatch(/<summary/)
  })
})
