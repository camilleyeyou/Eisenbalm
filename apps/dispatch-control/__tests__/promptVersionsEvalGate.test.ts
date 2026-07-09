/**
 * Phase 38 — Plan 38-04 (§38.3): promptVersions.activate eval-gate + override.
 * Runs in edge-runtime environment (required by convex-test).
 *
 * Extends the existing D-02 in-progress-run guard on `activate` with an
 * eval-gate that reads `eval_scores` (Plan 38-01):
 *   - freshness-guarded: the target version needs a fresh eval_scores row
 *     (ranAt >= target.createdAt) or the gate blocks
 *   - no-regression: any paired scenario regressing beyond
 *     EVAL_REGRESSION_TOLERANCE (0.5, 0-10 scale) blocks
 *   - aggregate: a lower average overall across paired scenarios blocks
 *   - first-ever activation (no currently-active version) always passes
 *   - an `override: { reason }` arg bypasses the eval-gate ONLY — never the
 *     in-progress-run guard — and writes BOTH an `activate_override` audit row
 *     AND the normal `activated` audit row
 *
 * RED until Task 1 lands the gate + override in convex/promptVersions.ts.
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'
const AGENT = 'scout'

const FAR_FUTURE = Date.now() + 10_000_000 // guarantees "fresh" regardless of clock jitter

/** Seed v1 (active) + v2 (inactive) prompt_versions rows. */
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

async function seedEvalScore(
  t: ReturnType<typeof convexTest>,
  row: {
    scenarioId: string
    promptVersion: string
    overall: number
    ranAt: number
  },
) {
  await t.run(async (ctx) => {
    await ctx.db.insert('eval_scores', {
      workspace_id: WS,
      agentKey: AGENT,
      scenarioId: row.scenarioId,
      promptVersion: row.promptVersion,
      overall: row.overall,
      axes: JSON.stringify([]),
      costUsd: 0.01,
      ranAt: row.ranAt,
      source: 'commit',
    })
  })
}

