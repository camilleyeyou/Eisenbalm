/**
 * Phase 51.1 — client/server gate parity. The live allSignedOff query must
 * equal summarizeClaimGate (the shared module dispatch-control imports).
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'
import { isOpenBlocking, summarizeClaimGate, type ClaimGateRow } from '@convex/lib/claimGate'

const modules = import.meta.glob('../../../convex/**/*.*s')

const R = {
  legacy: { status: 'pending', importance: 'Load-bearing' },
  verified: { status: 'pending', verdict: 'verified' },
  cPending: { status: 'pending', verdict: 'contradicted' },
  cChecked: { status: 'checked', verdict: 'contradicted' },
  cRemoved: { status: 'removed', verdict: 'contradicted' },
  cChanged: { status: 'pending', verdict: 'contradicted', changedSinceCheck: true },
  uLb: { status: 'pending', verdict: 'unverifiable', importance: 'Load-bearing' },
  uSup: { status: 'pending', verdict: 'unverifiable', importance: 'Supporting' },
} satisfies Record<string, ClaimGateRow>

const MATRIX: Record<string, ClaimGateRow[]> = {
  empty: [],
  legacy: [R.legacy],
  verified: [R.verified],
  'contradicted-pending': [R.cPending],
  'contradicted-checked': [R.cChecked],
  'contradicted-removed': [R.cRemoved],
  'contradicted-changed': [R.cChanged],
  'unverifiable-lb': [R.uLb],
  'unverifiable-supporting': [R.uSup],
  mixed: Object.values(R),
}
const EXPECT_FALSE = new Set(['contradicted-pending', 'mixed'])

describe('Phase 51.1 — claim gate parity matrix', () => {
  for (const [key, rows] of Object.entries(MATRIX)) {
    it(`query matches shared predicate: ${key}`, async () => {
      const t = convexTest({ schema, modules })
      const runId = `parity-${key}`
      await t.run(async ctx => {
        for (const [i, row] of rows.entries()) {
          await ctx.db.insert('claim_checks', {
            workspace_id: 'eisenbalm',
            runId,
            claimIndex: i,
            text: `c${i}`,
            claimType: 'number',
            context: '',
            ...row,
          } as never)
        }
      })
      const result = await t.query(api.claimChecks.allSignedOff, { runId })
      expect(result).toEqual(summarizeClaimGate(rows))
      expect(result.allSignedOff).toBe(!rows.some(isOpenBlocking))
      expect(result.allSignedOff).toBe(!EXPECT_FALSE.has(key))
    })
  }
})
