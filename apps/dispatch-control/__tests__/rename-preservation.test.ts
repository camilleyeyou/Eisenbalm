/**
 * D-02/D-03 route + stored-enum preservation tripwire.
 *
 * Phase 50 renames DISPLAY copy only (nav labels, headings, button/label
 * text, aria-labels, prose — D-01). This test proves the two things the
 * nomenclature pass must NEVER touch:
 *
 *   - D-02: route folder paths (`/run-monitor`, `/prompt-lab`,
 *     `/eval-center`, `/registry`) stay unchanged.
 *   - D-03: stored values stay unchanged — `charities.status` keeps the
 *     literal `'blocklisted'`, the audit action stays `'charity.blocklisted'`,
 *     and the Registry UI's `setStatus` mutation call still writes the
 *     unchanged status.
 *
 * ACTIVE/green immediately (unlike nomenclature.test.ts, which is
 * skip-guarded until the sweep lands in 50-06) — these facts must hold
 * throughout every wave of this phase, not just at the end.
 *
 * Mirrors the recursive-fs / direct-file-read pattern from
 * `roleGateInventory.test.ts` / `dispatch-control-no-sanity-write.test.ts`.
 *
 * If this test ever fails, DO NOT weaken the assertions — a route rename or
 * a stored-enum rename is explicitly out of scope for this milestone
 * (CONTEXT D-02/D-03); revert whatever change broke it.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, it, expect } from 'vitest'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const DASHBOARD_ROOT = path.join(REPO_ROOT, 'apps/dispatch-control/app/(dashboard)')
const CONVEX_DIR = path.join(REPO_ROOT, 'convex')

const EXPECTED_ROUTE_FOLDERS = ['run-monitor', 'prompt-lab', 'eval-center', 'registry']

describe('rename-preservation: routes + stored enums are NOT renamed (D-02/D-03)', () => {
  it('all four System Workbench route folders still exist on disk (D-02)', () => {
    for (const folder of EXPECTED_ROUTE_FOLDERS) {
      const dirPath = path.join(DASHBOARD_ROOT, folder)
      expect(fs.existsSync(dirPath), `Missing route folder: ${dirPath}`).toBe(true)
      expect(fs.statSync(dirPath).isDirectory(), `Not a directory: ${dirPath}`).toBe(true)
    }
  })

  it("convex/charities.ts still contains the literal 'blocklisted' status value (D-03)", () => {
    const charitiesPath = path.join(CONVEX_DIR, 'charities.ts')
    expect(fs.existsSync(charitiesPath)).toBe(true)
    const content = fs.readFileSync(charitiesPath, 'utf-8')
    expect(/'blocklisted'/.test(content)).toBe(true)
  })

  it("convex/charities.ts still writes the audit action 'charity.blocklisted' (D-03)", () => {
    const charitiesPath = path.join(CONVEX_DIR, 'charities.ts')
    const content = fs.readFileSync(charitiesPath, 'utf-8')
    expect(/'charity\.blocklisted'/.test(content)).toBe(true)
  })

  it("convex/schema.ts's charities table keeps status as an unmigrated v.string() (D-03)", () => {
    const schemaPath = path.join(CONVEX_DIR, 'schema.ts')
    expect(fs.existsSync(schemaPath)).toBe(true)
    const content = fs.readFileSync(schemaPath, 'utf-8')
    // The stored value is a free string (never narrowed to a v.union/v.literal
    // enum) — this is what makes the display-label swap a rename with zero
    // migration risk (RESEARCH: "charities.status is a free v.string()").
    expect(/status:\s*v\.string\(\)/.test(content)).toBe(true)
    // The field's documentation comment still names 'blocklisted' as a valid
    // stored value (proves the enum's real-world value wasn't scrubbed).
    expect(/blocklisted/i.test(content)).toBe(true)
  })

  it("RegistryTable.tsx's setStatus mutation still passes the unchanged status: 'blocklisted' (D-03)", () => {
    const registryTablePath = path.join(
      DASHBOARD_ROOT,
      'registry/_components/RegistryTable.tsx',
    )
    expect(fs.existsSync(registryTablePath)).toBe(true)
    const content = fs.readFileSync(registryTablePath, 'utf-8')
    expect(content.includes("status: 'blocklisted'")).toBe(true)
  })
})
