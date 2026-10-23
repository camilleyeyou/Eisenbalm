/**
 * Plan 56-10 tripwire: no engineering jargon in the UI strings of the
 * past-issues list and its shared components. Fix flagged strings in the
 * source rather than allow-listing them.
 */
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { jargonInSource } from './helpers/jargonScan'

const ROOT = resolve(__dirname, '..')
const FILES = [
  'app/admin/runs/page.tsx',
  'app/admin/runs/layout.tsx',
  'app/admin/runs/loading.tsx',
  'app/admin/runs/_components/RunsTable.tsx',
  'app/admin/runs/_components/RunControlBar.tsx',
  'app/admin/runs/_components/ReviewQueue.tsx',
  'app/admin/runs/_components/CostRollup.tsx',
  'app/admin/runs/_components/BudgetAlertBanner.tsx',
  'app/admin/runs/_components/CancelRunButton.tsx',
]

describe('past-issues pages have no jargon in UI strings', () => {
  for (const f of FILES) {
    it(f, () => {
      expect(jargonInSource(resolve(ROOT, f))).toEqual([])
    })
  }
})
