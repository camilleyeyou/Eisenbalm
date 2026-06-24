import { query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('deliberationEvents')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .order('asc')
      .collect()
  },
})

export const byRunIdAndType = query({
  args: {
    runId: v.string(),
    eventType: v.string(),
  },
  handler: async (ctx, { runId, eventType }) => {
    return await ctx.db
      .query('deliberationEvents')
      .withIndex('by_runId_and_type', q =>
        q.eq('runId', runId).eq('eventType', eventType as any)
      )
      .order('asc')
      .collect()
  },
})

export const insert = mutation({
  args: {
    runId: v.string(),
    agentId: v.string(),
    eventType: v.union(
      v.literal('scout-finding'),
      v.literal('advocate-argument'),
      v.literal('editor-decision'),
      v.literal('section-draft'),
      v.literal('qa-correction'),
      v.literal('editor-final'),
      v.literal('publisher-deploy'),
      v.literal('cost-warning'),                // Phase 5 D-08
      v.literal('agent-tool-limit-exceeded'),   // Phase 5 D-21
    ),
    payload: v.string(),
    charityId: v.optional(v.string()),
    sectionName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('deliberationEvents', {
      ...args,
      timestamp: Date.now(),
    })

    // ── Phase 27 NTF-02 seam (§27.5): budget alert off the FROZEN cost-warning ──
    // eventType. The deliberationEvents.eventType union stays FROZEN (D-04) —
    // reuse 'cost-warning', add no literals. Maps to dispatch eventType 'budget'.
    // Fired via scheduler.runAfter(0, …) so dispatch is non-blocking (D-05).
    if (args.eventType === 'cost-warning') {
      await ctx.scheduler.runAfter(0, internal.notificationActions.sendNotification, {
        runId: args.runId,
        eventType: 'budget',
      })
    }

    return id
  },
})
