/**
 * Phase 20 — Email lifecycle: idempotent send ledger (EMAIL-02).
 *
 * Internal-only functions — NOT exposed to the browser client.
 * Called by:
 *   - Wave 2 flow-engine actions (insertScheduled, markSent, markFailed, markSkipped)
 *   - Wave 4 unsubscribe wrapper (getByOrderStep to find scheduledFnId for cancellation)
 *
 * Idempotency key: (orderId, step) — one row per order+step pair.
 * The by_orderId_step index makes these lookups O(1).
 *
 * Analogous to stripeEvents.claim (atomic check-and-insert), but keyed on
 * (orderId, step) instead of Stripe eventId.
 */
import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Look up an emailSends row by (orderId, step).
 * Returns the full row or null if not found.
 * Used by the flow engine to check idempotency before scheduling a step.
 */
export const getByOrderStep = internalQuery({
  args: {
    orderId: v.id('stripeOrders'),
    step: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('emailSends')
      .withIndex('by_orderId_step', (q) =>
        q.eq('orderId', args.orderId).eq('step', args.step),
      )
      .first()
  },
})

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Insert a new row in the 'scheduled' state.
 * Called by the flow engine when a Convex scheduled function is enqueued.
 * The scheduledFnId is stored so the unsubscribe path can call
 * ctx.scheduler.cancel(scheduledFnId) on pending steps.
 * Returns the new document _id.
 */
export const insertScheduled = internalMutation({
  args: {
    orderId: v.id('stripeOrders'),
    email: v.string(),
    step: v.number(),
    scheduledFnId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('emailSends', {
      orderId: args.orderId,
      email: args.email,
      step: args.step,
      scheduledFnId: args.scheduledFnId,
      status: 'scheduled',
      createdAt: Date.now(),
    })
  },
})

/**
 * Mark a step as sent after successful provider delivery.
 * Finds the row by (orderId, step) and patches status + providerMessageId + sentAt.
 *
 * Defensive edge case: if no row exists (e.g. sweep rescued an orphaned send),
 * inserts a new row with status:'sent' so the ledger stays consistent.
 */
export const markSent = internalMutation({
  args: {
    orderId: v.id('stripeOrders'),
    step: v.number(),
    providerMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('emailSends')
      .withIndex('by_orderId_step', (q) =>
        q.eq('orderId', args.orderId).eq('step', args.step),
      )
      .first()

    if (row) {
      await ctx.db.patch(row._id, {
        status: 'sent',
        providerMessageId: args.providerMessageId,
        sentAt: Date.now(),
      })
    } else {
      // Defensive insert — sweep edge case where no scheduled row was written
      await ctx.db.insert('emailSends', {
        orderId: args.orderId,
        email: '',
        step: args.step,
        status: 'sent',
        providerMessageId: args.providerMessageId,
        sentAt: Date.now(),
        createdAt: Date.now(),
      })
    }
  },
})

/**
 * Mark a step as failed after a provider error.
 * Finds the row by (orderId, step) and patches status + failedAt + errorMessage.
 */
export const markFailed = internalMutation({
  args: {
    orderId: v.id('stripeOrders'),
    step: v.number(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('emailSends')
      .withIndex('by_orderId_step', (q) =>
        q.eq('orderId', args.orderId).eq('step', args.step),
      )
      .first()

    if (row) {
      await ctx.db.patch(row._id, {
        status: 'failed',
        failedAt: Date.now(),
        errorMessage: args.errorMessage,
      })
    }
  },
})

/**
 * Insert a skipped row when customerEmail is absent at enqueue time (EMAIL-09).
 * Inserts directly with status:'skipped' — no scheduled function is created.
 * Returns the new document _id.
 */
export const markSkipped = internalMutation({
  args: {
    orderId: v.id('stripeOrders'),
    email: v.string(),
    step: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('emailSends', {
      orderId: args.orderId,
      email: args.email,
      step: args.step,
      status: 'skipped',
      createdAt: Date.now(),
    })
  },
})
