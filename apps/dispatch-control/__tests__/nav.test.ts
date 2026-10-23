/**
 * nav.test.ts — ADMIN_ITEMS coverage gate (quick 261021-j83).
 *
 * The sidebar is gone; `ADMIN_ITEMS` feeds the /admin hub and the command
 * palette. Asserts the 7 items, Finance + Charities first, and that every
 * href has a real page file on disk (no dead links).
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { ADMIN_ITEMS, EDITOR_NAV } from '../lib/nav'

const EXPECTED = [
  ['Money', '/admin/finance'],
  ['Charities', '/admin/charities'],
  ['Past issues, step by step', '/admin/runs'],
  ['What the writers are told', '/admin/agents'],
  ['Quality tests', '/admin/tests'],
  ['Schedule and limits', '/admin/automation'],
  ['Settings', '/admin/settings'],
]

describe('ADMIN_ITEMS', () => {
  it('lists the 7 admin items in order over /admin/* hrefs', () => {
    expect(ADMIN_ITEMS.map(i => [i.label, i.href])).toEqual(EXPECTED)
  })

  it('Money and Charities are the weekly items and the only ones', () => {
    expect(ADMIN_ITEMS.filter(i => i.weekly).map(i => i.label)).toEqual(['Money', 'Charities'])
  })

  it('every item has a plain-language description', () => {
    for (const item of ADMIN_ITEMS) expect(item.description.length).toBeGreaterThan(10)
  })

  it('no description uses run/agent/pipeline/token jargon', () => {
    for (const item of ADMIN_ITEMS) expect(item.description).not.toMatch(/\b(runs?|agents?|pipeline|tokens?)\b/i)
  })

  it('every href has a real page file on disk', () => {
    const appRoot = path.resolve(__dirname, '..')
    for (const item of ADMIN_ITEMS) {
      expect(fs.existsSync(path.join(appRoot, 'app', item.href, 'page.tsx')), item.href).toBe(true)
    }
  })

  it('no retired console path survives', () => {
    for (const item of ADMIN_ITEMS) {
      expect(item.href).not.toMatch(/run-monitor|prompt-lab|eval-center|\/registry|\/config|\/issues|\/run$/)
    }
  })
})

describe('EDITOR_NAV', () => {
  it('has three links in order', () => {
    expect(EDITOR_NAV.map(i => [i.label, i.href])).toEqual([
      ["This week's issue", '/'],
      ['Past issues', '/archive'],
      ['Behind the scenes', '/admin'],
    ])
  })

  it('match() picks the right link', () => {
    const cur = (p: string) => EDITOR_NAV.filter(i => i.match(p)).map(i => i.href)
    expect(cur('/')).toEqual(['/'])
    expect(cur('/s/founderBio')).toEqual(['/'])
    expect(cur('/archive')).toEqual(['/archive'])
    expect(cur('/admin/runs/abc')).toEqual(['/admin'])
  })
})
