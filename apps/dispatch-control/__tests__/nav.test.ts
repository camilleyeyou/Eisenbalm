/**
 * nav.test.ts — NAV_GROUPS coverage gate (CHR-03, dc.html D-01/D-06).
 * Updated Phase 40 Plan 40-08 (ISS-02 / D-31, §40.9) — the console became
 * issue-keyed; the nav restructured into Editorial / System Workbench /
 * Operations, and Review Desk / Signal Desk / Voice Pass left the nav (they
 * are now issue sub-routes reachable from `/issues/[n]`).
 *
 * Asserts:
 *   1. The 3 group labels exist, in order (Editorial, System Workbench, Operations).
 *   2. Issues is the first (and only) item in the Editorial group (the new
 *      editorial home, D-31).
 *   3. None of the removed desk items (Review Desk, Signal Desk, Voice Pass)
 *      appear anywhere in the nav.
 *   4. Every nav href across all 3 groups, plus NAV_PINNED, has a corresponding
 *      real page file on disk (no dead links) — this now requires
 *      `/issues/page.tsx`, which Plan 40-05 created.
 *
 * If a nav item is added without a page, or a page is deleted without removing
 * the nav item, this test will fail — preventing dead-link regressions automatically.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { NAV_GROUPS, NAV_PINNED } from '../lib/nav'

const EXPECTED_GROUP_LABELS = ['Editorial', 'System Workbench', 'Operations']
const REMOVED_HREFS = ['/review-desk', '/signal-desk', '/voice-pass']
// Phase 41 (WSP-01) — the three collapsed desks must not reappear as nav
// LABELS either (they left as hrefs in Phase 40; WSP-01 replaces them with the
// single "Issue Workspace" item).
const REMOVED_LABELS = ['Review Desk', 'Signal Desk', 'Voice Pass']

function pagePathFor(appRoot: string, href: string): string {
  // e.g. "/run-monitor" → "app/(dashboard)/run-monitor/page.tsx"
  return path.join(appRoot, 'app', '(dashboard)', href, 'page.tsx')
}

describe('NAV_GROUPS', () => {
  it('has exactly 3 groups in the expected order', () => {
    const labels = NAV_GROUPS.map((g) => g.label)
    expect(labels).toEqual(EXPECTED_GROUP_LABELS)
  })

  it('has Issues as the first item of the Editorial group (the new editorial home, D-31)', () => {
    const editorial = NAV_GROUPS.find((g) => g.label === 'Editorial')
    const first = editorial?.items[0]
    expect(first?.label).toBe('Issues')
    expect(first?.href).toBe('/issues')
  })

  it('Run Details (nee Run Monitor) is under System Workbench (D-08 — survives, but is no longer the editorial object; Phase 50 WBN-01 renamed the label)', () => {
    const workbench = NAV_GROUPS.find((g) => g.label === 'System Workbench')
    const labels = workbench?.items.map((i) => i.label) ?? []
    expect(labels).toContain('Run Details')
  })

  it('none of Review Desk / Signal Desk / Voice Pass hrefs appear anywhere in the nav (they left the nav — now issue sub-routes)', () => {
    const allHrefs = NAV_GROUPS.flatMap((group) => group.items.map((i) => i.href))
    for (const removed of REMOVED_HREFS) {
      expect(allHrefs).not.toContain(removed)
    }
  })

  it('has exactly one "Issue Workspace" item, in the Editorial group (WSP-01, D-22)', () => {
    const allItems = NAV_GROUPS.flatMap((group) => group.items)
    const workspaceItems = allItems.filter((i) => i.label === 'Issue Workspace')
    expect(workspaceItems).toHaveLength(1)
    expect(workspaceItems[0]?.href).toBe('/issues')

    const editorial = NAV_GROUPS.find((g) => g.label === 'Editorial')
    const editorialLabels = editorial?.items.map((i) => i.label) ?? []
    expect(editorialLabels).toContain('Issue Workspace')
  })

  it('none of Review Desk / Signal Desk / Voice Pass LABELS appear anywhere in the nav (WSP-01 — replaced by Issue Workspace)', () => {
    const allLabels = NAV_GROUPS.flatMap((group) => group.items.map((i) => i.label))
    for (const removed of REMOVED_LABELS) {
      expect(allLabels).not.toContain(removed)
    }
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
