import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requirePipelineSecret } from './lib/auth'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('agentVotes')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .order('asc')
      .collect()
  },
})

export const byRunIdAndCharity = query({
  args: { runId: v.string(), charityId: v.string() },
  handler: async (ctx, { runId, charityId }) => {
    return await ctx.db
      .query('agentVotes')
      .withIndex('by_runId_and_charity', q =>
        q.eq('runId', runId).eq('charityId', charityId)
      )
      .collect()
  },
})

export const insert = mutation({
  args: {
    runId: v.string(),
    agentId: v.string(),
    charityId: v.string(),
    charityName: v.string(),
    vote: v.union(v.literal('for'), v.literal('against'), v.literal('abstain')),
    reasoning: v.string(),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { pipelineSecret, ...args }) => {
    requirePipelineSecret(pipelineSecret)

    return await ctx.db.insert('agentVotes', {
      ...args,
      timestamp: Date.now(),
    })
  },
})
