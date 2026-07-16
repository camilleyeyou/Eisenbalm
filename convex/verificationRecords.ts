// convex/verificationRecords.ts — Phase 46 (SGE-03). Mirrors convex/pitchLog.ts exactly.
// API_CONTRACTS §46.5/§46.6.
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requirePipelineSecret } from './lib/auth'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('verification_records')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .order('asc')
      .collect()
  },
})

export const insert = mutation({
  args: {
    runId: v.string(),
    candidateId: v.string(),
    candidateName: v.string(),
    domainLive: v.boolean(),
    registrationId: v.optional(v.string()),
    registrationVerified: v.boolean(),
    pressHits: v.number(),
    obscurityVerdict: v.string(),
    status: v.union(v.literal('pass'), v.literal('fail'), v.literal('unverified')),
    killed: v.boolean(),
    killReason: v.optional(v.string()),
    checkedAt: v.number(),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { pipelineSecret, ...args }) => {
    requirePipelineSecret(pipelineSecret)

    return await ctx.db.insert('verification_records', {
      ...args,
      timestamp: Date.now(),
    })
  },
})
