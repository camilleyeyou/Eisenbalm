/**
 * Phase 22 — CFG-02/CFG-04: Global pipeline settings surface.
 *
 * `upsert` writes a single JSON-encoded config value keyed by (workspace_id,
 * key); the seed/byte-verification (Plan 04) and the Phase 23 dashboard both
 * call it. `getAll` is the read the config loader (Plan 03) calls once at run
 * start to pull every pipeline_config row in one round-trip.
 *
 * Idempotency mirrors the project's deterministic-upsert convention
 * (workspace.ts seedEisenbalm, users.ts upsertCurrentUser): guard via the
 * `by_workspace_key` index, then patch existing else insert. `updatedAt` is
 * set server-side (Date.now()), matching the project's timestamp convention.
 */
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const upsert = mutation({
  args: {
    workspace_id: v.string(),
    key: v.string(),
    value: v.string(), // JSON-encoded
    updatedBy: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, key, value, updatedBy }) => {
    const existing = await ctx.db
      .query('pipeline_config')
      .withIndex('by_workspace_key', q =>
        q.eq('workspace_id', workspace_id).eq('key', key),
      )
      .unique()

    if (existing) {
      // Idempotent re-run — patch the same row, never insert a duplicate.
      await ctx.db.patch(existing._id, {
        value,
        updatedBy,
        updatedAt: Date.now(),
      })
      return existing._id
    }

    return await ctx.db.insert('pipeline_config', {
      workspace_id,
      key,
      value,
      updatedBy,
      updatedAt: Date.now(),
    })
  },
})

export const getAll = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    return await ctx.db
      .query('pipeline_config')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()
  },
})
