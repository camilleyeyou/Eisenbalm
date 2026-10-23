/**
 * Plan 56-11 tripwire: no engineering jargon in the UI strings of the
 * "What the writers are told" pages. Fix flagged strings in the source rather
 * than allow-listing them.
 */
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { jargonInSource } from './helpers/jargonScan'

const ROOT = resolve(__dirname, '..')
const FILES = [
  'app/admin/agents/page.tsx',
  'app/admin/agents/[agentKey]/page.tsx',
  'app/admin/agents/_components/AgentPromptEditorView.tsx',
  'app/admin/agents/_components/PromptsListClient.tsx',
  'app/admin/agents/_components/PromptEditor.tsx',
  'app/admin/agents/_components/PromptSaveDialog.tsx',
  'app/admin/agents/_components/TestRunPanel.tsx',
  'app/admin/agents/_components/VersionHistoryPanel.tsx',
  'app/admin/agents/_components/EvalDrawer.tsx',
  'app/admin/agents/_components/DiffViewer.tsx',
  'app/admin/agents/_components/AssembledPreview.tsx',
  'app/admin/agents/_components/PromptMarkerExport.tsx',
  'app/admin/agents/_components/VariableChips.tsx',
]

describe('writers instructions pages have no jargon in UI strings', () => {
  for (const f of FILES) {
    it(f, () => {
      expect(jargonInSource(resolve(ROOT, f))).toEqual([])
    })
  }
})
