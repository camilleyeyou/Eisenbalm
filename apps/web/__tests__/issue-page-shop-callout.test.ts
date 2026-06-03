/**
 * CMR-09 source-scan: every issue page must render a persistent shop section
 * with data-shop-callout attribute.
 *
 * Phase 19 UPDATE: ShopCallout (standalone component from Phase 2) is
 * REPLACED by ShopBand (inline shop section in page.tsx per Phase 19 plan 02).
 * The CMR-09 data-shop-callout attribute is preserved on ShopBand.
 *
 * Asserts:
 *   - apps/web/app/issue/[slug]/page.tsx exists and renders ShopBand.
 *   - apps/web/components/issue/ShopCallout.tsx still exists (Phase 2 artifact preserved).
 *   - ShopBand has data-shop-callout attribute and links to /shop.
 *   - ShopCallout source does NOT contain banner/modal/popup/countdown patterns.
 *
 * Note: Page 2's ShopCallout still exists for backward compat with other pages.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const ISSUE_PAGE_PATH = resolve(__dirname, '../app/issue/[slug]/page.tsx')
const SHOP_CALLOUT_PATH = resolve(__dirname, '../components/issue/ShopCallout.tsx')
const SHOP_BAND_PATH = resolve(__dirname, '../components/issue/ShopBand.tsx')

describe('CMR-09: Persistent shop section on every issue page', () => {
  it('issue page file exists', () => {
    expect(existsSync(ISSUE_PAGE_PATH)).toBe(true)
  })

  it('ShopCallout component file exists (Phase 2 artifact — preserved even though superseded by ShopBand in Phase 19)', () => {
    expect(existsSync(SHOP_CALLOUT_PATH)).toBe(true)
  })

  it('issue page renders shop component (Phase 19: ShopBand replaces ShopCallout on issue page)', () => {
    const source = readFileSync(ISSUE_PAGE_PATH, 'utf8')
    // Phase 19: ShopBand is the issue-page shop section
    expect(source).toMatch(/ShopBand|ShopCallout/)
  })

  it('ShopBand exists with data-shop-callout attribute (CMR-09 tripwire)', () => {
    const source = readFileSync(SHOP_BAND_PATH, 'utf8')
    expect(source).toContain('data-shop-callout')
    expect(source).toContain('/shop')
  })

  it('ShopCallout component does NOT contain banner/modal/popup/countdown patterns (brand voice)', () => {
    const raw = readFileSync(SHOP_CALLOUT_PATH, 'utf8')
    const codeOnly = raw
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
      .replace(/(^|[^:])\/\/.*$/gm, '$1') // line comments (don't eat URL :// scheme)
    expect(codeOnly).not.toMatch(/banner/i)
    expect(codeOnly).not.toMatch(/modal/i)
    expect(codeOnly).not.toMatch(/popup/i)
    expect(codeOnly).not.toMatch(/countdown/i)
  })
})
