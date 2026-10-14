/**
 * Phase 51.1 — Plan 51.1-01: claim verdict fields + re-semanticized allSignedOff.
 * Runs in edge-runtime environment (required by convex-test).
 * API_CONTRACTS §51.1.1 / §51.1.3.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// Literal import.meta.glob required by Vite static analysis.
const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'
const TEST_SECRET = 'test-pipeline-secret-verdict-511'
const RUN_ID = 'run-verdict-511'

type Claim = {
  claimIndex: number
  text: string
  claimType: string
  context: string
  importance?: 'Load-bearing' | 'Supporting' | 'Incidental'
  verdict?: 'verified' | 'contradicted' | 'unverifiable'
  verdictEvidence?: string
  verdictSources?: string[]
  verdictAt?: number
  verdictModel?: string
}

function claim(i: number, extra: Partial<Claim> = {}): Claim {
  return { claimIndex: i, text: `claim ${i}`, claimType: 'number', context: `ctx ${i}`, ...extra }
}

describe('Phase 51.1 — claim verdicts (VRD-01/04/05/06)', () => {
  const prevSecret = process.env.PIPELINE_CONVEX_SECRET
  beforeEach(() => {
    process.env.PIPELINE_CONVEX_SECRET = TEST_SECRET
  })
  afterEach(() => {
    if (prevSecret === undefined) delete process.env.PIPELINE_CONVEX_SECRET
    else process.env.PIPELINE_CONVEX_SECRET = prevSecret
  })

  async function seed(t: ReturnType<typeof convexTest>, claims: Claim[]) {
    await t.mutation(api.claimChecks.insertBatch, {
      workspace_id: WS,
      runId: RUN_ID,
      claims,
      pipelineSecret: TEST_SECRET,
    })
  }

  it('insertBatch persists all five verdict fields', async () => {
    const t = convexTest({ schema, modules })
    await seed(t, [
      claim(0, {
        verdict: 'contradicted',
        verdictEvidence: 'Source says 1998',
        verdictSources: ['https://a.org/x'],
        verdictAt: 1700000000000,
        verdictModel: 'anthropic/claude-haiku-4-5',
      }),
    ])
    const rows = await t.query(api.claimChecks.listByRunId, { runId: RUN_ID })
    expect(rows[0].verdict).toBe('contradicted')
    expect(rows[0].verdictEvidence).toBe('Source says 1998')
    expect(rows[0].verdictSources).toEqual(['https://a.org/x'])
    expect(rows[0].verdictAt).toBe(1700000000000)
    expect(rows[0].verdictModel).toBe('anthropic/claude-haiku-4-5')
  })

  it('insertBatch omits verdict keys entirely when absent (legacy shape)', async () => {
    const t = convexTest({ schema, modules })
    await seed(t, [claim(0)])
    const rows = await t.query(api.claimChecks.listByRunId, { runId: RUN_ID })
    for (const k of ['verdict', 'verdictEvidence', 'verdictSources', 'verdictAt', 'verdictModel']) {
      expect(k in rows[0]).toBe(false)
    }
  })

  it('insertBatch rejects an unknown verdict literal', async () => {
    const t = convexTest({ schema, modules })
    await expect(
      seed(t, [claim(0, { verdict: 'maybe' as unknown as 'verified' })]),
    ).rejects.toThrow()
  })

  it('inserted rows always start pending', async () => {
    const t = convexTest({ schema, modules })
    await seed(t, [claim(0, { verdict: 'verified' }), claim(1)])
    const rows = await t.query(api.claimChecks.listByRunId, { runId: RUN_ID })
    expect(rows.map(r => r.status)).toEqual(['pending', 'pending'])
  })
})

describe('allSignedOff — Phase 51.1 semantics', () => {
  const prevSecret = process.env.PIPELINE_CONVEX_SECRET
  beforeEach(() => {
    process.env.PIPELINE_CONVEX_SECRET = TEST_SECRET
  })
  afterEach(() => {
    if (prevSecret === undefined) delete process.env.PIPELINE_CONVEX_SECRET
    else process.env.PIPELINE_CONVEX_SECRET = prevSecret
  })

  async function seed(t: ReturnType<typeof convexTest>, claims: Claim[]) {
    await t.mutation(api.claimChecks.insertBatch, {
      workspace_id: WS,
      runId: RUN_ID,
      claims,
      pipelineSecret: TEST_SECRET,
    })
  }
  const gate = (t: ReturnType<typeof convexTest>) =>
    t.query(api.claimChecks.allSignedOff, { runId: RUN_ID })

  it('zero claims => allSignedOff true (VRD-05)', async () => {
    const t = convexTest({ schema, modules })
    expect(await gate(t)).toEqual({ total: 0, signedOff: 0, blocking: 0, flagged: 0, allSignedOff: true })
  })

  it('pending contradicted blocks; setStatus checked unblocks', async () => {
    const t = convexTest({ schema, modules })
    await seed(t, [claim(0, { verdict: 'contradicted' })])
    const g = await gate(t)
    expect(g.allSignedOff).toBe(false)
    expect(g.blocking).toBe(1)
    expect(g.flagged).toBe(1)

    await t.withIdentity({ subject: 'user_operator' }).mutation(api.claimChecks.setStatus, {
      runId: RUN_ID, claimIndex: 0, status: 'checked',
    })
    expect((await gate(t)).allSignedOff).toBe(true)
  })

  it('skipped / remove / keepAsWritten each unblock a contradicted claim', async () => {
    const t = convexTest({ schema, modules })
    await seed(t, [
      claim(0, { verdict: 'contradicted' }),
      claim(1, { verdict: 'contradicted' }),
      claim(2, { verdict: 'contradicted' }),
    ])
    expect((await gate(t)).blocking).toBe(3)
    await t.withIdentity({ subject: 'user_operator' }).mutation(api.claimChecks.setStatus, {
      runId: RUN_ID, claimIndex: 0, status: 'skipped',
    })
    expect((await gate(t)).blocking).toBe(2)
    await t.mutation(api.claimChecks.remove, { runId: RUN_ID, claimIndex: 1, pipelineSecret: TEST_SECRET })
    expect((await gate(t)).blocking).toBe(1)
    await t.mutation(api.claimChecks.keepAsWritten, { runId: RUN_ID, claimIndex: 2, pipelineSecret: TEST_SECRET })
    const g = await gate(t)
    expect(g.blocking).toBe(0)
    expect(g.allSignedOff).toBe(true)
  })

  it('markChanged makes a contradicted claim non-blocking (decision 1)', async () => {
    const t = convexTest({ schema, modules })
    await seed(t, [claim(0, { verdict: 'contradicted' })])
    await t.mutation(api.claimChecks.markChanged, { runId: RUN_ID, claimIndex: 0, pipelineSecret: TEST_SECRET })
    const g = await gate(t)
    expect(g.allSignedOff).toBe(true)
    expect(g.blocking).toBe(0)
    expect(g.flagged).toBe(0)
  })

  it('pending verified, unverifiable Load-bearing and legacy rows never block (VRD-04/06)', async () => {
    const t = convexTest({ schema, modules })
    await seed(t, [
      claim(0, { verdict: 'verified' }),
      claim(1, { verdict: 'unverifiable', importance: 'Load-bearing' }),
      claim(2, { importance: 'Load-bearing' }), // legacy: no verdict
    ])
    const g = await gate(t)
    expect(g.allSignedOff).toBe(true)
    expect(g.blocking).toBe(0)
    expect(g.flagged).toBe(1)
  })
})
