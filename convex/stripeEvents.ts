/**
 * Phase 8 — CMR-06 idempotency table mutations.
 *
 * Convex serializes mutations per-table, so the check (withIndex.first)
 * + insert below is atomic: two concurrent webhook retries cannot both
 * see "no existing row" and both insert. The first wins; the second
 * receives { firstTime: false } and the caller (webhook handler) skips
 * fulfillment.
 *
 * Contract:
 *   claim({ eventId, eventType, livemode }) -> { firstTime: boolean }
 *     - firstTime: true  -> caller should process the event
 *     - firstTime: false -> caller should treat as replay and skip
 */
import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { requireWebhookSecret } from './lib/auth'

export const claim = mutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    livemode: v.boolean(),
    // Phase 29 D-1: webhook-lane secret. Required (not optional) — this
    // function has a single caller (apps/web/lib/stripe/handlers.ts) and no
    // Clerk identity is ever available in a server-side Stripe webhook route.
    // Checked against the Convex-side STRIPE_TO_CONVEX_SECRET env var with a
    // constant-time compare; fails closed if unset/blank.
    webhookSecret: v.string(),
  },
  handler: async (ctx, args) => {
    requireWebhookSecret(args.webhookSecret)

    const existing = await ctx.db
      .query('stripeEvents')
      .withIndex('by_eventId', (q) => q.eq('eventId', args.eventId))
      .first()
    if (existing) {
      return { firstTime: false as const }
    }
    await ctx.db.insert('stripeEvents', {
      eventId: args.eventId,
      eventType: args.eventType,
      livemode: args.livemode,
      receivedAt: Date.now(),
    })
    return { firstTime: true as const }
  },
})
