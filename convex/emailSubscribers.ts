/**
 * Phase 20 — Email lifecycle: consent ledger (EMAIL-03).
 *
 * Internal-only functions — NOT exposed to the browser client.
 * Called by:
 *   - Wave 2 flow-engine actions (enqueue step → upsertSubscriber)
 *   - Wave 4 unsubscribe route wrapper (unsubscribeByTokenPublic → unsubscribeByToken)
 *
 * Idempotency contract for upsertSubscriber:
 *   - If the email is new: insert with consentState:'subscribed'
 *   - If the email already exists: return existing _id WITHOUT patching
 *     consentState. A prior unsubscribe survives a later order.
 *
 * Unsubscribe contract (Plan 20-05 — EMAIL-10):
 *   - unsubscribeByToken: sets consentState='unsubscribed', cancels all pending
 *     SCHEDULED marketing steps (4-8) via ctx.scheduler.cancel; transactional (1-3) untouched.
 *   - unsubscribeByTokenPublic: public wrapper called by the Next.js route handler.
 */
import { internalMutation, internalQuery, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { shouldCancelOnUnsubscribe } from '@eisenbalm/emails'

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

/**
 * Unsubscribe a subscriber by their unsubscribe token.
 *
 * 1. Look up the subscriber by token. If not found, return { ok: false }.
 * 2. Patch consentState → 'unsubscribed' and set unsubscribedAt.
 * 3. Query all emailSends rows for this subscriber's email.
 * 4. For each row where shouldCancelOnUnsubscribe is true:
 *    - Cancel the Convex scheduled function via ctx.scheduler.cancel.
 *    - Patch the row status to 'cancelled'.
 *
 * Transactional steps (1-3) are NEVER touched.
 * Already-sent, failed, cancelled, or skipped rows are skipped by the helper.
 */
export const unsubscribeByToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sub = await ctx.db
      .query('emailSubscribers')
      .withIndex('by_token', (q) => q.eq('unsubscribeToken', token))
      .first()

    if (!sub) return { ok: false }

    // Flip consent state
    await ctx.db.patch(sub._id, {
      consentState: 'unsubscribed',
      unsubscribedAt: Date.now(),
    })

    // Cancel all pending scheduled marketing steps
    const rows = await ctx.db
      .query('emailSends')
      .withIndex('by_email_step', (q) => q.eq('email', sub.email))
      .collect()

    for (const row of rows) {
      if (shouldCancelOnUnsubscribe(row)) {
        // Cancel the scheduled Convex function if one was recorded
        if (row.scheduledFnId) {
          await ctx.scheduler.cancel(row.scheduledFnId as any)
        }
        // Mark the row as cancelled so the sweep doesn't retry it
        await ctx.db.patch(row._id, { status: 'cancelled' })
      }
    }

    return { ok: true }
  },
})

/**
 * Public mutation wrapper for the Next.js /api/email/unsubscribe route.
 *
 * The internal unsubscribeByToken cannot be called from the browser client directly,
 * so this public mutation delegates to it via ctx.runMutation.
 *
 * EMAIL-10 compliance: called by GET and POST /api/email/unsubscribe?token=...
 */
export const unsubscribeByTokenPublic = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<{ ok: boolean }> => {
    return ctx.runMutation(internal.emailSubscribers.unsubscribeByToken, { token })
  },
})
