import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('pitchLog')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .order('asc')
      .collect()
  },
})

export const insert = mutation({
  args: {
    runId: v.string(),
    charityId: v.optional(v.string()),
    charityName: v.string(),
    charityLocation: v.string(),
    charityWebsite: v.optional(v.string()),
    assetRange: v.optional(v.string()),
    focusArea: v.optional(v.string()),
    scoutSummary: v.string(),
    selected: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('pitchLog', {
      ...args,
      timestamp: Date.now(),
    })
  },
})

export const markSelected = mutation({
  args: {
    runId: v.string(),
    charityName: v.string(),
  },
  handler: async (ctx, { runId, charityName }) => {
    const entries = await ctx.db
      .query('pitchLog')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()
    await Promise.all(
      entries.map(entry =>
        ctx.db.patch(entry._id, { selected: entry.charityName === charityName })
      )
    )
  },
})
