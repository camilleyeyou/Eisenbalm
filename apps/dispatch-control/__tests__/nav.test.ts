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
import { ADMIN_ITEMS } from '../lib/nav'

const EXPECTED = [
  ['Finance', '/admin/finance'],
  ['Charities', '/admin/charities'],
  ['Runs', '/admin/runs'],
  ['Agent instructions', '/admin/agents'],
  ['Quality tests', '/admin/tests'],
  ['Automation', '/admin/automation'],
  ['Settings', '/admin/settings'],
]

describe('ADMIN_ITEMS', () => {
  it('lists the 7 admin items in order over /admin/* hrefs', () => {
    expect(ADMIN_ITEMS.map(i => [i.label, i.href])).toEqual(EXPECTED)
  })

  it('Finance and Charities are the weekly items and the only ones', () => {
    expect(ADMIN_ITEMS.filter(i => i.weekly).map(i => i.label)).toEqual(['Finance', 'Charities'])
  })

  it('every item has a plain-language description', () => {
    for (const item of ADMIN_ITEMS) expect(item.description.length).toBeGreaterThan(10)
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
