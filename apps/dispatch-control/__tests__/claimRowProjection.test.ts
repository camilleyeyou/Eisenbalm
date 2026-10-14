/**
 * Phase 51.1 Plan 06 (VRD-03/04/06) — the shared lean claim-row projection
 * must be lossless for verdicts (Pitfall 2) and used by every call site.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { projectClaimRow, deriveTasks, type DerivationInputs, type DerivedTask } from '../lib/derivedState'

const contradictedDoc = {
  _id: 'c1',
  _creationTime: 1700000000000,
  status: 'pending',
  text: 'The charity was founded in 1990',
  verdict: 'contradicted',
  verdictEvidence: 'Registry says 1994',
  verdictSources: ['https://registry.example.org'],
  importance: 'Load-bearing' as const,
  changedSinceCheck: false,
}

function baseInputs(overrides: Partial<DerivationInputs> = {}): DerivationInputs {
  return {
    issueNumber: 7,
    runId: 'run-1',
    issue: { held: false, published: false },
    signOffs: {
      'facts-cleared': { actorId: 'a', signedAt: 1 },
      'sounds-human': { actorId: 'a', signedAt: 1 },
    },
    claimRows: [],
    qaFindings: [],
    pitchRows: [],
    runStatus: 'complete',
    ...overrides,
  } as DerivationInputs
}

describe('projectClaimRow', () => {
  it('carries verdict, verdictEvidence, verdictSources, importance, changedSinceCheck', () => {
    const out = projectClaimRow(contradictedDoc)
    expect(out.verdict).toBe('contradicted')
    expect(out.verdictEvidence).toBe('Registry says 1994')
    expect(out.verdictSources).toEqual(['https://registry.example.org'])
    expect(out.importance).toBe('Load-bearing')
    expect(out.changedSinceCheck).toBe(false)
    expect(out.claimText).toBe(contradictedDoc.text)
    expect(out.createdAt).toBe(contradictedDoc._creationTime)
  })

  it('a contradicted row projected then derived is a must-fix task (no legacy fallthrough)', () => {
    const tasks = deriveTasks(baseInputs({ claimRows: [projectClaimRow(contradictedDoc)] }))
    const claimTasks = tasks.filter((t: DerivedTask) => t.id.startsWith('claim-'))
    expect(claimTasks).toHaveLength(1)
    expect(claimTasks[0].sev).toBe('must-fix')
  })

  it('every lean projection call site uses projectClaimRow', () => {
    const root = path.resolve(__dirname, '..')
    const files = [
      'lib/useCurrentRun.ts',
      'app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx',
      'app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx',
    ]
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, f), 'utf8')
      expect(src, f).toContain('projectClaimRow')
      expect(src, f).not.toContain('claimText: row.text')
    }
  })
})
