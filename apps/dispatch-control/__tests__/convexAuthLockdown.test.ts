/**
 * Phase 29 — D-1: Convex auth lockdown coverage.
 * Runs in edge-runtime environment (required by convex-test).
 *
 * Proves all four caller lanes behave as designed:
 *   1. Dashboard-lane (promptVersions.activate) — rejects with no Clerk
 *      identity; succeeds with one.
 *   2. Pipeline-lane (deliberationEvents.insert) — rejects with an absent or
 *      wrong pipelineSecret; succeeds with the correct one.
 *   3. Dual-lane (pipelineConfig.upsert) — succeeds via EITHER a Clerk
 *      identity OR the correct pipeline secret; rejects with neither.
 *   4. Public exception (qaCorrections.insert, GAM-05) — succeeds with no
 *      identity and no secret at all.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires import.meta.glob to resolve Convex modules at test time.
// This glob must be a literal in the calling file (Vite static analysis requirement).
const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'
const TEST_SECRET = 'test-pipeline-secret-260703'

describe('Convex auth lockdown (Phase 29 D-1)', () => {
  const prevSecret = process.env.PIPELINE_CONVEX_SECRET

  beforeEach(() => {
    process.env.PIPELINE_CONVEX_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env.PIPELINE_CONVEX_SECRET = prevSecret
  })

  describe('Lane 1 — dashboard-only (promptVersions.activate)', () => {
    async function seedOneVersion(t: ReturnType<typeof convexTest>) {
      await t.run(async (ctx) => {
        await ctx.db.insert('prompt_versions', {
          workspace_id: WS,
          agentKey: 'scout',
          version: 1,
          content: 'V1',
          isActive: true,
          createdAt: Date.now(),
        })
      })
    }

    it('rejects a call with no Clerk identity', async () => {
      const t = convexTest({ schema, modules })
      await seedOneVersion(t)

      await expect(
        t.mutation(api.promptVersions.activate, {
          workspace_id: WS,
          agentKey: 'scout',
          version: 1,
          actorId: 'user_spoofed',
        }),
      ).rejects.toThrow(/Unauthorized/)
    })

    it('succeeds with a Clerk identity', async () => {
      const t = convexTest({ schema, modules })
      await seedOneVersion(t)

      const result = await t.withIdentity({ subject: 'user_operator' }).mutation(
        api.promptVersions.activate,
        {
          workspace_id: WS,
          agentKey: 'scout',
          version: 1,
          actorId: 'user_operator',
        },
      )

      expect(result.blocked).toBe(false)
    })
  })

  describe('Lane 2 — pipeline-only (deliberationEvents.insert)', () => {
    it('rejects a call with no pipelineSecret', async () => {
      const t = convexTest({ schema, modules })

      await expect(
        t.mutation(api.deliberationEvents.insert, {
          runId: 'run-lockdown-1',
          agentId: 'scout',
          eventType: 'scout-finding',
          payload: '{}',
        }),
      ).rejects.toThrow(/Unauthorized/)
    })

    it('rejects a call with the wrong pipelineSecret', async () => {
      const t = convexTest({ schema, modules })

      await expect(
        t.mutation(api.deliberationEvents.insert, {
          runId: 'run-lockdown-2',
          agentId: 'scout',
          eventType: 'scout-finding',
          payload: '{}',
          pipelineSecret: 'not-the-secret',
        }),
      ).rejects.toThrow(/Unauthorized/)
    })

    it('succeeds with the correct pipelineSecret', async () => {
      const t = convexTest({ schema, modules })

      await t.mutation(api.deliberationEvents.insert, {
        runId: 'run-lockdown-3',
        agentId: 'scout',
        eventType: 'scout-finding',
        payload: '{}',
        pipelineSecret: TEST_SECRET,
      })

      const rows = await t.query(api.deliberationEvents.byRunId, {
        runId: 'run-lockdown-3',
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].eventType).toBe('scout-finding')
    })
  })

  describe('Lane 3 — dual-lane (pipelineConfig.upsert)', () => {
    it('rejects a call with neither identity nor a pipelineSecret', async () => {
      const t = convexTest({ schema, modules })

      await expect(
        t.mutation(api.pipelineConfig.upsert, {
          workspace_id: WS,
          key: 'auto_publish',
          value: JSON.stringify(true),
        }),
      ).rejects.toThrow(/Unauthorized/)
    })

    it('succeeds via a Clerk identity (no pipelineSecret)', async () => {
      const t = convexTest({ schema, modules })

      await t.withIdentity({ subject: 'user_operator' }).mutation(
        api.pipelineConfig.upsert,
        {
          workspace_id: WS,
          key: 'auto_publish',
          value: JSON.stringify(true),
        },
      )

      const rows = await t.query(api.pipelineConfig.getAll, {
        workspace_id: WS,
      })
      expect(rows.some((r) => r.key === 'auto_publish')).toBe(true)
    })

    it('succeeds via the correct pipelineSecret (no identity — e.g. /pipeline/tick)', async () => {
      const t = convexTest({ schema, modules })

      await t.mutation(api.pipelineConfig.upsert, {
        workspace_id: WS,
        key: 'schedule_next_run_at',
        value: JSON.stringify(1234567890),
        pipelineSecret: TEST_SECRET,
      })

      const rows = await t.query(api.pipelineConfig.getAll, {
        workspace_id: WS,
      })
      expect(rows.some((r) => r.key === 'schedule_next_run_at')).toBe(true)
    })
  })

  describe('Lane 4 — public exception (qaCorrections.insert, GAM-05)', () => {
    it('succeeds with NO identity and NO secret', async () => {
      const t = convexTest({ schema, modules })

      await t.mutation(api.qaCorrections.insert, {
        runId: 'run-lockdown-4',
        sectionName: 'game',
        reason: 'Game validator rejected embedCode: missing sandbox attr',
        severity: 'error',
        accepted: false,
        agentId: 'game-validator',
        axis: 'hard-rule',
      })

      const rows = await t.query(api.qaCorrections.byRunId, {
        runId: 'run-lockdown-4',
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].agentId).toBe('game-validator')
    })
  })
})
