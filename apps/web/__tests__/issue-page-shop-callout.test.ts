/**
 * CMR-09 source-scan: every issue page must render a persistent shop section
 * with data-shop-callout attribute.
 *
 * Phase 55: BuyBand (components/dispatch) replaces the Phase 19 ShopBand and
 * Phase 2 issue ShopCallout. The tripwire now guards BuyBand + BalmCounter.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const ISSUE_PAGE_PATH = resolve(__dirname, '../app/issue/[slug]/page.tsx')
const LAYOUT_PATH = resolve(__dirname, '../components/issue/IssueLayout.tsx')
const BUY_BAND_PATH = resolve(__dirname, '../components/dispatch/BuyBand.tsx')
const BALM_COUNTER_PATH = resolve(__dirname, '../components/dispatch/BalmCounter.tsx')

function codeOnly(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('CMR-09: Persistent shop section on every issue page', () => {
  it('issue page file exists', () => {
    expect(existsSync(ISSUE_PAGE_PATH)).toBe(true)
  })

  it('BuyBand exists with data-shop-callout and links to /shop', () => {
    expect(existsSync(BUY_BAND_PATH)).toBe(true)
    const source = readFileSync(BUY_BAND_PATH, 'utf8')
    expect(source).toContain('data-shop-callout')
    expect(source).toContain('href="/shop"')
  })

  it('issue layout renders <BuyBand', () => {
    expect(readFileSync(LAYOUT_PATH, 'utf8')).toContain('<BuyBand')
  })

  it('BuyBand and BalmCounter contain no banner/modal/popup/countdown/hurry patterns (brand voice)', () => {
    for (const p of [BUY_BAND_PATH, BALM_COUNTER_PATH]) {
      const code = codeOnly(readFileSync(p, 'utf8'))
      expect(code).not.toMatch(/banner|modal|popup|countdown|hurry/i)
    }
  })
})
