/** Phase 55 SC-5: every Fund CTA reaches checkout. Source-scan. */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { describe, it, expect } from 'vitest'

const root = resolve(__dirname, '..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf-8')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : [],
  )
}
const files = walk(resolve(root, 'components/dispatch'))

describe('Fund CTA wiring', () => {
  it('every {FUND_CTA} sits inside an anchor to #buy', () => {
    let total = 0
    let anchored = 0
    for (const f of files) {
      const src = readFileSync(f, 'utf-8')
      total += (src.match(/\{FUND_CTA\}/g) ?? []).length
      anchored += (src.match(/<a\b[^>]*href="#buy"[^>]*>\s*\{FUND_CTA\}/g) ?? []).length
    }
    expect(total).toBeGreaterThan(0)
    expect(anchored).toBe(total)
  })

  it('only FundButton starts checkout', () => {
    for (const f of files) {
      const src = readFileSync(f, 'utf-8')
      expect(src).not.toContain('/api/checkout/create-session')
      if (!f.endsWith('FundButton.tsx')) expect(src).not.toContain('startCheckout')
    }
    expect(read('components/dispatch/FundButton.tsx')).toContain('startCheckout')
  })

  it('BuyBand hosts #buy and FundButton; IssueLayout renders BuyBand', () => {
    const buy = read('components/dispatch/BuyBand.tsx')
    expect(buy).toContain('id="buy"')
    expect(buy).toContain('<FundButton')
    expect(read('components/issue/IssueLayout.tsx')).toContain('<BuyBand')
  })

  it('checkout client posts to create-session', () => {
    expect(read('lib/checkout-client.ts')).toContain('/api/checkout/create-session')
  })

  it('root layout: ChromeSwitch, one main, DispatchFooter outside main', () => {
    const layout = read('app/layout.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    expect(layout).toContain('<ChromeSwitch')
    expect((layout.match(/<main/g) ?? []).length).toBe(1)
    expect(layout).toContain('dispatch={<DispatchFooter')
    expect(layout.indexOf('<DispatchFooter')).toBeGreaterThan(layout.indexOf('</main>'))
  })
})