describe('promptVersions.activate eval gate + override (Phase 38 §38.3, EVL-03)', () => {
  it('Test 1: blocks on regression beyond tolerance and does NOT flip isActive', async () => {
    const t = convexTest({ schema, modules })
    await seedTwoVersions(t)
    await seedEvalScore(t, {
      scenarioId: 'scout_normal_week',
      promptVersion: '1',
      overall: 8.0,
      ranAt: Date.now(),
    })
    await seedEvalScore(t, {
      scenarioId: 'scout_normal_week',
      promptVersion: '2',
      overall: 6.0, // regression of 2.0 > 0.5 tolerance
      ranAt: FAR_FUTURE,
    })

    const result = await t.withIdentity({ subject: 'user_operator' }).mutation(
      api.promptVersions.activate,
      { workspace_id: WS, agentKey: AGENT, version: 2, actorId: 'user_operator' },
    )

    expect(result.blocked).toBe(true)

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

  it('Test 2: passes when target is up and fresh — flips isActive', async () => {
    const t = convexTest({ schema, modules })
    await seedTwoVersions(t)
    await seedEvalScore(t, {
      scenarioId: 'scout_normal_week',
      promptVersion: '1',
      overall: 8.0,
      ranAt: Date.now(),
    })
    await seedEvalScore(t, {
      scenarioId: 'scout_normal_week',
      promptVersion: '2',
      overall: 8.3, // up, within tolerance
      ranAt: FAR_FUTURE,
    })

    const result = await t.withIdentity({ subject: 'user_operator' }).mutation(
      api.promptVersions.activate,
      { workspace_id: WS, agentKey: AGENT, version: 2, actorId: 'user_operator' },
    )

    expect(result.blocked).toBe(false)

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query('prompt_versions')
        .withIndex('by_workspace_agentKey', (q) =>
          q.eq('workspace_id', WS).eq('agentKey', AGENT),
        )
        .collect(),
    )
    expect(rows.find((r) => r.version === 2)!.isActive).toBe(true)
    expect(rows.find((r) => r.version === 1)!.isActive).toBe(false)
  })

  it('Test 3: blocks on stale/missing freshness for the target version', async () => {
    const t = convexTest({ schema, modules })
    await seedTwoVersions(t)
    await seedEvalScore(t, {
      scenarioId: 'scout_normal_week',
      promptVersion: '1',
      overall: 8.0,
      ranAt: Date.now(),
    })
    // No eval_scores rows at all for v2 — freshness gate must block.

    const result = await t.withIdentity({ subject: 'user_operator' }).mutation(
      api.promptVersions.activate,
      { workspace_id: WS, agentKey: AGENT, version: 2, actorId: 'user_operator' },
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toMatch(/fresh/i)

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query('prompt_versions')
        .withIndex('by_workspace_agentKey', (q) =>
          q.eq('workspace_id', WS).eq('agentKey', AGENT),
        )
        .collect(),
    )
    expect(rows.find((r) => r.version === 2)!.isActive).toBe(false)
  })

  it('Test 4: override bypasses a red gate, flips isActive, and writes BOTH audit rows', async () => {
    const t = convexTest({ schema, modules })
    await seedTwoVersions(t)
    await seedEvalScore(t, {
      scenarioId: 'scout_normal_week',
      promptVersion: '1',
      overall: 8.0,
      ranAt: Date.now(),
    })
    await seedEvalScore(t, {
      scenarioId: 'scout_normal_week',
      promptVersion: '2',
      overall: 6.0, // regression — red gate
      ranAt: FAR_FUTURE,
    })

    const result = await t.withIdentity({ subject: 'user_operator' }).mutation(
      api.promptVersions.activate,
      {
        workspace_id: WS,
        agentKey: AGENT,
        version: 2,
        actorId: 'user_operator',
        override: { reason: 'urgent voice fix' },
      },
    )

    expect(result.blocked).toBe(false)
    expect(result.overridden).toBe(true)

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query('prompt_versions')
        .withIndex('by_workspace_agentKey', (q) =>
          q.eq('workspace_id', WS).eq('agentKey', AGENT),
        )
        .collect(),
    )
    expect(rows.find((r) => r.version === 2)!.isActive).toBe(true)

    const audit = await t.run(async (ctx) =>
      ctx.db
        .query('audit_log')
        .withIndex('by_workspace', (q) => q.eq('workspace_id', WS))
        .collect(),
    )
    const overrideRow = audit.find((r) => r.action === 'prompt_version.activate_override')
    expect(overrideRow).toBeDefined()
    expect(overrideRow!.after).toContain('urgent voice fix')
    expect(audit.some((r) => r.action === 'prompt_version.activated')).toBe(true)
  })

  it('Test 5: the in-progress-run guard wins EVEN WITH an override supplied', async () => {
    const t = convexTest({ schema, modules })
    await seedTwoVersions(t)

    await t.run(async (ctx) => {
      await ctx.db.insert('runs', {
        workspace_id: WS,
        runId: 'run-inflight-eval-gate',
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
        override: { reason: 'urgent voice fix' },
      },
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toMatch(/in progress/i)

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query('prompt_versions')
        .withIndex('by_workspace_agentKey', (q) =>
          q.eq('workspace_id', WS).eq('agentKey', AGENT),
        )
        .collect(),
    )
    expect(rows.find((r) => r.version === 2)!.isActive).toBe(false)
  })

  it('Test 6: first-ever activation passes with no active version and no eval_scores', async () => {
    const t = convexTest({ schema, modules })

    await t.run(async (ctx) => {
      await ctx.db.insert('prompt_versions', {
        workspace_id: WS,
        agentKey: AGENT,
        version: 1,
        content: 'V1',
        isActive: false,
        createdAt: Date.now(),
      })
    })

    const result = await t.withIdentity({ subject: 'user_operator' }).mutation(
      api.promptVersions.activate,
      { workspace_id: WS, agentKey: AGENT, version: 1, actorId: 'user_operator' },
    )

    expect(result.blocked).toBe(false)

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query('prompt_versions')
        .withIndex('by_workspace_agentKey', (q) =>
          q.eq('workspace_id', WS).eq('agentKey', AGENT),
        )
        .collect(),
    )
    expect(rows.find((r) => r.version === 1)!.isActive).toBe(true)
  })
})
