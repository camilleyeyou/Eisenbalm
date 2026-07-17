/**
 * how-to-use.test.ts — How-to-use screen content gate (CHR-03, Phase 30-07).
 *
 * Source-scan only (reads file contents with node:fs) — no rendering.
 * Locks the verbatim weekly-loop steps, color-legend entries, and house-rule
 * headlines extracted from docs/design/dispatch-control-v2/Dispatch
 * Control.dc.html (`disp_howto`) into the page, per 30-07-PLAN.md.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const pagePath = path.resolve(
  __dirname,
  '..',
  'app',
  '(dashboard)',
  'how-to-use',
  'page.tsx',
)
const contents = fs.readFileSync(pagePath, 'utf-8')

describe('How-to-use screen (source-scan)', () => {
  describe('weekly loop — 5 steps', () => {
    const steps = [
      'Steer discovery',
      'Watch the run',
      'Clear the facts',
      'De-slop it',
      'Improve the machine',
    ]

    for (const step of steps) {
      it(`contains step "${step}"`, () => {
        expect(contents).toContain(step)
      })
    }

    it('contains all 5 screen names (Phase 50, WBN-05: renamed Workbench screens + current stage names)', () => {
      expect(contents).toContain('Signal Desk')
      expect(contents).toContain('WORKBENCH_NAV_LABELS.run_monitor')
      expect(contents).toContain('Fact Check')
      expect(contents).toContain('Voice Pass')
      expect(contents).toContain('WORKBENCH_NAV_LABELS.prompt_lab')
      expect(contents).toContain('WORKBENCH_NAV_LABELS.eval_center')
    })
  })

  describe('color legend — 4 entries', () => {
    const entries: Array<[string, string]> = [
      ['#148a52', 'Verified'],
      ['#e8471d', 'Error'],
      ['#f2b01e', 'Warning'],
      ['#253ad4', 'Interactive'],
    ]

    for (const [hex, meaning] of entries) {
      it(`contains ${hex} paired with "${meaning}"`, () => {
        expect(contents).toContain(hex)
        expect(contents).toContain(meaning)
      })
    }
  })

  describe('house rules — 4 headlines (verbatim)', () => {
    const rules = [
      'Silence is never "verified."',
      'Nothing silent.',
      'JSON is never the default.',
      'The irreversible ones ask twice.',
    ]

    for (const rule of rules) {
      it(`contains headline "${rule}"`, () => {
        expect(contents).toContain(rule)
      })
    }
  })

  it('contains no literal `neutral-` Tailwind class token', () => {
    expect(contents).not.toMatch(/neutral-/)
  })

  it('contains no literal `bg-white` class', () => {
    expect(contents).not.toMatch(/bg-white\b/)
  })

  it('contains no literal `text-white` class', () => {
    expect(contents).not.toMatch(/text-white\b/)
  })

  it('contains no literal `text-black` class', () => {
    expect(contents).not.toMatch(/text-black\b/)
  })

  it('references at least one 1c token arbitrary-value class', () => {
    expect(contents).toContain('[color:var(--color-')
  })
})
