import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requirePipelineSecret } from './lib/auth'

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

// Phase 33 §33.7 (D-12) — the run's selected pitch for the decision rail's
// hook card (charityName + scoutSummary). Public read per existing convention.
export const selectedByRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) =>
    await ctx.db
      .query('pitchLog')
      .withIndex('by_runId_and_selected', q => q.eq('runId', runId).eq('selected', true))
      .first(),
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
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { pipelineSecret, ...args }) => {
    requirePipelineSecret(pipelineSecret)

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
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { runId, charityName, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)

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
