import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PALETTE, NEUTRALS } from '@/lib/brand'
import { HEX_REGEX, FONT_WHITELIST } from '@/lib/theme'

const ROOT = join(__dirname, '..')
const layout = readFileSync(join(ROOT, 'app/layout.tsx'), 'utf8')
const css = readFileSync(join(ROOT, 'app/dispatch.css'), 'utf8')

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('brand tokens', () => {
  it('layout wires Manrope as --font-dispatch and imports dispatch.css', () => {
    expect(layout).toMatch(/Manrope[^]*from 'next\/font\/google'/)
    expect(layout).toContain('--font-dispatch')
    expect(layout).toContain("import './dispatch.css'")
  })
  it('layout adds no Google Fonts link', () => {
    expect(layout).not.toContain('fonts.googleapis.com')
  })
  it('dispatch.css declares the fixed palette and neutrals', () => {
    for (const [name, hex] of [
      ['green', '#00FF79'], ['blue', '#005CFF'], ['red', '#FF002B'], ['yellow', '#EEFE34'],
      ['ink', '#0A0A0A'], ['paper', '#FFFFFF'],
    ]) expect(css).toContain(`--d-${name}:${hex}`)
    const lower = css.toLowerCase()
    for (const v of [...Object.values(PALETTE), ...Object.values(NEUTRALS)])
      expect(lower).toContain(v.toLowerCase())
  })
  it('hex literals appear only in the first .dispatch block', () => {
    const block = css.match(/\.dispatch\s*\{[^}]*\}/)![0]
    const rest = css.replace(block, '')
    expect(rest).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
  it('theme.ts security invariants unchanged', () => {
    expect(HEX_REGEX.source).toBe('^#[0-9a-fA-F]{6}$')
    expect(FONT_WHITELIST.length).toBe(9)
  })
  it('dispatch components/css carry no hex literals', () => {
    const files = walk(join(ROOT, 'components/dispatch'))
    for (const f of files) {
      if (!/\.(tsx?|css)$/.test(f)) continue
      const src = readFileSync(f, 'utf8')
      if (f.endsWith('.css') || /\.tsx?$/.test(f))
        expect(src, f).not.toMatch(/#[0-9a-fA-F]{6}\b/)
    }
  })
})
