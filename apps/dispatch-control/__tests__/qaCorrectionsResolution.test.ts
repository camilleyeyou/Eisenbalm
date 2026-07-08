/**
 * Phase 33 — Plan 33-02: Convex resolution-state coverage.
 * Runs in edge-runtime environment (required by convex-test).
 *
 * Proves the resolution machinery §33.1/§33.2/§33.7 behaves as designed:
 *   1. qaCorrections.setResolution is PIPELINE-lane (secret-guarded) —
 *      rejects without the pipeline secret (unlike the public insert).
 *   2. Accept sets resolution='accepted' AND syncs legacy accepted=true.
 *   3. Dismiss records resolutionReason and leaves legacy accepted falsy.
 *   4. Reopen (resolution: undefined) clears the resolution fields and sets
 *      accepted=false.
 *   5. claimChecks.setStatus stamps a numeric checkedAt on 'checked' only —
 *      NOT on 'pending' (no false check time).
 *   6. qaCorrections.byId returns the inserted row; pitchLog.selectedByRunId
 *      returns only the selected pitch.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires import.meta.glob to resolve Convex modules at test time.
// This glob must be a literal in the calling file (Vite static analysis requirement).
const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'
const TEST_SECRET = 'test-pipeline-secret-260703'
const RUN_ID = 'run-resolution-33'

async function seedFinding(t: ReturnType<typeof convexTest>) {
  // `insert` is the public GAM-05 exception — no identity/secret needed.
  return await t.mutation(api.qaCorrections.insert, {
    runId: RUN_ID,
    agentId: 'qa',
    sectionName: 'originStory',
    reason: 'Sentiment leak in the closing line',
    severity: 'error',
    accepted: false,
    axis: 'sentiment',
    quotedSpan: 'a truly heartwarming ending',
    suggestedFix: 'an ending',
  })
}

describe('Phase 33 — qaCorrections resolution state (33-02)', () => {
  const prevSecret = process.env.PIPELINE_CONVEX_SECRET

  beforeEach(() => {
    process.env.PIPELINE_CONVEX_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env.PIPELINE_CONVEX_SECRET = prevSecret
  })

  it('setResolution WITHOUT the pipeline secret rejects (secret-guarded, unlike public insert)', async () => {
    const t = convexTest({ schema, modules })
    const id = await seedFinding(t)

    await expect(
      t.mutation(api.qaCorrections.setResolution, {
        id,
        resolution: 'accepted',
      }),
    ).rejects.toThrow(/Unauthorized/)

    // Wrong secret rejects too.
    await expect(
      t.mutation(api.qaCorrections.setResolution, {
        id,
        resolution: 'accepted',
        pipelineSecret: 'not-the-secret',
      }),
    ).rejects.toThrow(/Unauthorized/)
  })

  it("setResolution WITH the secret and resolution:'accepted' sets resolution AND legacy accepted=true", async () => {
    const t = convexTest({ schema, modules })
    const id = await seedFinding(t)

    await t.mutation(api.qaCorrections.setResolution, {
      id,
      resolution: 'accepted',
      resolvedBy: 'user_operator',
      resolvedAt: 1234567890,
      pipelineSecret: TEST_SECRET,
    })

    const row = await t.query(api.qaCorrections.byId, { id })
    expect(row?.resolution).toBe('accepted')
    expect(row?.accepted).toBe(true)
    expect(row?.resolvedBy).toBe('user_operator')
    expect(row?.resolvedAt).toBe(1234567890)
  })

  it("setResolution with resolution:'dismissed' records the reason and leaves accepted falsy", async () => {
    const t = convexTest({ schema, modules })
    const id = await seedFinding(t)

    await t.mutation(api.qaCorrections.setResolution, {
      id,
      resolution: 'dismissed',
      resolutionReason: 'fixed by my edit',
      resolvedBy: 'user_operator',
      resolvedAt: Date.now(),
      pipelineSecret: TEST_SECRET,
    })

    const row = await t.query(api.qaCorrections.byId, { id })
    expect(row?.resolution).toBe('dismissed')
    expect(row?.resolutionReason).toBe('fixed by my edit')
    expect(row?.accepted).toBeFalsy()
  })

  it('setResolution with resolution: undefined (reopen) clears resolution fields and sets accepted=false', async () => {
    const t = convexTest({ schema, modules })
    const id = await seedFinding(t)

    // First accept it…
    await t.mutation(api.qaCorrections.setResolution, {
      id,
      resolution: 'accepted',
      resolutionReason: 'looks right',
      resolvedBy: 'user_operator',
      resolvedAt: Date.now(),
      pipelineSecret: TEST_SECRET,
    })

    // …then reopen (D-04): omit resolution — Convex patch with undefined
    // removes the optional fields.
    await t.mutation(api.qaCorrections.setResolution, {
      id,
      pipelineSecret: TEST_SECRET,
    })

    const row = await t.query(api.qaCorrections.byId, { id })
    expect(row?.resolution).toBeUndefined()
    expect(row?.resolutionReason).toBeUndefined()
    expect(row?.resolvedBy).toBeUndefined()
    expect(row?.resolvedAt).toBeUndefined()
    expect(row?.accepted).toBe(false)
  })

  it("claimChecks.setStatus stamps numeric checkedAt on 'checked' but NOT on 'pending'", async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(api.claimChecks.insertBatch, {
      workspace_id: WS,
      runId: RUN_ID,
      claims: [
        { claimIndex: 0, text: '1,200 dogs', claimType: 'number', context: 'trained 1,200 dogs since' },
        { claimIndex: 1, text: '1997', claimType: 'date', context: 'founded in 1997 by' },
      ],
      pipelineSecret: TEST_SECRET,
    })

    const asOperator = t.withIdentity({ subject: 'user_operator' })

    // Flip claim 0 to checked — checkedAt stamped.
    await asOperator.mutation(api.claimChecks.setStatus, {
      runId: RUN_ID,
      claimIndex: 0,
      status: 'checked',
    })

    // Flip claim 1 to checked then back to pending — reopen must NOT stamp
    // (a fresh pending row also carries no checkedAt).
    let rows = await t.query(api.claimChecks.listByRunId, { runId: RUN_ID })
    const fresh = rows.find(r => r.claimIndex === 1)
    expect(fresh?.checkedAt).toBeUndefined()

    await asOperator.mutation(api.claimChecks.setStatus, {
      runId: RUN_ID,
      claimIndex: 1,
      status: 'pending',
    })

    rows = await t.query(api.claimChecks.listByRunId, { runId: RUN_ID })
    const checked = rows.find(r => r.claimIndex === 0)
    const pending = rows.find(r => r.claimIndex === 1)
    expect(typeof checked?.checkedAt).toBe('number')
    expect(pending?.checkedAt).toBeUndefined()
  })

  it('qaCorrections.byId returns the inserted row; pitchLog.selectedByRunId returns only the selected pitch', async () => {
    const t = convexTest({ schema, modules })
    const id = await seedFinding(t)

    const finding = await t.query(api.qaCorrections.byId, { id })
    expect(finding?._id).toBe(id)
    expect(finding?.quotedSpan).toBe('a truly heartwarming ending')

    // Seed two pitches — one selected, one not.
    await t.mutation(api.pitchLog.insert, {
      runId: RUN_ID,
      charityName: 'The Quiet Foundation',
      charityLocation: 'Duluth, MN',
      scoutSummary: 'Runs silence retreats for dispatchers',
      selected: false,
      pipelineSecret: TEST_SECRET,
    })
    await t.mutation(api.pitchLog.insert, {
      runId: RUN_ID,
      charityName: 'Puppies Behind Bars',
      charityLocation: 'New York, NY',
      scoutSummary: 'Incarcerated trainers raise service dogs',
      selected: true,
      pipelineSecret: TEST_SECRET,
    })

    const selected = await t.query(api.pitchLog.selectedByRunId, { runId: RUN_ID })
    expect(selected?.charityName).toBe('Puppies Behind Bars')
    expect(selected?.selected).toBe(true)
    expect(selected?.scoutSummary).toBe('Incarcerated trainers raise service dogs')
  })
})
