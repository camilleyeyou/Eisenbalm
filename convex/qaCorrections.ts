import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requirePipelineSecret } from './lib/auth'

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

// Phase 33 §33.1 — load a single finding by its Convex _id (public read per
// existing convention; the pipeline findings endpoints use this).
export const byId = query({
  args: { id: v.id('qaCorrections') },
  handler: async (ctx, { id }) => await ctx.db.get(id),
})

/**
 * Phase 33 §33.1 (D-01/D-02) — PIPELINE-LANE resolution flip.
 *
 * Called only by the pipeline findings endpoints (accept/dismiss/reopen);
 * mirrors `claimChecks:insertBatch`'s secret guard — NOT `insert`'s public
 * GAM-05 exception. Registered in `_PIPELINE_SECRET_GUARDED_PATHS`
 * (packages/pipeline/.../lib/convex_client.py) so the pipeline injects the
 * secret centrally.
 *
 * Passing `resolution: undefined` (reopen) clears resolution /
 * resolutionReason / resolvedBy / resolvedAt (Convex `patch` with `undefined`
 * removes optional fields) and sets legacy `accepted: false`.
 */
export const setResolution = mutation({
  args: {
    id: v.id('qaCorrections'),
    resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed'))), // absent = reopen
    resolutionReason: v.optional(v.string()),
    resolvedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { id, resolution, resolutionReason, resolvedBy, resolvedAt, pipelineSecret },
  ) => {
    requirePipelineSecret(pipelineSecret)

    await ctx.db.patch(id, {
      resolution,
      resolutionReason,
      resolvedBy,
      resolvedAt,
      // Legacy sync per D-01: Phase 26 surfaces still read `accepted`.
      accepted: resolution === 'accepted',
    })
  },
})
