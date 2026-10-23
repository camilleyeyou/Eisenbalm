/**
 * Phase 56-12 — retirement tripwire (Phase 34 lesson: the old surface must be
 * deleted AND stay deleted). Fails if any retired component comes back or is
 * imported again.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')

const RETIRED_FILES = [
  'app/(editorial)/_components/PublishFooter.tsx',
  'app/(editorial)/_components/StoryRow.tsx',
  'app/(editorial)/_components/StartIssueButton.tsx',
  'app/(editorial)/_components/HoldDialog.tsx',
  'app/(editorial)/_components/HoldControl.tsx',
  'app/(editorial)/_components/HeldIssueRow.tsx',
  'app/(editorial)/_components/EarlierIssueBanner.tsx',
  'app/(editorial)/_components/InPlaceBlockEditor.tsx',
  'components/CommandPalette.tsx',
  'components/StopRunButton.tsx',
  'app/admin/runs/_components/RunDetail.tsx',
  'app/admin/runs/_components/RecoveryRail.tsx',
  'app/admin/runs/_components/RerollButton.tsx',
  'components/inspector/InspectorFooter.tsx',
  'components/inspector/InspectorPanel.tsx',
  'components/inspector/InspectorProvider.tsx',
  'components/inspector/InspectorContainer.tsx',
]

const RETIRED_IMPORTS = [
  'PublishFooter',
  'StoryRow',
  'StartIssueButton',
  'HoldDialog',
  'HoldControl',
  'HeldIssueRow',
  'EarlierIssueBanner',
  'InPlaceBlockEditor',
  'CommandPalette',
  'StopRunButton',
  'RunDetail',
  'RecoveryRail',
  'RerollButton',
  'InspectorFooter',
  'InspectorPanel',
  'InspectorProvider',
  'InspectorContainer',
]

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

const SOURCES = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]
const read = (p: string) => fs.readFileSync(p, 'utf8')

describe('editor retirement', () => {
  it.each(RETIRED_FILES)('%s is deleted', (f) => {
    expect(fs.existsSync(path.join(ROOT, f))).toBe(false)
  })

  it('no file under app/ or components/ imports a retired component', () => {
    const offenders: string[] = []
    for (const f of SOURCES) {
      const src = read(f)
      for (const name of RETIRED_IMPORTS) {
        const re = new RegExp(`from\\s+['"][^'"]*/${name}['"]`)
        if (re.test(src)) offenders.push(`${path.relative(ROOT, f)} -> ${name}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the admin shell has no Admin label and no user menu', () => {
    for (const f of ['app/admin/layout.tsx', 'components/editor/EditorShell.tsx']) {
      const src = read(path.join(ROOT, f))
      expect(src).not.toContain('>Admin<')
      expect(src).not.toContain('UserButton')
    }
    expect(read(path.join(ROOT, 'lib/nav.ts'))).not.toMatch(/label:\s*'Admin'/)
  })

  it('retired button copy never reappears under app/ or components/', () => {
    const banned = ['Restart from this step', 'Improve this agent', 'Trigger Run', 'Run Detail']
    const offenders: string[] = []
    for (const f of SOURCES) {
      const src = read(f)
      for (const s of banned) if (src.includes(s)) offenders.push(`${path.relative(ROOT, f)}: ${s}`)
    }
    expect(offenders).toEqual([])
  })
})
