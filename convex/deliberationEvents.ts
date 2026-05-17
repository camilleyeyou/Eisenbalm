import { query, mutation } from './_generated/server'
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
    return await ctx.db.insert('deliberationEvents', {
      ...args,
      timestamp: Date.now(),
    })
  },
})
