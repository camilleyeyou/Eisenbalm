/**
 * Phase 22 — CFG-02/CFG-04: Per-agent config surface.
 *
 * `upsert` is the idempotent seed/write mutation Plan 04 (byte-verification)
 * and the Phase 23 dashboard call to set a single agent's model/sampling.
 * `listForWorkspace` is the read the config loader (Plan 03) calls once at
 * run start to pull every agent's settings in one round-trip.
 *
 * Idempotency mirrors the project's deterministic-upsert convention
 * (workspace.ts seedEisenbalm, users.ts upsertCurrentUser): guard via the
 * `by_workspace_agentKey` index, then patch existing else insert.
 */
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requireOperator } from './lib/auth'

export const upsert = mutation({
  args: {
    workspace_id: v.string(),
    agentKey: v.string(),
    enabled: v.boolean(),
    model: v.optional(v.string()),
    temperature: v.optional(v.number()),
    top_p: v.optional(v.number()),
    max_tokens: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Phase 29 D-1: dashboard-only mutation — Clerk identity required.
    await requireOperator(ctx)

    const { workspace_id, agentKey } = args

    const existing = await ctx.db
      .query('agents')
      .withIndex('by_workspace_agentKey', q =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey),
      )
      .unique()

    if (existing) {
      // Idempotent re-run — patch the same row, never insert a duplicate.
      await ctx.db.patch(existing._id, args)
      return existing._id
    }

    return await ctx.db.insert('agents', args)
  },
})

export const listForWorkspace = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    return await ctx.db
      .query('agents')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()
  },
})
