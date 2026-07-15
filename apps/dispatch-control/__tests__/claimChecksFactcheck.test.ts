/**
 * Phase 42 — Plan 42-01: Fact Check Stage contract + schema Convex coverage.
 * Runs in edge-runtime environment (required by convex-test).
 *
 * Proves the §42.1/§42.3 machinery behaves as designed:
 *   1. insertBatch persists an importance value when present, and omits the
 *      key entirely (never a fabricated value) when absent (v.optional).
 *   2. byRunIdAndIndex returns the single matching row, or null when absent.
 *   3. updateClaim is pipeline-secret-guarded and patches only the provided
 *      fields (text/sourceUrl/retrievedAt).
 *   4. markChanged sets status:'pending' AND changedSinceCheck:true, guarded.
 *   5. keepAsWritten sets the terminal status (default 'checked') AND clears
 *      changedSinceCheck, guarded.
 *   6. remove sets status:'removed', guarded.
 *   7. setStatus clears changedSinceCheck when flipping to 'checked'/'skipped'
 *      (D-20 — the marker is cleared the next time the claim is checked).
 *   8. allSignedOff regression: a run with one must-fix (Load-bearing, no
 *      sourceUrl, pending) row returns false; after Confirm/keep/remove it
 *      returns true — the removed/kept row satisfies the `!== 'pending'` gate
 *      with zero code change to allSignedOff itself (42-RESEARCH Pitfall 4).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires import.meta.glob to resolve Convex modules at test time.
// This glob must be a literal in the calling file (Vite static analysis requirement).
const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'
const TEST_SECRET = 'test-pipeline-secret-fact-check-42'
const RUN_ID = 'run-fact-check-42'

async function seedClaims(t: ReturnType<typeof convexTest>) {
  await t.mutation(api.claimChecks.insertBatch, {
    workspace_id: WS,
    runId: RUN_ID,
    claims: [
      {
        claimIndex: 0,
        text: 'demand outpaces supply four to one',
        claimType: 'number',
        context: 'across the region, demand outpaces supply four to one this year',
        importance: 'Load-bearing',
        // no sourceUrl — unsourced load-bearing claim => must-fix
      },
      {
        claimIndex: 1,
        text: '1997',
        claimType: 'date',
        context: 'founded in 1997 by',
        // importance omitted entirely — must NOT persist a fabricated key
      },
    ],
    pipelineSecret: TEST_SECRET,
  })
}

describe('Phase 42 — claimChecks Fact Check Stage additions (42-01)', () => {
  const prevSecret = process.env.PIPELINE_CONVEX_SECRET

  beforeEach(() => {
    process.env.PIPELINE_CONVEX_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env.PIPELINE_CONVEX_SECRET = prevSecret
  })

  it('insertBatch persists importance when present and omits the key entirely when absent', async () => {
    const t = convexTest({ schema, modules })
    await seedClaims(t)

    const rows = await t.query(api.claimChecks.listByRunId, { runId: RUN_ID })
    const loadBearing = rows.find(r => r.claimIndex === 0)
    const noImportance = rows.find(r => r.claimIndex === 1)

    expect(loadBearing?.importance).toBe('Load-bearing')
    expect(noImportance).not.toHaveProperty('importance')
  })

  it('byRunIdAndIndex returns the matching row, or null when absent', async () => {
    const t = convexTest({ schema, modules })
    await seedClaims(t)

    const found = await t.query(api.claimChecks.byRunIdAndIndex, {
      runId: RUN_ID,
      claimIndex: 1,
    })
    expect(found?.text).toBe('1997')

    const missing = await t.query(api.claimChecks.byRunIdAndIndex, {
      runId: RUN_ID,
      claimIndex: 99,
    })
    expect(missing).toBeNull()
  })

  it('updateClaim rejects without the pipeline secret and patches only provided fields when authorized', async () => {
    const t = convexTest({ schema, modules })
    await seedClaims(t)

    await expect(
      t.mutation(api.claimChecks.updateClaim, {
        runId: RUN_ID,
        claimIndex: 0,
        sourceUrl: 'https://postandcourier.com/example',
      }),
    ).rejects.toThrow(/Unauthorized/)

    await t.mutation(api.claimChecks.updateClaim, {
      runId: RUN_ID,
      claimIndex: 0,
      sourceUrl: 'https://postandcourier.com/example',
      retrievedAt: 1750000000000,
      pipelineSecret: TEST_SECRET,
    })

    const row = await t.query(api.claimChecks.byRunIdAndIndex, {
      runId: RUN_ID,
      claimIndex: 0,
    })
    expect(row?.sourceUrl).toBe('https://postandcourier.com/example')
    expect(row?.retrievedAt).toBe(1750000000000)
    // text untouched — only the provided fields patch
    expect(row?.text).toBe('demand outpaces supply four to one')
  })

  it("markChanged sets status:'pending' and changedSinceCheck:true, guarded by pipelineSecret", async () => {
    const t = convexTest({ schema, modules })
    await seedClaims(t)

    // First confirm the claim so it is no longer pending...
    await t.mutation(api.claimChecks.keepAsWritten, {
      runId: RUN_ID,
      claimIndex: 1,
      pipelineSecret: TEST_SECRET,
    })

    await expect(
      t.mutation(api.claimChecks.markChanged, { runId: RUN_ID, claimIndex: 1 }),
    ).rejects.toThrow(/Unauthorized/)

    await t.mutation(api.claimChecks.markChanged, {
      runId: RUN_ID,
      claimIndex: 1,
      pipelineSecret: TEST_SECRET,
    })

    const row = await t.query(api.claimChecks.byRunIdAndIndex, {
      runId: RUN_ID,
      claimIndex: 1,
    })
    expect(row?.status).toBe('pending')
    expect(row?.changedSinceCheck).toBe(true)
  })

  it("keepAsWritten sets the terminal status (default 'checked') and clears changedSinceCheck, guarded", async () => {
    const t = convexTest({ schema, modules })
    await seedClaims(t)

    await t.mutation(api.claimChecks.markChanged, {
      runId: RUN_ID,
      claimIndex: 1,
      pipelineSecret: TEST_SECRET,
    })

    await expect(
      t.mutation(api.claimChecks.keepAsWritten, { runId: RUN_ID, claimIndex: 1 }),
    ).rejects.toThrow(/Unauthorized/)

    await t.mutation(api.claimChecks.keepAsWritten, {
      runId: RUN_ID,
      claimIndex: 1,
      pipelineSecret: TEST_SECRET,
    })

    const row = await t.query(api.claimChecks.byRunIdAndIndex, {
      runId: RUN_ID,
      claimIndex: 1,
    })
    expect(row?.status).toBe('checked')
    expect(row?.changedSinceCheck).toBeUndefined()
    expect(typeof row?.checkedAt).toBe('number')
  })

  it("remove sets status:'removed', guarded by pipelineSecret", async () => {
    const t = convexTest({ schema, modules })
    await seedClaims(t)

    await expect(
      t.mutation(api.claimChecks.remove, { runId: RUN_ID, claimIndex: 0 }),
    ).rejects.toThrow(/Unauthorized/)

    await t.mutation(api.claimChecks.remove, {
      runId: RUN_ID,
      claimIndex: 0,
      pipelineSecret: TEST_SECRET,
    })

    const row = await t.query(api.claimChecks.byRunIdAndIndex, {
      runId: RUN_ID,
      claimIndex: 0,
    })
    expect(row?.status).toBe('removed')
  })

  it("setStatus clears changedSinceCheck when flipping to 'checked' or 'skipped' (D-20)", async () => {
    const t = convexTest({ schema, modules })
    await seedClaims(t)

    await t.mutation(api.claimChecks.markChanged, {
      runId: RUN_ID,
      claimIndex: 1,
      pipelineSecret: TEST_SECRET,
    })

    let row = await t.query(api.claimChecks.byRunIdAndIndex, { runId: RUN_ID, claimIndex: 1 })
    expect(row?.changedSinceCheck).toBe(true)

    const asOperator = t.withIdentity({ subject: 'user_operator' })
    await asOperator.mutation(api.claimChecks.setStatus, {
      runId: RUN_ID,
      claimIndex: 1,
      status: 'checked',
    })

    row = await t.query(api.claimChecks.byRunIdAndIndex, { runId: RUN_ID, claimIndex: 1 })
    expect(row?.status).toBe('checked')
    expect(row?.changedSinceCheck).toBeUndefined()
    expect(typeof row?.checkedAt).toBe('number')
  })

  it('allSignedOff regression: an unsourced Load-bearing pending row blocks; Confirm/keep/remove unblocks', async () => {
    const t = convexTest({ schema, modules })
    await seedClaims(t)
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    // claimIndex 1 (no importance -> Supporting fallback, has no sourceUrl but
    // is not Load-bearing) still starts pending, so allSignedOff is false with
    // BOTH rows pending regardless of severity — the gate is purely
    // "no pending rows", not importance-aware itself (severity/mustFix is a
    // client-side derived concern, D-05).
    let gate = await t.query(api.claimChecks.allSignedOff, { runId: RUN_ID })
    expect(gate.allSignedOff).toBe(false)
    expect(gate.total).toBe(2)

    // Confirm the must-fix claim (claimIndex 0) via the existing operator path.
    await asOperator.mutation(api.claimChecks.setStatus, {
      runId: RUN_ID,
      claimIndex: 0,
      status: 'checked',
    })
    gate = await t.query(api.claimChecks.allSignedOff, { runId: RUN_ID })
    expect(gate.allSignedOff).toBe(false) // claimIndex 1 still pending

    // Keep-as-written the second row.
    await t.mutation(api.claimChecks.keepAsWritten, {
      runId: RUN_ID,
      claimIndex: 1,
      pipelineSecret: TEST_SECRET,
    })
    gate = await t.query(api.claimChecks.allSignedOff, { runId: RUN_ID })
    expect(gate.allSignedOff).toBe(true)
    expect(gate.signedOff).toBe(2)
  })

  it('allSignedOff regression variant: remove() also satisfies the gate without touching allSignedOff/listByRunId', async () => {
    const t = convexTest({ schema, modules })
    await seedClaims(t)
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.claimChecks.setStatus, {
      runId: RUN_ID,
      claimIndex: 0,
      status: 'checked',
    })
    await t.mutation(api.claimChecks.remove, {
      runId: RUN_ID,
      claimIndex: 1,
      pipelineSecret: TEST_SECRET,
    })

    const gate = await t.query(api.claimChecks.allSignedOff, { runId: RUN_ID })
    expect(gate.allSignedOff).toBe(true)

    const rows = await t.query(api.claimChecks.listByRunId, { runId: RUN_ID })
    expect(rows.find(r => r.claimIndex === 1)?.status).toBe('removed')
  })
})
