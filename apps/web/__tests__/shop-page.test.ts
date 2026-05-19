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
