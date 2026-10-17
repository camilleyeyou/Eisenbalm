/**
 * Phase 55 plan 12 — retirement guard for the Phase 19 public-page tree.
 * Files absent, no importers, no transcript projection. Prevents a half-done
 * retirement (see Phase 34 lesson).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const WEB = resolve(__dirname, '..')

const RETIRED = [
  'IssueMasthead', 'IssueBriefing', 'MissionBand', 'SectionRail', 'ScrollProgressBar',
  'StatCountUp', 'ThemeApplier', 'DelibChat', 'DelibScoreboard', 'ConfidenceBar',
  'DeliberationSlot', 'ShopBand', 'ShopCallout', 'IssueHero', 'ScrollReveal',
  'EditorialSection', 'CaseStudySection',
]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

describe('Phase 19 retirement', () => {
  it.each(RETIRED)('components/issue/%s.tsx is gone', (name) => {
    expect(existsSync(join(WEB, 'components/issue', `${name}.tsx`))).toBe(false)
  })

  it('nothing under app/, components/, lib/ imports a retired issue component', () => {
    const files = ['app', 'components', 'lib'].flatMap((d) => walk(join(WEB, d)))
    const re = new RegExp(`components/issue/(${RETIRED.join('|')})['"]|from ['"]\\./(${RETIRED.join('|')})['"]`)
    const offenders = files.filter((f) => re.test(readFileSync(f, 'utf-8')))
    expect(offenders).toEqual([])
  })

  it('public issue queries do not project the deliberation conversation', () => {
    const q = readFileSync(join(WEB, 'lib/sanity/queries.ts'), 'utf-8')
    expect(q).not.toContain('conversation[]')
  })

  it('IssueLayout renders no transcript log', () => {
    const l = readFileSync(join(WEB, 'components/issue/IssueLayout.tsx'), 'utf-8')
    expect(l).not.toContain('role="log"')
  })
})
