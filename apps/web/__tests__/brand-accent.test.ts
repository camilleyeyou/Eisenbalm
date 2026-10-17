import { describe, it, expect } from 'vitest'
import {
  PALETTE,
  NEUTRALS,
  INK,
  PAPER,
  toneForIssue,
  rotationForIssue,
  inkFor,
  serializeAccentCss,
} from '@/lib/brand'
import { validateHex, contrastRatio, WCAG_AA_THRESHOLD } from '@/lib/theme'

describe('brand accent rotation', () => {
  it('maps issues to tones starting with Issue 2 = green', () => {
    expect(toneForIssue(2)).toBe('green')
    expect(toneForIssue(3)).toBe('blue')
    expect(toneForIssue(4)).toBe('red')
    expect(toneForIssue(5)).toBe('yellow')
    expect(toneForIssue(6)).toBe('green')
    expect(toneForIssue(1)).toBe('yellow')
  })
  it('handles zero, negative and NaN', () => {
    expect(['green', 'blue', 'red', 'yellow']).toContain(toneForIssue(0))
    expect(['green', 'blue', 'red', 'yellow']).toContain(toneForIssue(-3))
    expect(toneForIssue(NaN)).toBe('green')
  })
  it('adjacent issues never share an accent', () => {
    for (let n = 1; n <= 40; n++) expect(toneForIssue(n)).not.toBe(toneForIssue(n + 1))
  })
  it('rotationForIssue(2)', () => {
    expect(rotationForIssue(2)).toEqual({
      accent: '#00FF79',
      second: '#005CFF',
      third: '#FF002B',
      fourth: '#EEFE34',
    })
  })
  it('inkFor picks accessible ink', () => {
    expect(inkFor('#00FF79')).toBe('#0A0A0A')
    expect(inkFor('#005CFF')).toBe('#FFFFFF')
    expect(inkFor('#FF002B')).toBe('#0A0A0A')
    expect(inkFor('#EEFE34')).toBe('#0A0A0A')
    for (const c of Object.values(PALETTE)) {
      expect(validateHex(c)).toBe(c)
      expect(contrastRatio(inkFor(c), c)).toBeGreaterThanOrEqual(WCAG_AA_THRESHOLD)
    }
  })
  it('serializeAccentCss is exact and only emits palette colours', () => {
    const css = serializeAccentCss(2)
    expect(css).toBe(
      '.dispatch{--d-accent:#00FF79;--d-accent-ink:#0A0A0A;--d-second:#005CFF;--d-third:#FF002B;--d-fourth:#EEFE34;--d-fourth-ink:#0A0A0A;}',
    )
    const allowed = new Set<string>([...Object.values(PALETTE), INK, PAPER])
    for (let n = 0; n < 8; n++) {
      const s = serializeAccentCss(n)
      expect(s).not.toContain('<')
      expect((s.match(/\{/g) ?? []).length).toBe(1)
      for (const m of s.match(/#[0-9a-fA-F]{6}/g) ?? []) expect(allowed.has(m)).toBe(true)
    }
  })
  it('constants are frozen', () => {
    expect(Object.isFrozen(PALETTE)).toBe(true)
    expect(Object.isFrozen(NEUTRALS)).toBe(true)
  })
})
