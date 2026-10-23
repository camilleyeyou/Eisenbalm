/**
 * Plan 56-10b tripwire: no engineering jargon in the UI strings of the
 * "How the steps connect" page. Fix flagged strings in the source rather
 * than allow-listing them.
 */
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { jargonInSource } from './helpers/jargonScan'

const ROOT = resolve(__dirname, '..')
const FILES = [
  'app/admin/runs/graph/page.tsx',
  'app/admin/runs/graph/_components/AgentIOPanel.tsx',
  'app/admin/runs/graph/_components/AgentNode.tsx',
  'app/admin/runs/graph/_components/DriftStrip.tsx',
  'app/admin/runs/graph/_components/PipelineGraph.tsx',
  'app/admin/runs/graph/_components/WriterExpansion.tsx',
]

describe('map page has no jargon in UI strings', () => {
  for (const f of FILES) {
    it(f, () => {
      expect(jargonInSource(resolve(ROOT, f))).toEqual([])
    })
  }
})
