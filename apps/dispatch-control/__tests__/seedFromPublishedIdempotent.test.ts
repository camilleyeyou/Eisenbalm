/**
 * Quick 260717-41s — SEED-IDEMPOTENT-01: seedFromPublished idempotency
 * coverage.
 *
 * Runs in edge-runtime environment (required by convex-test; registered in
 * vitest.config.ts).
 *
 * `seedFromPublished` is documented as idempotent in three places, but the
 * pre-fix implementation incremented `timesFeatured` per row per call — so
 * every re-run of the backfill script inflated the counter (live dev
 * deployment shows `RIP Medical Debt` at `timesFeatured: 33886`). The fix
 * tallies occurrences per dedupKey across the input rows, then SETs
 * `timesFeatured` to that tally instead of incrementing it.
 *
 * Four cases:
 *   1. IDEMPOTENCY (the regression under test) — seeding the SAME rows twice
 *      yields the SAME timesFeatured, and no duplicate row is created.
 *   2. IN-CALL MULTIPLICITY — the same charity appearing 3x in ONE `rows`
 *      array ends with timesFeatured === 3.
 *   3. FRESH-INSERT MULTIPLICITY — on an empty registry, 3 duplicate rows in
 *      one call insert with timesFeatured === 3 (pins the insert path
 *      against a hardcoded 1).
 *   4. CONVERGENCE / SELF-HEAL — a pre-corrupted row (timesFeatured: 33886)
 *      converges to the correct tally (1) on the next seed call.
 *
 * `lastFeaturedAt` is NOT asserted — it intentionally refreshes every run.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires import.meta.glob to resolve Convex modules at test time.
// This glob must be a literal in the calling file (Vite static analysis requirement).
const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'
const TEST_SECRET = 'test-pipeline-secret-260717'

describe('charities.seedFromPublished — idempotency (Quick 260717-41s, SEED-IDEMPOTENT-01)', () => {
  const prevSecret = process.env.PIPELINE_CONVEX_SECRET

  beforeEach(() => {
    process.env.PIPELINE_CONVEX_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env.PIPELINE_CONVEX_SECRET = prevSecret
  })

  it('case 1: seeding the SAME rows twice yields the SAME timesFeatured (no doubling, no duplicate row)', async () => {
    const t = convexTest({ schema, modules })

    const rows = [{ name: 'RIP Medical Debt', website: 'https://ripmedicaldebt.org' }]

    await t.mutation(api.charities.seedFromPublished, {
      workspace_id: WS,
      rows,
      pipelineSecret: TEST_SECRET,
    })

    const afterRun1 = await t.query(api.charities.listByWorkspace, { workspace_id: WS })
    const run1 = afterRun1.find(r => r.name === 'RIP Medical Debt')
    expect(run1).toBeDefined()
    expect(run1?.timesFeatured).toBe(1)

    await t.mutation(api.charities.seedFromPublished, {
      workspace_id: WS,
      rows,
      pipelineSecret: TEST_SECRET,
    })

    const afterRun2 = await t.query(api.charities.listByWorkspace, { workspace_id: WS })
    const matching = afterRun2.filter(r => r.name === 'RIP Medical Debt')
    expect(matching).toHaveLength(1)
    expect(matching[0].timesFeatured).toBe(1)
    expect(matching[0].timesFeatured).toBe(run1?.timesFeatured)
  })

  it('case 2: the same charity appearing 3x in ONE rows array ends with timesFeatured === 3', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(api.charities.seedFromPublished, {
      workspace_id: WS,
      rows: [
        { name: 'Second Chance Farm', website: 'https://secondchancefarm.org' },
        { name: 'Second Chance Farm', website: 'https://secondchancefarm.org' },
        { name: 'Second Chance Farm', website: 'https://secondchancefarm.org' },
      ],
      pipelineSecret: TEST_SECRET,
    })

    const rows = await t.query(api.charities.listByWorkspace, { workspace_id: WS })
    const matching = rows.filter(r => r.name === 'Second Chance Farm')
    expect(matching).toHaveLength(1)
    expect(matching[0].timesFeatured).toBe(3)
  })

  it('case 3: fresh insert with 3 duplicate rows in one call inserts with timesFeatured === 3 (not hardcoded 1)', async () => {
    const t = convexTest({ schema, modules })

    // Empty registry — no pre-existing row for this dedupKey.
    await t.mutation(api.charities.seedFromPublished, {
      workspace_id: WS,
      rows: [
        { name: 'Quiet Harbor Trust', website: 'https://quietharbortrust.org' },
        { name: 'Quiet Harbor Trust', website: 'https://quietharbortrust.org' },
        { name: 'Quiet Harbor Trust', website: 'https://quietharbortrust.org' },
      ],
      pipelineSecret: TEST_SECRET,
    })

    const rows = await t.query(api.charities.listByWorkspace, { workspace_id: WS })
    const matching = rows.filter(r => r.name === 'Quiet Harbor Trust')
    expect(matching).toHaveLength(1)
    expect(matching[0].timesFeatured).toBe(3)
    expect(matching[0].status).toBe('featured')
  })

  it('case 4: a pre-corrupted row (timesFeatured: 33886) converges to the tally on re-seed (self-heal)', async () => {
    const t = convexTest({ schema, modules })

    const domain = 'ripmedicaldebt.org'
    const dedupKey = `rip medical debt|${domain}`

    await t.run(async ctx => {
      await ctx.db.insert('charities', {
        workspace_id: WS,
        name: 'RIP Medical Debt',
        status: 'featured',
        website: 'https://ripmedicaldebt.org',
        domain,
        dedupKey,
        timesFeatured: 33886,
        lastFeaturedAt: Date.now(),
      })
    })

    await t.mutation(api.charities.seedFromPublished, {
      workspace_id: WS,
      rows: [{ name: 'RIP Medical Debt', website: 'https://ripmedicaldebt.org' }],
      pipelineSecret: TEST_SECRET,
    })

    const rows = await t.query(api.charities.listByWorkspace, { workspace_id: WS })
    const matching = rows.filter(r => r.name === 'RIP Medical Debt')
    expect(matching).toHaveLength(1)
    expect(matching[0].timesFeatured).toBe(1)
  })

  it('guard: seedFromPublished still rejects a missing/wrong pipelineSecret', async () => {
    const t = convexTest({ schema, modules })

    await expect(
      t.mutation(api.charities.seedFromPublished, {
        workspace_id: WS,
        rows: [{ name: 'Some Charity' }],
      }),
    ).rejects.toThrow(/Unauthorized/)

    await expect(
      t.mutation(api.charities.seedFromPublished, {
        workspace_id: WS,
        rows: [{ name: 'Some Charity' }],
        pipelineSecret: 'not-the-secret',
      }),
    ).rejects.toThrow(/Unauthorized/)
  })
})
