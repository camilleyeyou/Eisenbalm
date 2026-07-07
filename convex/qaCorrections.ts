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
    blockIndexHint: v.optional(v.number()),   // Phase 32 D-11: resolver hint, never authoritative
    // Phase 29 D-1: NOT an auth guard. `insert` is an INTENTIONAL public
    // exception (GAM-05) — apps/web/components/issue/GameSlot.tsx (a
    // 'use client' component on every issue page, no Clerk installed) calls
    // this anonymously whenever the game validator rejects an agent's
    // embedCode, so Andrew is notified via the dashboard's claims/QA views.
    // This field exists ONLY so the pipeline's centrally-injected
    // `pipelineSecret` arg (convex_client.py::convex_mutation) passes
    // validation on the pipeline's OWN calls (agents/qa, agents/design) — it
    // is intentionally ignored in the handler below. Do NOT gate this
    // handler behind an identity or secret check of any kind.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { pipelineSecret: _pipelineSecret, ...args }) => {
    // Defensive length cap (Phase 29 D-1 hardening — the only feasible
    // tightening for a deliberately-public write): blunt a trivial
    // spam/DoS vector since anyone can POST arbitrary strings at zero cost.
    const MAX_LEN = 2000
    return await ctx.db.insert('qaCorrections', {
      ...args,
      reason: args.reason.slice(0, MAX_LEN),
      sectionName: args.sectionName.slice(0, MAX_LEN),
      timestamp: Date.now(),
    })
  },
})
