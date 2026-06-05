/**
 * Phase 8 — Open Question 2: minimal order audit table.
 *
 * Behind STRIPE_RECORD_ORDERS env flag in the webhook handler
 * (Plan 08-05). This mutation is unconditional from Convex's
 * perspective — the gating happens in the webhook handler.
 *
 * Best-effort writes: the webhook handler wraps this call in
 * try/catch and returns 200 to Stripe even if this fails, because
 * stripeEvents.claim has already succeeded and we do not want
 * Stripe to retry the event (which would also dedup at claim).
 *
 * Phase 20: After inserting, fire-and-forget enqueueEmailFlow.
 * An enqueue failure MUST NOT fail the order write — wrapped in try/catch.
 * Public return type is PRESERVED as null (API_CONTRACTS §6).
 */
import { mutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

export const insert = mutation({
  args: {
    sessionId: v.string(),
    eventId: v.string(),
    amountTotal: v.number(),
    currency: v.string(),
    customerEmail: v.optional(v.string()),
    charitySlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orderId = await ctx.db.insert('stripeOrders', {
      sessionId: args.sessionId,
      eventId: args.eventId,
      amountTotal: args.amountTotal,
      currency: args.currency,
      customerEmail: args.customerEmail,
      charitySlug: args.charitySlug,
      createdAt: Date.now(),
    })
    try {
      await ctx.scheduler.runAfter(0, internal.emailFlow.enqueueEmailFlow, {
        orderId,
      })
    } catch (err) {
      console.error(
        '[emailFlow] enqueue scheduling failed; order recorded:',
        err,
      )
    }
    return null // PRESERVED — public return shape unchanged (API_CONTRACTS §6)
  },
})
