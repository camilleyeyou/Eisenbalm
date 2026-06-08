/**
 * CMR-DONATE-01: Charity donation ledger query.
 *
 * Groups completed orders by charitySlug, summing donationAmount (which equals
 * the product subtotal — shipping excluded) and shippingTotal for informational
 * purposes. Legacy rows that predate amountSubtotal/donationAmount fall back
 * gracefully through the amountTotal chain.
 *
 * Runtime-safe: no Node.js imports. Runs in the Convex isolate.
 */
import { query } from './_generated/server'
import { v } from 'convex/values'

export const charityTotals = query({
  args: { startMs: v.optional(v.number()), endMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let rows
    if (args.startMs !== undefined || args.endMs !== undefined) {
      const start = args.startMs ?? 0
      const end = args.endMs ?? Number.MAX_SAFE_INTEGER
      rows = await ctx.db
        .query('stripeOrders')
        .withIndex('by_createdAt', (q) => q.gte('createdAt', start).lte('createdAt', end))
        .collect()
    } else {
      rows = await ctx.db.query('stripeOrders').collect()
    }
    const groups = new Map<
      string,
      { donationTotal: number; shippingTotal: number; orderCount: number; currency: string }
    >()
    for (const r of rows) {
      const slug = r.charitySlug ?? 'unknown'
      // Legacy rows predate amountSubtotal/donationAmount — fall back down the chain.
      const donation = r.donationAmount ?? r.amountSubtotal ?? r.amountTotal ?? 0
      const shipping = r.amountShipping ?? 0
      const g = groups.get(slug) ?? {
        donationTotal: 0,
        shippingTotal: 0,
        orderCount: 0,
        currency: r.currency ?? 'usd',
      }
      g.donationTotal += donation
      g.shippingTotal += shipping
      g.orderCount += 1
      groups.set(slug, g)
    }
    return Array.from(groups.entries())
      .map(([charitySlug, g]) => ({ charitySlug, ...g }))
      .sort((a, b) => b.donationTotal - a.donationTotal)
  },
})
