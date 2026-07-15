/**
 * Phase 21 — AUTH-04: Just-in-time user provisioning.
 *
 * On first authenticated load in dispatch-control, the app calls this mutation
 * to upsert a users row keyed by the Clerk user ID (subject claim).
 *
 * Usage from dispatch-control (after sign-in):
 *   const upsert = useMutation(api.users.upsertCurrentUser)
 *   await upsert({ email: user.primaryEmailAddress, displayName: user.fullName })
 *
 * Phase 43 — TSK-06/D-12 (docs/API_CONTRACTS.md §43.4): `byClerkUserId` is
 * the FIRST read query on `users`. The `DecisionLog` component resolves each
 * decision row's stored `actorId` (a Clerk sub, unchanged/never rewritten) to
 * a display name at render time via this query — `displayName ?? email`.
 */
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// DEFAULT_WORKSPACE_ID: the only allowed control-plane occurrence of the
// workspace slug (D-16). Phase 28 multi-tenancy will replace this with
// a per-session lookup (e.g. from Clerk org slug or session claim).
const DEFAULT_WORKSPACE_ID = 'eisenbalm'

export const upsertCurrentUser = mutation({
  args: {
    email: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const clerkUserId = identity.subject  // Clerk "sub" claim — primary lookup key

    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerkUserId', q => q.eq('clerkUserId', clerkUserId))
      .first()

    if (existing) {
      // Repeat call — update lastSeenAt only; do NOT insert a duplicate row
      await ctx.db.patch(existing._id, { lastSeenAt: Date.now() })
      return existing._id
    }

    // First call for this Clerk user — provision the users row
    return await ctx.db.insert('users', {
      workspace_id: DEFAULT_WORKSPACE_ID,
      clerkUserId,
      email: args.email,
      displayName: args.displayName,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    })
  },
})

// ── byClerkUserId (public query — actor-name resolution, Phase 43 D-12) ─────

/**
 * Resolves a Clerk `sub` to its `users` row, or `null` when no row exists
 * (e.g. a system/agent actorId like "pipeline", "cron", or an agent key —
 * those resolve via a small static display-name map local to the
 * `DecisionLog` component instead, per §43.4).
 */
export const byClerkUserId = query({
  args: {
    workspace_id: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, { workspace_id, clerkUserId }) => {
    const row = await ctx.db
      .query('users')
      .withIndex('by_clerkUserId', q => q.eq('clerkUserId', clerkUserId))
      .first()

    if (!row || row.workspace_id !== workspace_id) return null
    return row
  },
})
