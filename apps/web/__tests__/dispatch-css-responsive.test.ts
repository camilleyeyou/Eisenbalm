import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')
function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
const CSS_FILES = [
  join(ROOT, 'app/dispatch.css'),
  ...walk(join(ROOT, 'components/dispatch')).filter((f) => f.endsWith('.css')),
]
const read = (f: string) => readFileSync(f, 'utf8').replace(/\/\*[^]*?\*\//g, '')

describe('dispatch CSS responsive contract (375px viewport)', () => {
  for (const f of CSS_FILES) {
    const css = read(f)
    it(`${f.replace(ROOT, '')}: no fixed width/min-width/flex-basis >= 312px`, () => {
      for (const m of css.matchAll(/(?<![-\w])(width|min-width|flex-basis)\s*:\s*(\d+)px/g))
        expect(Number(m[2]), m[0]).toBeLessThan(312)
    })
    it(`${f.replace(ROOT, '')}: flex px basis < 312`, () => {
      for (const m of css.matchAll(/flex\s*:\s*\d+\s+\d+\s+(\d+)px/g))
        expect(Number(m[1]), m[0]).toBeLessThan(312)
    })
    it(`${f.replace(ROOT, '')}: minmax() wraps large px in min(100%, ...)`, () => {
      expect(css).not.toMatch(/minmax\(\s*(\d{3,})px/)
    })
  }
  it('dispatch.css keeps fluid gutters and wrapping headings', () => {
    const css = read(CSS_FILES[0]!)
    expect(css).toContain('padding-inline:clamp(16px, 5vw, 32px)')
    expect((css.match(/overflow-wrap:anywhere/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})
