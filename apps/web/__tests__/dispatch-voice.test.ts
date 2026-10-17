import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { formatUsd } from '@/lib/site'
import * as copy from '@/lib/dispatch/copy'

const root = join(__dirname, '..')
const copyPath = join(root, 'lib/dispatch/copy.ts')

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('dispatch copy behaviour', () => {
  it('derives price', () => {
    expect(formatUsd(899)).toBe('$8.99')
    expect(copy.PRICE_LABEL).toBe('$8.99')
    expect(copy.FUND_CTA).toBe('Fund them · $8.99')
  })
  it('fundButtonLabel', () => {
    expect(copy.fundButtonLabel('Acme Wheels')).toBe('Fund Acme Wheels · $8.99')
    expect(copy.fundButtonLabel('x'.repeat(29))).toBe(copy.FUND_CTA)
    expect(copy.fundButtonLabel(null)).toBe(copy.FUND_CTA)
  })
  it('HOW_STEPS', () => {
    expect(copy.HOW_STEPS.map((s) => s.lead + s.rest)).toEqual([
      'Each Thursday we select one small nonprofit most people have not heard of.',
      'We tell its story, start to finish, on this page.',
      'Every lip balm sold that week funds it. The full $8.99. 100% to them.',
    ])
  })
  it('SECTION_META order', () => {
    expect(copy.SECTION_META.map((s) => s.id)).toEqual(['origin', 'problem', 'founder', 'case', 'game', 'bonus', 'delib', 'pod'])
    expect(copy.SECTION_META.map((s) => s.number)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08'])
  })
  it('bonusLabel', () => {
    expect(copy.bonusLabel('specAd')).toBe('The ad we made them')
    expect(copy.bonusLabel('jingle')).toBe('The jingle we made them')
    expect(copy.bonusLabel('bigBudget')).toBe('The production we made them')
  })
  it('buyLead', () => {
    expect(copy.buyLead('Acme', null)).toBe('Every lip balm sold this week sends its full $8.99 to Acme.')
    expect(copy.buyLead('Acme', { min: 12, max: 20, unit: 'wheelchair' })).toBe(
      'Every lip balm sold this week sends its full $8.99 to Acme. About 12 to 20 balms covers one wheelchair.',
    )
  })
  it('searchStatus', () => {
    expect(copy.searchStatus(1)).toBe('1 nonprofit')
    expect(copy.searchStatus(3)).toBe('3 nonprofits')
  })
})

describe('voice denylist', () => {
  const files = [copyPath, ...walk(join(root, 'components/dispatch'))]
  const deny = ['monday', '[live count]', 'release 001', 'hand-numbered', 'panel of ais', 'cats. also on wheels', 'illustration ·', 'goes here', 'coming soon', 'lorem']
  for (const f of files) {
    it(`clean: ${f.replace(root, '')}`, () => {
      const src = readFileSync(f, 'utf8')
      const lower = src.toLowerCase()
      for (const d of deny) expect(lower, d).not.toContain(d)
      expect(src).not.toContain('8.99')
    })
  }
  it('copy.ts has no exclamation marks in literals and says Thursday', () => {
    const src = readFileSync(copyPath, 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g
    let m: RegExpExecArray | null
    while ((m = re.exec(code))) expect(m[2], m[2]).not.toContain('!')
    expect(src).toContain('Thursday')
  })
})
