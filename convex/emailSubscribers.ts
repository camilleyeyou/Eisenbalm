/**
 * Phase 20 — Email lifecycle: consent ledger (EMAIL-03).
 *
 * Internal-only functions — NOT exposed to the browser client.
 * Called by:
 *   - Wave 2 flow-engine actions (enqueue step → upsertSubscriber)
 *   - Wave 4 unsubscribe route wrapper (getByToken → patch consentState)
 *
 * Idempotency contract for upsertSubscriber:
 *   - If the email is new: insert with consentState:'subscribed'
 *   - If the email already exists: return existing _id WITHOUT patching
 *     consentState. A prior unsubscribe survives a later order.
 */
import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Look up a subscriber by email address.
 * Returns the full row or null if not found.
 */
export const getByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('emailSubscribers')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first()
  },
})

/**
 * Look up a subscriber by their unsubscribe token.
 * Used by the Wave 4 unsubscribe route to identify which row to update.
 * Returns the full row or null if not found.
 */
export const getByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('emailSubscribers')
      .withIndex('by_token', (q) => q.eq('unsubscribeToken', args.token))
      .first()
  },
})

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Upsert a subscriber record.
 *
 * - If email is absent: insert with consentState:'subscribed' and return new _id.
 * - If email already exists: return existing _id WITHOUT touching consentState.
 *   This preserves a prior unsubscribe across repeated purchases.
 *
 * The caller supplies a pre-generated unsubscribeToken (64-char hex).
 * If the row already exists, the supplied token is ignored (the existing token
 * stays in place so previously-emailed unsubscribe links remain valid).
 */
export const upsertSubscriber = internalMutation({
  args: {
    email: v.string(),
    unsubscribeToken: v.string(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('emailSubscribers')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first()

    if (existing) {
      // Return existing id — do NOT overwrite consentState or token
      return existing._id
    }

    return await ctx.db.insert('emailSubscribers', {
      email: args.email,
      consentState: 'subscribed',
      source: args.source,
      unsubscribeToken: args.unsubscribeToken,
      createdAt: Date.now(),
    })
  },
})
