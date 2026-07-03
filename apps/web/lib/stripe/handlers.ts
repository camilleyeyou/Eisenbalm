/**
 * Stripe webhook event handlers.
 *
 * Contract (called by apps/web/app/api/stripe/webhook/route.ts):
 *   handleStripeEvent(event) ->
 *     1. Atomic claim via api.stripeEvents.claim. If !firstTime, return early (replay).
 *     2. Switch on event.type. Currently handles:
 *          - checkout.session.completed: optionally write a stripeOrders audit row
 *          - payment_intent.payment_failed: log only
 *     3. Audit write is best-effort: a Convex error here logs + returns (Pitfall 7).
 *
 * Why best-effort audit: we have already claimed the event via stripeEvents.claim.
 * If we throw, Stripe retries the webhook — which will dedup at claim and skip the
 * audit again. Either we drop one audit row OR we never write it; the second case
 * is worse than the first.
 */
import type Stripe from 'stripe'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not set; webhook cannot reach Convex.')
  }
  return new ConvexHttpClient(url)
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const convex = getConvexClient()

  // Step 1: atomic claim. Re-throw on Convex failure so the caller returns 5xx
  // and Stripe retries (we have NOT yet committed to processing this event).
  const claim = (await convex.mutation(api.stripeEvents.claim, {
    eventId: event.id,
    eventType: event.type,
    livemode: event.livemode,
    // Phase 29 D-1: webhook-lane secret — validated Convex-side against
    // STRIPE_TO_CONVEX_SECRET (constant-time compare). Never NEXT_PUBLIC_*.
    webhookSecret: process.env.STRIPE_TO_CONVEX_SECRET ?? '',
  })) as { firstTime: boolean }

  if (!claim.firstTime) {
    // Replay: log + return success. Stripe will stop retrying on 200.
    // eslint-disable-next-line no-console
    console.log(`[stripe.webhook] replay ignored: ${event.id} (${event.type})`)
    return
  }

  // Step 2: switch on event type. v1 only handles two.
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      await maybeRecordOrder(convex, session, event.id)
      break
    }
    case 'payment_intent.payment_failed': {
      // Stripe already emails the customer. Log for ops visibility.
      // eslint-disable-next-line no-console
      console.log(`[stripe.webhook] payment_failed: ${event.id}`)
      break
    }
    default: {
      // Subscribed events are configured in Dashboard; defensive no-op for
      // unexpected types.
      // eslint-disable-next-line no-console
      console.log(`[stripe.webhook] unhandled event type: ${event.type} (${event.id})`)
      break
    }
  }
}

/**
 * Best-effort write to convex stripeOrders. Errors are logged + swallowed
 * (Pitfall 7). Gated by STRIPE_RECORD_ORDERS env flag (default 'true').
 */
async function maybeRecordOrder(
  convex: ConvexHttpClient,
  session: Stripe.Checkout.Session,
  eventId: string,
): Promise<void> {
  if (process.env.STRIPE_RECORD_ORDERS === 'false') {
    return
  }
  try {
    const amountSubtotal = session.amount_subtotal ?? 0
    const amountShipping = session.total_details?.amount_shipping ?? 0
    const details = session.customer_details
    // Stripe basil moved shipping under collected_information; fall back to legacy field.
    const shipping =
      (session as unknown as {
        collected_information?: { shipping_details?: { address?: Record<string, string | null> } }
        shipping_details?: { address?: Record<string, string | null> }
      }).collected_information?.shipping_details ??
      (session as unknown as { shipping_details?: { address?: Record<string, string | null> } }).shipping_details
    const addr = shipping?.address

    await convex.mutation(api.stripeOrders.insert, {
      sessionId: session.id,
      eventId,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      // Phase 29 D-1: webhook-lane secret — validated Convex-side against
      // STRIPE_TO_CONVEX_SECRET (constant-time compare). Never NEXT_PUBLIC_*.
      webhookSecret: process.env.STRIPE_TO_CONVEX_SECRET ?? '',
      customerEmail: session.customer_details?.email ?? undefined,
      // charitySlug was locked at click time via session.metadata.
      charitySlug:
        session.metadata?.charitySlug && session.metadata.charitySlug.length > 0
          ? session.metadata.charitySlug
          : undefined,
      amountSubtotal,
      amountShipping,
      donationAmount: amountSubtotal,  // donation = product subtotal only (excludes shipping)
      customerName: details?.name ?? undefined,
      phone: details?.phone ?? undefined,
      shippingAddress: addr
        ? {
            line1: addr.line1 ?? undefined,
            line2: addr.line2 ?? undefined,
            city: addr.city ?? undefined,
            state: addr.state ?? undefined,
            postalCode: addr.postal_code ?? undefined,
            country: addr.country ?? undefined,
          }
        : undefined,
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[stripe.webhook] stripeOrders.insert failed for ${eventId}; continuing.`,
      err,
    )
  }
}
