/**
 * Phase 24 Wave 0 — RED tests for convex/promptVersions.activate + list/get (PRM-04).
 *
 * Runs in edge-runtime (convex-test requirement; registered in vitest.config.ts).
 *
 * activate must:
 *   - return { blocked: true } and flip NO isActive when a `runs` row has status='running' (D-02)
 *   - otherwise flip isActive so exactly one row is active, and emit audit
 *     action 'prompt_version.activated'
 * listForAgent returns newest-first; getByVersion returns the exact row.
 *
 * RED until Plan 02 lands activate/listForAgent/getByVersion. The symbols are
 * undefined until then, so each mutation/query call throws — the intended RED.
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'
const AGENT = 'scout'

/** Seed two prompt_versions rows (v1 active, v2 inactive) directly. */
async function seedTwoVersions(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    await ctx.db.insert('prompt_versions', {
      workspace_id: WS,
      agentKey: AGENT,
      version: 1,
      content: 'V1',
      isActive: true,
      createdAt: Date.now(),
    })
    await ctx.db.insert('prompt_versions', {
      workspace_id: WS,
      agentKey: AGENT,
      version: 2,
      content: 'V2',
      isActive: false,
      createdAt: Date.now() + 1,
    })
  })
}

describe('promptVersions.activate (PRM-04, D-02 in-progress guard)', () => {
  it('activate returns blocked when a run is running', async () => {
    const t = convexTest({ schema, modules })
    await seedTwoVersions(t)

    // Insert a run in 'running' status for this workspace.
    await t.run(async (ctx) => {
      await ctx.db.insert('runs', {
        workspace_id: WS,
        runId: 'run-inflight',
        triggerSource: 'manual',
        status: 'running',
        startedAt: Date.now(),
      })
    })

    const result = await t.withIdentity({ subject: 'user_operator' }).mutation(
      api.promptVersions.activate,
      {
        workspace_id: WS,
        agentKey: AGENT,
        version: 2,
        actorId: 'user_operator',
      },
    )

    expect(result.blocked).toBe(true)

    // No isActive flip occurred: v1 still active, v2 still inactive.
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query('prompt_versions')
        .withIndex('by_workspace_agentKey', (q) =>
          q.eq('workspace_id', WS).eq('agentKey', AGENT),
        )
        .collect(),
    )
    expect(rows.find((r) => r.version === 1)!.isActive).toBe(true)
    expect(rows.find((r) => r.version === 2)!.isActive).toBe(false)
  })

  it('activate flips isActive when no run is running and audits it', async () => {
    const t = convexTest({ schema, modules })
    await seedTwoVersions(t)

    // Phase 38 §38.3: a currently-active version (v1) means the eval gate
    // applies to v2 — seed a fresh, non-regressing eval_scores row for v2 so
    // this test continues to exercise ONLY the D-02 in-progress guard (the
    // eval gate itself is covered by promptVersionsEvalGate.test.ts).
    await t.run(async (ctx) => {
      await ctx.db.insert('eval_scores', {
        workspace_id: WS,
        agentKey: AGENT,
        scenarioId: 'scout_normal_week',
        promptVersion: '2',
        overall: 8.0,
        axes: JSON.stringify([]),
        costUsd: 0.01,
        ranAt: Date.now() + 10_000_000, // guarantees freshness vs v2.createdAt
        source: 'commit',
      })
    })

    await t.withIdentity({ subject: 'user_operator' }).mutation(
      api.promptVersions.activate,
      {
        workspace_id: WS,
        agentKey: AGENT,
        version: 2,
        actorId: 'user_operator',
      },
    )

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query('prompt_versions')
        .withIndex('by_workspace_agentKey', (q) =>
          q.eq('workspace_id', WS).eq('agentKey', AGENT),
        )
        .collect(),
    )

    const active = rows.filter((r) => r.isActive)
    expect(active).toHaveLength(1)
    expect(active[0].version).toBe(2)

    const audit = await t.run(async (ctx) =>
      ctx.db
        .query('audit_log')
        .withIndex('by_workspace', (q) => q.eq('workspace_id', WS))
        .collect(),
    )
    expect(audit.some((r) => r.action === 'prompt_version.activated')).toBe(true)
  })
})

describe('promptVersions.listForAgent + getByVersion (PRM-04)', () => {
  it('listForAgent returns newest-first', async () => {
    const t = convexTest({ schema, modules })
    await seedTwoVersions(t)

    const list = await t.query(api.promptVersions.listForAgent, {
      workspace_id: WS,
      agentKey: AGENT,
    })

    expect(list).toHaveLength(2)
    expect(list[0].version).toBe(2) // newest first
    expect(list[1].version).toBe(1)
  })

  it('getByVersion returns the exact row', async () => {
    const t = convexTest({ schema, modules })
    await seedTwoVersions(t)

    const row = await t.query(api.promptVersions.getByVersion, {
      workspace_id: WS,
      agentKey: AGENT,
      version: 1,
    })

    expect(row).not.toBeNull()
    expect(row!.version).toBe(1)
    expect(row!.content).toBe('V1')
  })
})
