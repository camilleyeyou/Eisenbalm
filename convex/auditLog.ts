/**
 * Phase 23 — AUD-01: Audit log infrastructure.
 *
 * `write` is an `internalMutation` callable from any other Convex mutation
 * that needs to log an operator action. Phase 23 builds the infrastructure;
 * actual emissions (config changes, review decisions, kill-switch flips)
 * land in Phases 24–26 when those actions are implemented.
 *
 * `record` is a public `mutation` for callers outside Convex (e.g. the
 * FastAPI pipeline) that need to emit an audit row directly via the HTTP API.
 * It has the same args as `write` and delegates to the same db.insert.
 * Added in Phase 25 (RUN-01/RUN-02) so /pipeline/run and /pipeline/tick
 * can emit operator-attributed audit rows without going through an internal
 * mutation chain.
 *
 * `listForWorkspace` is a public `query` returning audit rows newest-first
 * for the read-only audit viewer in the dashboard Settings or Config page.
 *
 * Table: `audit_log` — already defined in schema.ts (Phase 21 AUTH-04).
 * Indexes used: `by_workspace_timestamp` (compound — for newest-first order).
 */
import { internalMutation, mutation, query } from './_generated/server'
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

// ── record (public mutation — called from FastAPI pipeline, Phase 25) ───────

/**
 * Public mutation version of `write`. Called by the FastAPI pipeline via the
 * Convex HTTP API when /pipeline/run or /pipeline/tick fires, to emit an
 * operator-attributed or cron-attributed audit row without going through an
 * internal mutation chain.
 *
 * Args are identical to `write`. Timestamp is injected server-side.
 */
export const record = mutation({
  args: {
    workspace_id: v.string(),
    actorId: v.string(),
    action: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    before: v.optional(v.string()),
    after: v.optional(v.string()),
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
