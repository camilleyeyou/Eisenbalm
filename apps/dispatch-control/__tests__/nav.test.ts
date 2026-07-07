/**
 * nav.test.ts — NAV_GROUPS coverage gate (CHR-03, dc.html D-01/D-06).
 *
 * Asserts:
 *   1. The 3 group labels exist, in order (Workflow, Craft & memory, Operations).
 *   2. Review Desk is the first item in the Workflow group (home, D-04).
 *   3. Every nav href across all 3 groups, plus NAV_PINNED, has a corresponding
 *      real page file on disk (no dead links).
 *
 * If a nav item is added without a page, or a page is deleted without removing
 * the nav item, this test will fail — preventing dead-link regressions automatically.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { NAV_GROUPS, NAV_PINNED } from '../lib/nav'

const EXPECTED_GROUP_LABELS = ['Workflow', 'Craft & memory', 'Operations']

function pagePathFor(appRoot: string, href: string): string {
  // e.g. "/run-monitor" → "app/(dashboard)/run-monitor/page.tsx"
  return path.join(appRoot, 'app', '(dashboard)', href, 'page.tsx')
}

describe('NAV_GROUPS', () => {
  it('has exactly 3 groups in the expected order', () => {
    const labels = NAV_GROUPS.map((g) => g.label)
    expect(labels).toEqual(EXPECTED_GROUP_LABELS)
  })

  it('has Review Desk as the first item of the Workflow group (home, D-04)', () => {
    const workflow = NAV_GROUPS.find((g) => g.label === 'Workflow')
    const first = workflow?.items[0]
    expect(first?.label).toBe('Review Desk')
    expect(first?.href).toBe('/review-desk')
  })

  it('NAV_PINNED is "How to use" pointing at /how-to-use', () => {
    expect(NAV_PINNED.label).toBe('How to use')
    expect(NAV_PINNED.href).toBe('/how-to-use')
  })

  it('every nav href across all groups plus NAV_PINNED maps to a real page file on disk (no dead links)', () => {
    // Resolve from the monorepo root — __tests__/ is one level below apps/dispatch-control/
    const appRoot = path.resolve(__dirname, '..')

    const allItems = NAV_GROUPS.flatMap((group) => group.items).concat(NAV_PINNED)

    for (const item of allItems) {
      const pagePath = pagePathFor(appRoot, item.href)
      const exists = fs.existsSync(pagePath)
      expect(exists, `Missing page for nav item "${item.label}": expected ${pagePath}`).toBe(true)
    }
  })
})
