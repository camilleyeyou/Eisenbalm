import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { contrastRatio, WCAG_AA_THRESHOLD } from '@/lib/theme'
import { PALETTE, NEUTRALS, INK, PAPER, inkFor } from '@/lib/brand'

const ROOT = join(__dirname, '..')
function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
const MAIN = join(ROOT, 'app/dispatch.css')
const CSS_FILES = [MAIN, ...walk(join(ROOT, 'components/dispatch')).filter((f) => f.endsWith('.css'))]
const strip = (s: string) => s.replace(/\/\*[^]*?\*\//g, '')
const css = strip(readFileSync(MAIN, 'utf8'))
const rule = (sel: string) => {
  const i = css.indexOf(sel + ' {')
  expect(i, sel).toBeGreaterThanOrEqual(0)
  return css.slice(i, css.indexOf('}', i))
}

describe('dispatch a11y: CSS rules', () => {
  it('.d-tap targets are >= 44px', () => expect(rule('.d-tap')).toContain('min-height:44px'))
  it('.d-pill targets are >= 44px', () => expect(rule('.d-pill')).toContain('min-height:44px'))
  it('focus ring is 3px solid', () => expect(rule('.dispatch :focus-visible')).toContain('outline:3px solid'))
  it('prefers-reduced-motion: reduce disables animation and transitions', () => {
    const i = css.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(i).toBeGreaterThanOrEqual(0)
    const block = css.slice(i)
    expect(block).toContain('animation:none')
    expect(block).toContain('transition:none')
  })
  it('smooth scroll only inside prefers-reduced-motion: no-preference', () => {
    const start = css.indexOf('@media (prefers-reduced-motion: no-preference)')
    expect(start).toBeGreaterThanOrEqual(0)
    const end = css.indexOf('@media (prefers-reduced-motion: reduce)')
    for (const m of css.matchAll(/scroll-behavior:smooth/g))
      expect(m.index!).toBeGreaterThan(start), expect(m.index!).toBeLessThan(end)
  })
  for (const f of CSS_FILES) {
    const src = strip(readFileSync(f, 'utf8'))
    it(`${f.replace(ROOT, '')}: animations respect reduced motion`, () => {
      if (/animation\s*:\s*(?!none)/.test(src)) expect(src).toContain('prefers-reduced-motion: reduce')
    })
    it(`${f.replace(ROOT, '')}: no focus outline removal without :focus-visible`, () => {
      if (/outline\s*:\s*(none|0)\b/.test(src)) expect(src).toContain(':focus-visible')
    })
  }
})

describe('dispatch a11y: contrast pairs (UI-SPEC Contrast rules)', () => {
  const AA: [string, string, string][] = [
    ['INK/PAPER', INK, PAPER], ['PAPER/blue', PAPER, PALETTE.blue], ['INK/green', INK, PALETTE.green],
    ['INK/red', INK, PALETTE.red], ['INK/yellow', INK, PALETTE.yellow],
    ['muted/PAPER', NEUTRALS.muted, PAPER], ['muted/yellow', NEUTRALS.muted, PALETTE.yellow],
    ['PAPER/INK', PAPER, INK], ['darkLead/INK', NEUTRALS.darkLead, INK],
    ['darkCaption/INK', NEUTRALS.darkCaption, INK], ['darkCaption/panel', NEUTRALS.darkCaption, NEUTRALS.panel],
    ['PAPER/panel', PAPER, NEUTRALS.panel], ['green/INK', PALETTE.green, INK], ['yellow/INK', PALETTE.yellow, INK],
  ]
  for (const [n, a, b] of AA)
    it(`${n} >= 4.5`, () => expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(WCAG_AA_THRESHOLD))
  for (const [n, a, b] of [['yellow/blue', PALETTE.yellow, PALETTE.blue], ['green/blue', PALETTE.green, PALETTE.blue]] as const)
    it(`${n} >= 3.0 (large text only)`, () => expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(3))
  for (const [n, a, b] of [['PAPER/red', PAPER, PALETTE.red], ['muted/red', NEUTRALS.muted, PALETTE.red], ['blue/INK', PALETTE.blue, INK]] as const)
    it(`forbidden ${n} < 4.5`, () => expect(contrastRatio(a, b)).toBeLessThan(WCAG_AA_THRESHOLD))
  it('white never sits on red', () => expect(inkFor(PALETTE.red)).toBe(INK))
})
