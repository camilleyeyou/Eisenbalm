// convex/briefs.ts — Phase 47 (BRF-05). Mirrors convex/pitchLog.ts / storyLeads.ts
// idioms, but single-row-per-run + patch-based (NOT append-per-edit) — see
// docs/API_CONTRACTS.md §47.1/§47.4.
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requirePipelineSecret } from './lib/auth'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('briefs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
  },
})

// Upsert-safe: generation inside editor_gate_1 (§47.3) may re-run after a
// restarted run re-resolves Gate 1 — patch the existing row instead of
// inserting a duplicate, so briefs:byRunId always resolves to ONE row.
export const insert = mutation({
  args: {
    runId: v.string(),
    premise: v.string(),
    currentPeg: v.string(),
    centralClaim: v.string(),
    readerEffect: v.string(),
    knownRisks: v.string(),
    voiceIntention: v.string(),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { pipelineSecret, ...args }) => {
    requirePipelineSecret(pipelineSecret)

    const existing = await ctx.db
      .query('briefs')
      .withIndex('by_runId', q => q.eq('runId', args.runId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() })
      return existing._id
    }
    return await ctx.db.insert('briefs', { ...args, updatedAt: Date.now() })
  },
})

// Single-field edit — the console's BriefFieldTable (BRF-05) and the
// strengthen/apply endpoint (BRF-06) both route through this.
export const patch = mutation({
  args: {
    runId: v.string(),
    field: v.union(
      v.literal('premise'),
      v.literal('currentPeg'),
      v.literal('centralClaim'),
      v.literal('readerEffect'),
      v.literal('knownRisks'),
      v.literal('voiceIntention'),
    ),
    value: v.string(),
    // Phase 29 D-1: pipeline-lane secret. Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { runId, field, value, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)

    const existing = await ctx.db
      .query('briefs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
    if (!existing) {
      throw new Error(`No briefs row for runId=${runId}`)
    }
    return await ctx.db.patch(existing._id, { [field]: value, updatedAt: Date.now() })
  },
})
