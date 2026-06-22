/**
 * Phase 23 — AUD-01: Audit log infrastructure.
 *
 * `write` is an `internalMutation` callable from any other Convex mutation
 * that needs to log an operator action. Phase 23 builds the infrastructure;
 * actual emissions (config changes, review decisions, kill-switch flips)
 * land in Phases 24–26 when those actions are implemented.
 *
 * `listForWorkspace` is a public `query` returning audit rows newest-first
 * for the read-only audit viewer in the dashboard Settings or Config page.
 *
 * Table: `audit_log` — already defined in schema.ts (Phase 21 AUTH-04).
 * Indexes used: `by_workspace_timestamp` (compound — for newest-first order).
 */
import { internalMutation, query } from './_generated/server'
import { v } from 'convex/values'

// ── write (internal — called from other mutations) ───────────────────────────

/**
 * Insert one audit log row. Timestamp is injected server-side (Date.now()).
 *
 * `actorId` should be the Clerk userId (ctx.auth.getUserIdentity()?.subject)
 * from the calling mutation's context, or a system identifier like
 * "pipeline" / "cron" for automated actions.
 *
 * `before` and `after` are JSON strings (stringify before passing).
 */
export const write = internalMutation({
  args: {
    workspace_id: v.string(),
    actorId: v.string(),
    action: v.string(),              // e.g. "workspace.seeded", "run.triggered"
    resourceType: v.optional(v.string()),  // "run" | "prompt_version" | "config" | etc.
    resourceId: v.optional(v.string()),
    before: v.optional(v.string()),  // JSON snapshot
    after: v.optional(v.string()),   // JSON snapshot
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('audit_log', { ...args, timestamp: Date.now() })
  },
})

// ── listForWorkspace (public query — dashboard read-only viewer) ─────────────

/**
 * Returns audit rows for a workspace, newest-first.
 * Default limit: 50 rows. Pass a higher limit for pagination (Phase 24+).
 */
export const listForWorkspace = query({
  args: {
    workspace_id: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspace_id, limit }) => {
    return ctx.db
      .query('audit_log')
      .withIndex('by_workspace_timestamp', q => q.eq('workspace_id', workspace_id))
      .order('desc')
      .take(limit ?? 50)
  },
})
