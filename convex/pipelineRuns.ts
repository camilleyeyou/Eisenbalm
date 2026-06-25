import { query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('pipelineRuns')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
  },
})

export const create = mutation({
  args: {
    runId: v.string(),
    issueNumber: v.number(),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('pipelineRuns', {
      ...args,
      status: 'running' as const,
    })
  },
})

export const updateStatus = mutation({
  args: {
    runId: v.string(),
    status: v.union(
      v.literal('running'),
      v.literal('awaiting-review'),
      v.literal('complete'),
      v.literal('failed'),
    ),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    // ── Phase 4 additions (CONTEXT D-22, D-23, D-39) ────────────────────
    durationMs: v.optional(v.number()),
    cost: v.optional(v.string()),
    awaitingHumanAt: v.optional(v.number()), // PIP-10: Unix ms when Editor gate 1 interrupted for Andrew review
    // ── Phase 26 addition (API_CONTRACTS §26.4) ──────────────────────────
    sanityIssueId: v.optional(v.string()), // Sanity weeklyIssue _id — written by publisher so publish endpoint can resolve Sanity issue from runId
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query('pipelineRuns')
      .withIndex('by_runId', q => q.eq('runId', args.runId))
      .first()
    if (!run) throw new Error(`Run not found: ${args.runId}`)
    const { runId, ...updates } = args
    await ctx.db.patch(run._id, updates)

    // ── Mirror status into the dashboard runs row (schema.ts line 246:
    // "mirrors pipelineRuns.status; updated alongside it"). Null-guard: skip
    // silently if the runs row doesn't exist (legacy/test runIds) — the
    // pipelineRuns patch above must always succeed regardless. ──────────────
    const dashboardRun = await ctx.db
      .query('runs')
      .withIndex('by_runId', q => q.eq('runId', args.runId))
      .first()
    if (dashboardRun) {
      await ctx.db.patch(dashboardRun._id, {
        status: args.status,
        ...(args.completedAt !== undefined ? { completedAt: args.completedAt } : {}),
      })
    }

    // ── Phase 27 NTF-01 seam (§27.5): non-blocking operational notification ──
    // Dispatch ONLY for the three notifiable statuses (never 'running'). Fired
    // via scheduler.runAfter(0, …) so a transport failure never wedges the
    // status write (D-05). All transport is Convex-side (D-01).
    if (
      args.status === 'complete' ||
      args.status === 'failed' ||
      args.status === 'awaiting-review'
    ) {
      await ctx.scheduler.runAfter(0, internal.notificationActions.sendNotification, {
        runId: args.runId,
        eventType: args.status,
      })
    }
  },
})
