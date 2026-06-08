/**
 * POST /api/checkout/create-session
 *
 * CMR-02 + CMR-10: creates a Stripe Checkout session for the lip balm SKU,
 * with shipping address collection enabled. Returns { url } pointing at
 * Stripe-hosted Checkout. Browser redirects via `window.location.href = url`.
 *
 * RESEARCH Open Question 1: we lock the current charity slug into
 * session.metadata at click time, NOT at webhook time. This avoids the
 * race where a new issue publishes between click and webhook (which
 * would otherwise credit the wrong charity).
 *
 * Accepts an optional JSON body `{ quantity?: number }`.
 * The route validates it as an integer 1–20 and defaults to 1 on
 * missing/invalid/out-of-range input. Stripe `line_items[0].quantity`
 * is set to the validated value.
 */
import { NextResponse } from 'next/server'
import { groq } from 'next-sanity'
import { getStripeServer } from '@/lib/stripe/server'
import { buildSuccessUrl, buildCancelUrl } from '@/lib/stripe/constants'
import { sanityClient } from '@/lib/sanity/client'

export const runtime = 'nodejs'  // Stripe SDK uses Node crypto, not Edge
export const dynamic = 'force-dynamic'  // never cache the API response

// Inline projection (same pattern as apps/web/app/shop/page.tsx).
// Returns the slug of the latest published issue's charity, or null.
const QUERY_CURRENT_CHARITY_SLUG = groq`
  *[_type == "weeklyIssue" && status == "published"]
  | order(issueNumber desc)[0] {
    "charitySlug": charity->slug.current
  }
`

export async function POST(req: Request) {
  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId) {
    // Stripe Dashboard product wasn't set up (Plan 08-02). Hard config error.
    return NextResponse.json(
      { error: 'Checkout misconfigured (STRIPE_PRICE_ID unset).' },
      { status: 500 },
    )
  }

  // CMR-SHIP-01 + CMR-SHIP-INTL: attach flat-rate shipping rates when configured.
  // US ($3) and International ($12) rates are offered to all buyers; Stripe lets
  // the buyer choose at checkout. When both env ids are unset, shipping_options
  // is omitted and checkout still works (US-only fallback).
  const shippingRateId = process.env.STRIPE_SHIPPING_RATE_ID
  const shippingRateIdIntl = process.env.STRIPE_SHIPPING_RATE_ID_INTL

  // Build the shipping_options array: US first, then INTL. Only include set ids.
  const shippingOptions: { shipping_rate: string }[] = []
  if (shippingRateId) shippingOptions.push({ shipping_rate: shippingRateId })
  if (shippingRateIdIntl) shippingOptions.push({ shipping_rate: shippingRateIdIntl })

  // Parse quantity defensively from optional JSON body.
  // Missing body, non-JSON, NaN, or out-of-range all collapse to a valid 1–20 value.
  let quantity = 1
  try {
    const body = await req.json().catch(() => ({}))
    const q = Number((body as { quantity?: unknown })?.quantity)
    if (Number.isFinite(q)) quantity = Math.min(20, Math.max(1, Math.round(q)))
  } catch { quantity = 1 }

  // Lock charity slug into session metadata at click time (Open Question 1).
  // If Sanity is unreachable, fall through with an empty string — better
  // to complete the checkout than to block on a CMS read.
  let charitySlug = ''
  try {
    const result = await sanityClient.fetch<{ charitySlug: string | null } | null>(
      QUERY_CURRENT_CHARITY_SLUG,
    )
    charitySlug = result?.charitySlug ?? ''
  } catch {
    charitySlug = ''
  }

  let stripe
  try {
    stripe = getStripeServer()
  } catch (err) {
    // getStripeServer throws on missing STRIPE_SECRET_KEY (also Plan 08-02 territory)
    return NextResponse.json(
      { error: 'Checkout misconfigured (Stripe client init failed).' },
      { status: 500 },
    )
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity }],
    shipping_address_collection: {
      // CMR-10 + CMR-SHIP-INTL: US + Canada + UK + EU core countries.
      // Both US ($3) and International ($12) rates are offered to all buyers.
      allowed_countries: ['US', 'CA', 'GB', 'DE', 'FR', 'IE', 'NL', 'ES', 'IT'],
    },
    phone_number_collection: { enabled: true },
    automatic_tax: { enabled: false },  // OFF until Andrew configures Stripe Tax
    ...(shippingOptions.length > 0 ? { shipping_options: shippingOptions } : {}),
    success_url: buildSuccessUrl(),
    cancel_url: buildCancelUrl(),
    metadata: {
      source: 'eisenbalm-dispatch',
      charitySlug,  // Open Question 1 lock; empty string if Sanity unavailable
    },
  })

  if (!session.url) {
    // Defensive: Stripe should always return a url for hosted Checkout.
    return NextResponse.json({ error: 'No checkout URL returned.' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
