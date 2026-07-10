/**
 * Phase 39 Plan 01 (MEM-02) — append-only source-scan tripwire.
 *
 * D-05/Pitfall 3: `charity_corrections` is an append-only log — the log IS the
 * durable record. `convex/charityCorrections.ts` must export exactly `append`
 * and `listByCharityKey`, and must NEVER export update/patch/remove/delete/edit.
 *
 * Mirrors `dispatch-control-no-sanity-write.test.ts`'s source-scan pattern: read
 * the file as text (no live Convex deployment needed) and assert on its export
 * surface. If a future change adds a mutability path to this table, THIS test
 * must fail — do not weaken the assertions; route corrections instead through
 * a NEW append row (see docs/API_CONTRACTS.md §39.2).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, it, expect } from 'vitest'

const SOURCE_PATH = path.join(__dirname, '../../../convex/charityCorrections.ts')

describe('charity_corrections append-only enforcement (Pitfall 3)', () => {
  it('convex/charityCorrections.ts exports append and listByCharityKey', () => {
    const source = fs.readFileSync(SOURCE_PATH, 'utf-8')
    expect(source).toMatch(/export const append/)
    expect(source).toMatch(/export const listByCharityKey/)
  })

  it('convex/charityCorrections.ts does NOT export update/patch/remove/delete/edit', () => {
    const source = fs.readFileSync(SOURCE_PATH, 'utf-8')
    expect(source).not.toMatch(/export const (update|patch|remove|delete|edit)/)
  })
})
