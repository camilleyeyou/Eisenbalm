/**
 * design-tokens.test.ts — 1c design system source-scan gate (CHR-01, Phase 30-01).
 *
 * Source-scan only (reads file contents with node:fs) — no rendering.
 * Asserts:
 *   1. Every 1c token literal is present in globals.css.
 *   2. --radius is 0 (hard edges, anti-SaaS).
 *   3. The Phase 24 .cm-prompt-editor variable-highlight rules survive the retheme.
 *   4. layout.tsx loads all 4 next/font/google fonts (Newsreader, Lora,
 *      Space Grotesk, IBM Plex Mono).
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const appRoot = path.resolve(__dirname, '..')
const globalsCssPath = path.join(appRoot, 'app', 'globals.css')
const layoutTsxPath = path.join(appRoot, 'app', 'layout.tsx')

const globalsCss = fs.readFileSync(globalsCssPath, 'utf-8')
const layoutTsx = fs.readFileSync(layoutTsxPath, 'utf-8')

describe('1c design tokens (globals.css)', () => {
  const expectedTokens: Record<string, string> = {
    '--color-ink': '#17140e',
    '--color-cobalt': '#253ad4',
    '--color-vermilion': '#e8471d',
    '--color-marigold': '#f2b01e',
    '--color-green': '#148a52',
  }

  for (const [name, value] of Object.entries(expectedTokens)) {
    it(`declares ${name}: ${value}`, () => {
      expect(globalsCss).toMatch(new RegExp(`${name}:\\s*${value}`))
    })
  }

  it('sets --radius to 0 (hard edges, anti-SaaS)', () => {
    expect(globalsCss).toMatch(/--radius:\s*0(?!\.5rem)/)
    expect(globalsCss).not.toMatch(/--radius:\s*0\.5rem/)
  })

  it('preserves the Phase 24 .cm-prompt-editor .cm-var-known rule', () => {
    expect(globalsCss).toMatch(/\.cm-prompt-editor\s+\.cm-var-known/)
  })

  it('preserves the Phase 24 .cm-prompt-editor .cm-var-unknown rule', () => {
    expect(globalsCss).toMatch(/\.cm-prompt-editor\s+\.cm-var-unknown/)
  })
})

describe('1c fonts (layout.tsx)', () => {
  const expectedFonts = ['Newsreader', 'Lora', 'Space_Grotesk', 'IBM_Plex_Mono']

  for (const fontImport of expectedFonts) {
    it(`imports ${fontImport} from next/font/google`, () => {
      expect(layoutTsx).toMatch(new RegExp(fontImport))
    })
  }
})
