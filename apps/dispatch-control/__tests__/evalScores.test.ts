/**
 * Phase 38 — Plan 38-01 (§38.2): eval_scores Convex integration tests.
 * Runs in edge-runtime environment (required by convex-test).
 *
 * Tests the evalScores mutation/query contract:
 *   record → inserts an append-only row, requireOperator-guarded
 *   listForScenario → returns the time-series rows for one scenario
 *   listForAgent → returns rows for one agent (drift scoreboard source)
 *
 * Also source-scans convex/evalScores.ts to lock the append-only invariant:
 * this file must never call ctx.db.patch or ctx.db.delete.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires import.meta.glob to resolve Convex modules at test time.
// This glob must be a literal in the calling file (Vite static analysis requirement).
const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'

const BASE_ROW = {
  workspace_id: WS,
  scenarioId: 'scout_normal_week',
  agentKey: 'scout',
  promptVersion: '1',
  overall: 8.2,
  axes: JSON.stringify([{ axis: 'gravity', score: 8, pass: true, note: 'fine' }]),
  costUsd: 0.014,
  source: 'drawer',
}

describe('evalScores: record + listForScenario + listForAgent (Phase 38 §38.2)', () => {
  it('record inserts a row; listForScenario returns it with all D-09 fields intact', async () => {
    const t = convexTest({ schema, modules })

    await t.withIdentity({ subject: 'user_operator' }).mutation(api.evalScores.record, BASE_ROW)

    const rows = await t.query(api.evalScores.listForScenario, {
      workspace_id: WS,
      scenarioId: 'scout_normal_week',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].workspace_id).toBe(WS)
    expect(rows[0].scenarioId).toBe('scout_normal_week')
    expect(rows[0].agentKey).toBe('scout')
    expect(rows[0].promptVersion).toBe('1')
    expect(rows[0].overall).toBe(8.2)
    expect(rows[0].axes).toBe(BASE_ROW.axes)
    expect(rows[0].costUsd).toBe(0.014)
    expect(rows[0].source).toBe('drawer')
    expect(typeof rows[0].ranAt).toBe('number')
    expect(rows[0].ranAt).toBeGreaterThan(0)
  })

  it('calling record twice for the same scenarioId+promptVersion produces TWO rows (append-only)', async () => {
    const t = convexTest({ schema, modules })
    const identity = t.withIdentity({ subject: 'user_operator' })

    await identity.mutation(api.evalScores.record, BASE_ROW)
    await identity.mutation(api.evalScores.record, { ...BASE_ROW, overall: 7.9 })

    const rows = await t.query(api.evalScores.listForScenario, {
      workspace_id: WS,
      scenarioId: 'scout_normal_week',
    })

    expect(rows).toHaveLength(2)
    // Never patched/deduped — both distinct overall values persist as separate rows.
    const overalls = rows.map((r) => r.overall).sort()
    expect(overalls).toEqual([7.9, 8.2])
  })

  it('evalScores.ts source contains no ctx.db.patch or ctx.db.delete (append-only invariant)', () => {
    const source = readFileSync(
      join(__dirname, '../../../convex/evalScores.ts'),
      'utf-8',
    )
    expect(/ctx\.db\.(patch|delete)/.test(source)).toBe(false)
  })

  it('record without an operator identity is rejected (requireOperator guard)', async () => {
    const t = convexTest({ schema, modules })

    await expect(t.mutation(api.evalScores.record, BASE_ROW)).rejects.toThrow(
      /Unauthorized/,
    )
  })

  it('listForAgent returns rows for one agent, newest-first', async () => {
    const t = convexTest({ schema, modules })
    const identity = t.withIdentity({ subject: 'user_operator' })

    await identity.mutation(api.evalScores.record, BASE_ROW)
    await identity.mutation(api.evalScores.record, {
      ...BASE_ROW,
      scenarioId: 'scout_dry_well',
      overall: 6.5,
    })

    const rows = await t.query(api.evalScores.listForAgent, {
      workspace_id: WS,
      agentKey: 'scout',
    })

    expect(rows).toHaveLength(2)
    // Newest-first: scout_dry_well was inserted second.
    expect(rows[0].scenarioId).toBe('scout_dry_well')
    expect(rows[1].scenarioId).toBe('scout_normal_week')
  })
})
