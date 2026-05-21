/**
 * LOCKED mobile-nav disclosure guard — SiteHeader source-scan.
 *
 * UNSKIP in Plan 09-04 when SiteHeader.tsx gets its mobile-nav disclosure
 * implementation (aria-expanded, aria-controls, Escape handler, Open/Close menu).
 * The describe.skip keeps this suite green at scaffold time.
 *
 * The current SiteHeader.tsx (Phase 2) has NO mobile-nav disclosure attributes,
 * so the assertions below would fail if not skipped. The skip is the guard:
 * Plan 09-04 unskips and makes these pass, ensuring the mobile nav NEVER
 * disappears from future edits.
 *
 * Per 09-CONTEXT.md LOCKED constraints:
 *   - Mobile nav must NOT disappear.
 *   - aria-labels must be "Open menu" and "Close menu".
 *   - Escape key must close the menu.
 *
 * readFileSync is INSIDE the describe.skip callback so collection never
 * throws against the current stub which lacks these patterns.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

// UNSKIP in Plan 09-04
describe.skip('SiteHeader mobile-nav disclosure', () => {
  const PATH = resolve(__dirname, '../components/SiteHeader.tsx')
  const source = readFileSync(PATH, 'utf-8')

  it('has aria-expanded attribute (disclosure state)', () => {
    expect(source).toContain('aria-expanded')
  })

  it('has aria-controls attribute (links button to menu panel)', () => {
    expect(source).toContain('aria-controls')
  })

  it('has an Escape-key handler (keyboard close support)', () => {
    expect(source).toMatch(/'Escape'|"Escape"|key === 'Escape'/)
  })

  it('has "Open menu" aria-label (open state)', () => {
    expect(source).toContain('Open menu')
  })

  it('has "Close menu" aria-label (close state)', () => {
    expect(source).toContain('Close menu')
  })
})
