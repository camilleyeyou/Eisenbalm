/**
 * CMR-04 — Stripe webhook signature verification unit tests.
 *
 * Tests construct a synthetic Stripe webhook payload and signature using
 * stripe.webhooks.generateTestHeaderString (a real SDK helper) and then
 * dynamically import the production route handler. The handler must:
 *
 *   - Accept a valid signature on raw body and return 200.
 *   - Reject a forged signature with a 4xx.
 *   - Reject a missing signature header with 400.
 *   - Reject when STRIPE_WEBHOOK_SECRET is unset (no bypass — CMR-05).
 *
 * Implementation notes:
 *   - Production code is loaded via `await import(...)` inside `it()` bodies
 *     so the test file itself loads even when the route handler and the
 *     `stripe` npm package are not yet installed. Wave 0 sentinel behavior:
 *     these tests fail at runtime until Plan 08-03 installs `stripe` and
 *     Plan 08-05 lands the webhook handler.
 *   - Convex calls are mocked via vi.doMock so handleStripeEvent's network
 *     calls never run in unit tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('CMR-04: Stripe webhook signature verification', () => {
  beforeEach(() => {
    // Ensure required env vars present for the route handler.
    // The webhook secret here is dummy — only generateTestHeaderString
    // needs to know it for the matching pair.
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? 'sk_test_dummy'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy_secret_for_unit_tests'
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud'
    vi.resetModules()
  })

  it('accepts a valid signature on raw body and returns 200', async () => {
    // Mock convex/browser so handleStripeEvent's Convex mutation never runs
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: class {
        mutation = vi.fn(async () => ({ firstTime: true }))
      },
    }))
    vi.doMock('@convex/_generated/api', () => ({
      api: {
        stripeEvents: { claim: 'claim' },
        stripeOrders: { insert: 'insert' },
      },
    }))

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe('sk_test_dummy', {
      apiVersion: '2025-04-30.basil' as never,
    })
    const payload = JSON.stringify({
      id: 'evt_test_1',
      type: 'checkout.session.completed',
      data: { object: {} },
      livemode: false,
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
      timestamp,
    })

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const req = new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
      body: payload,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('rejects a forged signature with 4xx', async () => {
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: class {
        mutation = vi.fn()
      },
    }))
    vi.doMock('@convex/_generated/api', () => ({
      api: { stripeEvents: { claim: 'claim' } },
    }))

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const req = new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=0,v1=forged_garbage' },
      body: JSON.stringify({ id: 'evt_test_2' }),
    })
    const res = await POST(req)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  it('rejects a missing signature header with 400', async () => {
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: class {
        mutation = vi.fn()
      },
    }))
    vi.doMock('@convex/_generated/api', () => ({
      api: { stripeEvents: { claim: 'claim' } },
    }))

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const req = new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects when STRIPE_WEBHOOK_SECRET env var is unset (no bypass — CMR-05)', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: class {
        mutation = vi.fn()
      },
    }))
    vi.doMock('@convex/_generated/api', () => ({
      api: { stripeEvents: { claim: 'claim' } },
    }))

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const req = new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=0,v1=anything' },
      body: '{}',
    })
    const res = await POST(req)
    // Misconfigured — must NOT silently process; return non-2xx.
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
