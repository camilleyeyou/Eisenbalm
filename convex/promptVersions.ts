/**
 * Phase 22 — CFG-02: Active prompt store surface.
 *
 * `upsertActive` is the v1 seed/write mutation Plan 04 calls to migrate the 12
 * file-externalized prompts into the DB. Phase 22 seeds v1 ONLY — versioning,
 * diff, and rollback UI are Phase 24. Re-running the seed is idempotent: it
 * patches the existing row's content and leaves `version == 1, isActive == true`
 * (no version increment, no duplicate row).
 *
 * `getActive` is the read the config loader (Plan 03) calls per agent to pull
 * the active prompt content via the `by_workspace_agentKey` index.
 *
 * NOTE: agentKey is the canonical key (e.g. "editor_gate1"), NOT a prompt
 * filename. The seed (Plan 04) is responsible for mapping files → keys.
 */
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const upsertActive = mutation({
  args: {
    workspace_id: v.string(),
    agentKey: v.string(),
    content: v.string(),
    createdBy: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, agentKey, content, createdBy, note }) => {
    const existing = await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace_agentKey', q =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey),
      )
      .first()

    if (existing) {
      // Idempotent v1 seed semantics: refresh content, keep version, stay active.
      // Do NOT increment version — Phase 22 seeds v1 only (versioning is Phase 24).
      await ctx.db.patch(existing._id, {
        content,
        isActive: true,
        ...(createdBy !== undefined ? { createdBy } : {}),
        ...(note !== undefined ? { note } : {}),
      })
      return existing._id
    }

    return await ctx.db.insert('prompt_versions', {
      workspace_id,
      agentKey,
      version: 1,
      content,
      isActive: true,
      createdAt: Date.now(),
      createdBy,
      note,
    })
  },
})

export const getActive = query({
  args: { workspace_id: v.string(), agentKey: v.string() },
  handler: async (ctx, { workspace_id, agentKey }) => {
    return await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace_agentKey', q =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey),
      )
      .filter(q => q.eq(q.field('isActive'), true))
      .first()
  },
})
