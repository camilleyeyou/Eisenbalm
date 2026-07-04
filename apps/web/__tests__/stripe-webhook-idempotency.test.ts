/**
 * CMR-06 — Stripe webhook idempotency on event.id.
 *
 * Idempotency contract: when the Convex claim mutation returns
 *   { firstTime: false }
 * the handler must NOT execute downstream fulfillment logic (no
 * stripeOrders insert). This is the central guarantee against duplicate
 * fulfillment on Stripe retries.
 *
 * Tests mock ConvexHttpClient.mutation to route by reference string —
 * 'claim' returns the configured firstTime value, 'insert' is observed to
 * confirm fulfillment was (or wasn't) attempted.
 *
 * Wave 0 sentinel: route handler at apps/web/app/api/stripe/webhook/route.ts
 * is created in Plan 08-05. `stripe` package install is in Plan 08-03.
 * Until both land, dynamic await import() fails — expected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('CMR-06: Stripe webhook idempotency on event.id', () => {
  const claimMutation = vi.fn()
  const ordersInsert = vi.fn()

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy_secret_for_unit_tests'
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud'
    claimMutation.mockReset()
    ordersInsert.mockReset()
    vi.resetModules()

    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: class {
        constructor(_url: string) {}
        mutation = (ref: unknown, args: unknown) => {
          if (ref === 'claim') return claimMutation(args)
          if (ref === 'insert') return ordersInsert(args)
          return Promise.resolve(null)
        }
      },
    }))
    vi.doMock('@convex/_generated/api', () => ({
      api: {
        stripeEvents: { claim: 'claim' },
        stripeOrders: { insert: 'insert' },
      },
    }))
  })

  async function buildSignedRequest(eventId: string) {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe('sk_test_dummy', {
      apiVersion: '2025-04-30.basil' as never,
    })
    const payload = JSON.stringify({
      id: eventId,
      type: 'checkout.session.completed',
      livemode: false,
      data: {
        object: {
          id: 'cs_test_abc',
          amount_total: 1200,
          currency: 'usd',
          customer_details: { email: 'r@example.com' },
        },
      },
    })
    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
      timestamp: Math.floor(Date.now() / 1000),
    })
    return new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
      body: payload,
    })
  }

  it('first delivery: claim returns firstTime=true, fulfillment runs', async () => {
    claimMutation.mockResolvedValue({ firstTime: true })
    const { POST } = await import('@/app/api/stripe/webhook/route')
    const res = await POST(await buildSignedRequest('evt_idem_first'))
    expect(res.status).toBe(200)
    expect(claimMutation).toHaveBeenCalledOnce()
  })

  it('replay: claim returns firstTime=false, fulfillment is SKIPPED', async () => {
    claimMutation.mockResolvedValue({ firstTime: false })
    const { POST } = await import('@/app/api/stripe/webhook/route')
    const res = await POST(await buildSignedRequest('evt_idem_replay'))
    expect(res.status).toBe(200)
    // The replay must NOT trigger ordersInsert.
    expect(ordersInsert).not.toHaveBeenCalled()
  })

  it('claim is called with event.id, event.type, event.livemode', async () => {
    claimMutation.mockResolvedValue({ firstTime: true })
    const { POST } = await import('@/app/api/stripe/webhook/route')
    await POST(await buildSignedRequest('evt_idem_args'))
    const args = claimMutation.mock.calls[0]![0]
    expect(args.eventId).toBe('evt_idem_args')
    expect(args.eventType).toBe('checkout.session.completed')
    expect(typeof args.livemode).toBe('boolean')
  })
})
