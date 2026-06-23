/**
 * Phase 26 — RVW-03: Review decision trail writer + reader.
 *
 * `review_actions` is the per-run decision trail (what did the operator decide
 * on this run?). `audit_log` is the workspace-level action trail (everything
 * ever done). Both should be written for approve/reject/schedule decisions;
 * `audit_log` alone is sufficient for registry mutations (setStatus).
 *
 * API_CONTRACTS §26.5 — canonical action enum (Pitfall 7):
 *   "approved_and_published"   — operator approved + issue published immediately
 *   "approved_and_scheduled"   — operator approved + scheduled for later publish
 *   "rejected"                 — operator rejected the run
 *   "section_rerolled"         — operator re-rolled a section from review screen
 *   "auto_publish_enabled"     — operator enabled auto_publish
 *   "auto_publish_disabled"    — operator disabled auto_publish
 *   "charity_blocklisted"      — operator blocklisted a charity from the registry
 *   "charity_status_changed"   — operator changed charity status (other changes)
 *
 * API_CONTRACTS §26.6 — all exported function signatures match exactly.
 */
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// ── record ──────────────────────────────────────────────────────────────────

/**
 * Write a review decision row. Timestamp is injected server-side.
 *
 * `actorId` should be the Clerk userId from the dashboard operator.
 * `action` MUST be one of the canonical values in API_CONTRACTS §26.5.
 * `note` is optional free-text (e.g. reject reason, re-roll section name).
 */
export const record = mutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    actorId: v.string(),
    action: v.string(), // Canonical values: see API_CONTRACTS §26.5
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('review_actions', {
      workspace_id: args.workspace_id,
      runId: args.runId,
      actorId: args.actorId,
      action: args.action,
      note: args.note,
      timestamp: Date.now(),
    })
  },
})

// ── listByRunId ─────────────────────────────────────────────────────────────

/**
 * Returns all review_actions for a run, sorted by timestamp descending
 * (newest first — most recent decision at top of the decision trail).
 * Used by the dashboard review screen to show the operator's decision history.
 */
export const listByRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const rows = await ctx.db
      .query('review_actions')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()
    return rows.sort((a, b) => b.timestamp - a.timestamp)
  },
})
