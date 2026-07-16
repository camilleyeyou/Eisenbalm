// convex/storyLeads.ts — Phase 46 (SGE-01). Mirrors convex/pitchLog.ts exactly.
// API_CONTRACTS §46.5/§46.6.
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requirePipelineSecret } from './lib/auth'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('story_leads')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .order('asc')
      .collect()
  },
})

export const insert = mutation({
  args: {
    runId: v.string(),
    premise: v.string(),
    datedPeg: v.string(),
    pegSourceUrl: v.string(),
    readerEnergy: v.string(),
    charitableAngle: v.string(),
    category: v.string(),
    confidence: v.string(),
    brandRiskFlag: v.boolean(),
    brandRiskReason: v.optional(v.string()),
    repetitionWarning: v.optional(v.string()),
    recommended: v.boolean(),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { pipelineSecret, ...args }) => {
    requirePipelineSecret(pipelineSecret)

    return await ctx.db.insert('story_leads', {
      ...args,
      timestamp: Date.now(),
    })
  },
})

// Phase 47 (BRF-02, §47.2/§47.4) — additive. Require this lead / Remove — add
// reason both call this after their own FastAPI-side guard (§47.5); the
// status field itself is set here, never at insert time.
export const setStatus = mutation({
  args: {
    leadId: v.id('story_leads'),
    status: v.union(v.literal('active'), v.literal('required'), v.literal('removed')),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { leadId, status, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)

    return await ctx.db.patch(leadId, { status })
  },
})
