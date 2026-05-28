/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook handler. Requirements:
 *   - CMR-04: verify signature against raw body using STRIPE_WEBHOOK_SECRET
 *   - CMR-05: NO env-var bypass — signature is ALWAYS required, in EVERY environment
 *   - CMR-06: idempotency on event.id via Convex stripeEvents.claim (atomic)
 *
 * Sources (verbatim shape lifts):
 *   - stripe-node/examples/webhook-signing/nextjs/app/api/webhooks/route.ts
 *   - https://docs.stripe.com/webhooks/signature
 *   - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 4
 *
 * Locked invariants enforced by apps/web/__tests__/stripe-webhook-source.test.ts:
 *   - export const runtime = 'nodejs'  (Stripe SDK uses Node crypto; edge breaks it)
 *   - await req.text() BEFORE any JSON parse  (JSON re-serialization breaks HMAC)
 *   - stripe.webhooks.constructEvent(...) is always called
 *   - No environment-based shortcuts for signature verification (signature is always verified)
 */
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeServer } from '@/lib/stripe/server'
import { handleStripeEvent } from '@/lib/stripe/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    // Misconfiguration. NOT a bypass — we never process unverified events.
    // Returning 500 (rather than 200) lets Stripe retry, so once the env
    // var is set we recover. Logged to surface the gap loudly.
    // eslint-disable-next-line no-console
    console.error('[stripe.webhook] STRIPE_WEBHOOK_SECRET is not set; rejecting.')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  // Raw body MUST be read via .text() BEFORE any JSON parsing.
  // JSON.parse + JSON.stringify reorders keys / drops whitespace / escapes
  // Unicode differently, which breaks Stripe's HMAC. (Pitfall 2.)
  const rawBody = await req.text()

  let stripe
  try {
    stripe = getStripeServer()
  } catch {
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch {
    // Bad signature. Never log payload (could leak). 400 stops retries.
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    await handleStripeEvent(event)
  } catch (err) {
    // Convex claim failure or other downstream error.
    // 5xx so Stripe retries; claim is idempotent so retry-after-fix is safe.
    // eslint-disable-next-line no-console
    console.error(`[stripe.webhook] handler error for ${event.id}:`, err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  // Signature OK + handler done (either processed or recognized as replay).
  return NextResponse.json({ received: true })
}
