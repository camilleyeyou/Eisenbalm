/**
 * Phase 39 — MEM-02: append-only corrections log for the charity registry.
 *
 * `charity_corrections` is APPEND-ONLY: this file exposes exactly `append`
 * (requireOperator-guarded + audit-logged, mirrors promptVersions.saveVersion
 * EXACTLY — not charities.setStatus's no-audit pattern, which is an existing
 * Phase 26 gap out of scope for this phase) and `listByCharityKey` (unguarded
 * read, matches charities.listForDedup's "queries are unguarded" convention).
 *
 * NO update/patch/remove/delete function is ever defined here — a correction
 * that needs fixing is superseded by a NEW correction, never edited in place
 * (D-05, Pitfall 3). A source-scan tripwire test enforces this invariant.
 *
 * `charityKey` is ALWAYS supplied by the caller (already-loaded from a
 * `charities` doc's `dedupKey`) — this mutation never re-derives a dedup key
 * from a raw name/website pair (Pitfall 5).
 *
 * API_CONTRACTS §39.1/§39.2 — signatures match exactly.
 */
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { requireOperator } from './lib/auth'

// ── append ───────────────────────────────────────────────────────────────────

/**
 * Dashboard-only mutation (requireOperator, NOT pipelineSecret-guarded).
 * Inserts one append-only row and emits an audit_log row ("nothing silent").
 */
export const append = mutation({
  args: {
    workspace_id: v.string(),
    charityKey: v.string(),
    sanityCharityId: v.optional(v.string()),
    text: v.string(),
  },
  handler: async (ctx, { workspace_id, charityKey, sanityCharityId, text }) => {
    const actor = await requireOperator(ctx)

    const id = await ctx.db.insert('charity_corrections', {
      workspace_id,
      charityKey,
      sanityCharityId,
      text,
      author: actor,
      createdAt: Date.now(),
    })

    await ctx.runMutation(internal.auditLog.write, {
      workspace_id,
      actorId: actor,
      action: 'charity_correction.added',
      resourceType: 'charity_correction',
      resourceId: charityKey,
      after: JSON.stringify({ text }),
    })

    return id
  },
})

// ── listByCharityKey ─────────────────────────────────────────────────────────

/**
 * Unguarded (read-only) query. Returns the full chronological correction log
 * for one (workspace_id, charityKey) pair, oldest-first (createdAt ascending —
 * the by_workspace_charityKey index returns rows in insertion order; do not
 * reverse). Consumed by the Registry corrections UI and by the Researcher's
 * corrections-injection step (API_CONTRACTS §39.5).
 */
export const listByCharityKey = query({
  args: {
    workspace_id: v.string(),
    charityKey: v.string(),
  },
  handler: async (ctx, { workspace_id, charityKey }) => {
    return await ctx.db
      .query('charity_corrections')
      .withIndex('by_workspace_charityKey', q =>
        q.eq('workspace_id', workspace_id).eq('charityKey', charityKey),
      )
      .collect()
  },
})
