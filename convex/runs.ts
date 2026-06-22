/**
 * Phase 22 — CFG-02: dashboard `runs` table writes (Phase-21 superset of the
 * frozen pipelineRuns table — do NOT touch pipelineRuns here).
 *
 * `create` inserts a schema-complete `runs` row before graph invoke. The
 * Phase-21 schema requires workspace_id, runId, triggerSource, status, and
 * startedAt (all non-optional); `status` and `startedAt` are set server-side
 * IN THE HANDLER (mirroring pipelineRuns.create, which hardcodes
 * `status: 'running' as const`) — the Python caller does NOT pass them.
 *
 * `setConfigSnapshot` patches the per-run config snapshot (Plan 05) for
 * reproducibility, locating the row by `by_runId` and throwing
 * `Run not found: ${runId}` on a miss (mirrors pipelineRuns.updateStatus).
 *
 * The `runs` table already has a `by_runId` index (schema.ts) — used for both
 * the create-guard and the setConfigSnapshot lookup.
 */
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const create = mutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    triggerSource: v.string(),       // "manual" | "cron" | "webhook"
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, runId, triggerSource, triggeredBy }) => {
    // Idempotent guard: same runId as pipelineRuns.create (join key). If a runs
    // row already exists for this runId, no-op rather than insert a duplicate.
    const existing = await ctx.db
      .query('runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
    if (existing) return existing._id

    return await ctx.db.insert('runs', {
      workspace_id,
      runId,
      triggerSource,
      triggeredBy,
      status: 'running', // server-side default — NOT an arg (mirrors pipelineRuns.create)
      startedAt: Date.now(), // server-side — NOT an arg; Python caller does not pass it
    })
  },
})

export const setConfigSnapshot = mutation({
  args: {
    runId: v.string(),
    configSnapshot: v.string(), // JSON
  },
  handler: async (ctx, { runId, configSnapshot }) => {
    const run = await ctx.db
      .query('runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
    if (!run) throw new Error(`Run not found: ${runId}`)
    await ctx.db.patch(run._id, { configSnapshot })
  },
})

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
  },
})
