"use node"
/**
 * Phase 27 — RCN-01 / D-08: Stripe fee fetch (Node-runtime internalAction).
 *
 * Per docs/API_CONTRACTS.md §27.2. Lives in its own `"use node"` module because
 * Convex only allows actions in a Node-runtime file (queries/mutations for the
 * finance surface are in `convex/finance.ts`). Only an `internalAction` may make
 * the external Stripe HTTP call.
 *
 * Fees are fetched via the sessionId path (stripeOrders has no paymentIntentId
 * field) and cached additively to stripeOrders.stripeFee, written once per order
 * by `internal.finance.cacheFee`. Subsequent reads skip the Stripe API.
 *
 * STRIPE_SECRET_KEY must be present in the Convex deployment environment (the
 * apps/web Next.js env is separate). Without it the fetch fails silently and the
 * finance UI shows "—" for that order's fee.
 */
import Stripe from 'stripe'
import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

const STRIPE_API_VERSION = '2025-04-30.basil'

/**
 * Fetch the Stripe fee for one order via the sessionId path and cache it once.
 *
 * Reads the order's sessionId via `internal.finance.getOrderForFee`, retrieves
 * the Checkout Session with `payment_intent.latest_charge.balance_transaction`
 * expanded, extracts `balance_transaction.fee` (cents, default 0), and persists
 * it via `internal.finance.cacheFee`. Skips if already cached. On any Stripe
 * failure we log and leave stripeFee unset.
 */
export const fetchFeeForOrder = internalAction({
  args: { orderId: v.id('stripeOrders') },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.runQuery(internal.finance.getOrderForFee, { orderId })
    if (!order) return
    if (order.stripeFee !== undefined && order.stripeFee !== null) return // already cached

    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) {
      console.error('[financeActions.fetchFeeForOrder] STRIPE_SECRET_KEY not set; skipping')
      return
    }

    try {
      const stripe = new Stripe(secret, {
        apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
      })
      const session = await stripe.checkout.sessions.retrieve(order.sessionId, {
        expand: ['payment_intent.latest_charge.balance_transaction'],
      })
      const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null
      const charge = paymentIntent?.latest_charge as Stripe.Charge | null
      const balanceTransaction =
        charge?.balance_transaction as Stripe.BalanceTransaction | null
      const fee = balanceTransaction?.fee ?? 0 // cents

      await ctx.runMutation(internal.finance.cacheFee, { orderId, fee })
    } catch (err) {
      console.error('[financeActions.fetchFeeForOrder] Stripe fee fetch failed:', err)
      // leave stripeFee unset — UI shows "—"
    }
  },
})
