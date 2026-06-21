/**
 * nav.test.ts — NAV_ITEMS coverage gate (AUTH-01, D-07).
 *
 * Asserts:
 *   1. NAV_ITEMS has exactly 7 items in the expected order (Graph first).
 *   2. Every nav href has a corresponding real page file on disk (no dead links).
 *
 * If a nav item is added without a page, or a page is deleted without removing
 * the nav item, this test will fail — preventing dead-link regressions automatically.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { NAV_ITEMS } from '../lib/nav'

const EXPECTED_LABELS = ['Graph', 'Runs', 'Config', 'Prompts', 'Registry', 'Finance', 'Settings']
const EXPECTED_HREFS  = ['/graph', '/runs', '/config', '/prompts', '/registry', '/finance', '/settings']

describe('NAV_ITEMS', () => {
  it('has exactly 7 items', () => {
    expect(NAV_ITEMS).toHaveLength(7)
  })

  it('has Graph as the first item (default home)', () => {
    const first = NAV_ITEMS[0]
    expect(first?.label).toBe('Graph')
    expect(first?.href).toBe('/graph')
  })

  it('items are in the expected order (D-07)', () => {
    const labels = NAV_ITEMS.map((i) => i.label)
    const hrefs  = NAV_ITEMS.map((i) => i.href)
    expect(labels).toEqual(EXPECTED_LABELS)
    expect(hrefs).toEqual(EXPECTED_HREFS)
  })

  it('every nav href maps to a real page file on disk (no dead links)', () => {
    // Resolve from the monorepo root — __tests__/ is one level below apps/dispatch-control/
    const appRoot = path.resolve(__dirname, '..')

    for (const item of NAV_ITEMS) {
      const pagePath = path.join(
        appRoot,
        'app',
        '(dashboard)',
        item.href,         // e.g. "/graph" → "app/(dashboard)/graph"
        'page.tsx',
      )
      const exists = fs.existsSync(pagePath)
      expect(exists, `Missing page for nav item "${item.label}": expected ${pagePath}`).toBe(true)
    }
  })
})
