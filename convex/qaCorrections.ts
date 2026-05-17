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
    agentId: v.optional(v.string()),
    sectionName: v.string(),
    fieldName: v.optional(v.string()),        // legacy compat (Phase 4 rewrite-shape)
    original: v.optional(v.string()),         // legacy compat
    corrected: v.optional(v.string()),        // legacy compat (D-02 annotation-only)
    reason: v.string(),
    severity: v.union(
      v.literal('info'),
      v.literal('warning'),
      v.literal('error'),
    ),
    accepted: v.boolean(),                    // Phase 5 writes `false`
    axis: v.optional(v.union(
      v.literal('gravity'),
      v.literal('sentiment'),
      v.literal('irony-signaling'),
      v.literal('precision'),
      v.literal('cross-section-consistency'),
      v.literal('hard-rule'),
    )),
    quotedSpan: v.optional(v.string()),
    suggestedFix: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('qaCorrections', {
      ...args,
      timestamp: Date.now(),
    })
  },
})
