import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('qaCorrections')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .order('asc')
      .collect()
  },
})

export const insert = mutation({
  args: {
    runId: v.string(),
    sectionName: v.string(),
    fieldName: v.string(),
    original: v.string(),
    corrected: v.string(),
    reason: v.string(),
    severity: v.union(
      v.literal('minor'),
      v.literal('moderate'),
      v.literal('major'),
    ),
    accepted: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('qaCorrections', {
      ...args,
      timestamp: Date.now(),
    })
  },
})
