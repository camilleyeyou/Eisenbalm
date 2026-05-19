/**
 * CMR-09 source-scan: every issue page must render the persistent
 * ShopCallout component (Phase 2 contract; Phase 8 verification gate).
 *
 * Asserts:
 *   - apps/web/app/issue/[slug]/page.tsx exists and imports ShopCallout
 *     from @/components/issue/ShopCallout.
 *   - The JSX renders <ShopCallout /> (or <ShopCallout ... />).
 *   - apps/web/components/issue/ShopCallout.tsx exists (Phase 2 artifact).
 *   - ShopCallout source does NOT contain banner/modal/popup/countdown
 *     patterns. Per the brief and REQUIREMENTS.md Out of Scope table, the
 *     shop callout is one sentence + one button — never a banner, modal,
 *     popup, or countdown timer.
 *
 * The Phase 2 issue page already imports and renders ShopCallout, so this
 * test is expected to pass immediately (Phase 2 inheritance).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const ISSUE_PAGE_PATH = resolve(__dirname, '../app/issue/[slug]/page.tsx')
const SHOP_CALLOUT_PATH = resolve(__dirname, '../components/issue/ShopCallout.tsx')

describe('CMR-09: Persistent ShopCallout on every issue page', () => {
  it('issue page file exists', () => {
    expect(existsSync(ISSUE_PAGE_PATH)).toBe(true)
  })

  it('ShopCallout component file exists (Phase 2 artifact)', () => {
    expect(existsSync(SHOP_CALLOUT_PATH)).toBe(true)
  })

  it('issue page imports ShopCallout component', () => {
    const source = readFileSync(ISSUE_PAGE_PATH, 'utf8')
    expect(source).toMatch(
      /import\s+\{\s*ShopCallout\s*\}\s+from\s+['"]@\/components\/issue\/ShopCallout['"]/,
    )
  })

  it('issue page renders <ShopCallout /> in JSX', () => {
    const source = readFileSync(ISSUE_PAGE_PATH, 'utf8')
    expect(source).toMatch(/<ShopCallout\s*(?:\s+[^>]*)?\/?>/)
  })

  it('ShopCallout component does NOT contain banner/modal/popup/countdown patterns (brand voice)', () => {
    const raw = readFileSync(SHOP_CALLOUT_PATH, 'utf8')
    // Strip block comments and line comments so the regex matches behavior
    // (JSX, className tokens, JS identifiers) rather than documentation
    // prose. The Phase 2 ShopCallout docstring intentionally uses the word
    // "banner" to explain what NOT to do — that's contract, not code.
    const codeOnly = raw
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
      .replace(/(^|[^:])\/\/.*$/gm, '$1') // line comments (don't eat URL :// scheme)
    expect(codeOnly).not.toMatch(/banner/i)
    expect(codeOnly).not.toMatch(/modal/i)
    expect(codeOnly).not.toMatch(/popup/i)
    expect(codeOnly).not.toMatch(/countdown/i)
    // Note: the Phase 2 ShopCallout already passes this check.
  })
})
