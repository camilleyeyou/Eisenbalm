/**
 * CMR-02 + CMR-10 — POST /api/checkout/create-session unit tests.
 *
 * Mocks @/lib/stripe/server.getStripeServer so the test runs without a real
 * Stripe key. Asserts the shape of the args passed to
 * stripe.checkout.sessions.create:
 *   - mode === 'payment'
 *   - line_items references STRIPE_PRICE_ID with quantity 1
 *   - shipping_address_collection is enabled with a non-empty country list
 *     (CMR-10)
 *   - success_url contains /shop/thank-you?session_id={CHECKOUT_SESSION_ID}
 *   - cancel_url ends with /shop
 *   - returns 500 when STRIPE_PRICE_ID is unset
 *
 * Wave 0 sentinel: production code at apps/web/app/api/checkout/create-session/route.ts
 * and apps/web/lib/stripe/server.ts is created in Plan 08-04. Until then,
 * dynamic await import() fails and the assertions are unreachable — this is
 * expected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('CMR-02 + CMR-10: POST /api/checkout/create-session', () => {
  const sessionCreate = vi.fn()

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    process.env.STRIPE_PRICE_ID = 'price_test_lipbalm_001'
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    sessionCreate.mockReset()
    sessionCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/c/pay/cs_test_abc',
    })

    vi.resetModules()
    vi.doMock('@/lib/stripe/server', () => ({
      getStripeServer: () => ({
        checkout: { sessions: { create: sessionCreate } },
      }),
    }))
  })

  it('returns 200 with { url } pointing at Stripe-hosted checkout', async () => {
    const { POST } = await import('@/app/api/checkout/create-session/route')
    const req = new Request('http://localhost/api/checkout/create-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//)
  })

  it("passes mode: 'payment', quantity=1, and STRIPE_PRICE_ID to Stripe", async () => {
    const { POST } = await import('@/app/api/checkout/create-session/route')
    await POST(
      new Request('http://localhost/api/checkout/create-session', {
        method: 'POST',
        body: '{}',
      }),
    )
    expect(sessionCreate).toHaveBeenCalledOnce()
    const args = sessionCreate.mock.calls[0][0]
    expect(args.mode).toBe('payment')
    expect(args.line_items).toEqual([
      { price: 'price_test_lipbalm_001', quantity: 1 },
    ])
  })

  it('enables shipping_address_collection (CMR-10)', async () => {
    const { POST } = await import('@/app/api/checkout/create-session/route')
    await POST(
      new Request('http://localhost/api/checkout/create-session', {
        method: 'POST',
        body: '{}',
      }),
    )
    const args = sessionCreate.mock.calls[0][0]
    expect(args.shipping_address_collection).toBeDefined()
    expect(Array.isArray(args.shipping_address_collection.allowed_countries)).toBe(
      true,
    )
    expect(args.shipping_address_collection.allowed_countries.length).toBeGreaterThan(
      0,
    )
  })

  it('sets success_url to /shop/thank-you with {CHECKOUT_SESSION_ID} placeholder', async () => {
    const { POST } = await import('@/app/api/checkout/create-session/route')
    await POST(
      new Request('http://localhost/api/checkout/create-session', {
        method: 'POST',
        body: '{}',
      }),
    )
    const args = sessionCreate.mock.calls[0][0]
    expect(args.success_url).toContain('/shop/thank-you')
    expect(args.success_url).toContain('{CHECKOUT_SESSION_ID}')
  })

  it('sets cancel_url to /shop', async () => {
    const { POST } = await import('@/app/api/checkout/create-session/route')
    await POST(
      new Request('http://localhost/api/checkout/create-session', {
        method: 'POST',
        body: '{}',
      }),
    )
    const args = sessionCreate.mock.calls[0][0]
    expect(args.cancel_url).toMatch(/\/shop$/)
  })

  it('returns 500 when STRIPE_PRICE_ID is unset', async () => {
    delete process.env.STRIPE_PRICE_ID
    const { POST } = await import('@/app/api/checkout/create-session/route')
    const res = await POST(
      new Request('http://localhost/api/checkout/create-session', {
        method: 'POST',
        body: '{}',
      }),
    )
    expect(res.status).toBe(500)
  })

  // ─── Quantity wiring tests ────────────────────────────────────────────────

  it('defaults to quantity=1 when body is empty object ({})', async () => {
    const { POST } = await import('@/app/api/checkout/create-session/route')
    await POST(
      new Request('http://localhost/api/checkout/create-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    )
    const args = sessionCreate.mock.calls[0][0]
    expect(args.line_items[0].quantity).toBe(1)
  })

  it('passes explicit quantity=5 to Stripe line_items', async () => {
    const { POST } = await import('@/app/api/checkout/create-session/route')
    await POST(
      new Request('http://localhost/api/checkout/create-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantity: 5 }),
      }),
    )
    const args = sessionCreate.mock.calls[0][0]
    expect(args.line_items[0].quantity).toBe(5)
  })

  it('clamps quantity=0 to 1', async () => {
    const { POST } = await import('@/app/api/checkout/create-session/route')
    await POST(
      new Request('http://localhost/api/checkout/create-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantity: 0 }),
      }),
    )
    const args = sessionCreate.mock.calls[0][0]
    expect(args.line_items[0].quantity).toBe(1)
  })

  it('clamps quantity=99 to 20', async () => {
    const { POST } = await import('@/app/api/checkout/create-session/route')
    await POST(
      new Request('http://localhost/api/checkout/create-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantity: 99 }),
      }),
    )
    const args = sessionCreate.mock.calls[0][0]
    expect(args.line_items[0].quantity).toBe(20)
  })

  it('defaults to 1 when quantity is a non-numeric string', async () => {
    const { POST } = await import('@/app/api/checkout/create-session/route')
    await POST(
      new Request('http://localhost/api/checkout/create-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantity: 'abc' }),
      }),
    )
    const args = sessionCreate.mock.calls[0][0]
    expect(args.line_items[0].quantity).toBe(1)
  })

  it('defaults to 1 when body has no quantity key', async () => {
    const { POST } = await import('@/app/api/checkout/create-session/route')
    await POST(
      new Request('http://localhost/api/checkout/create-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ other: 'field' }),
      }),
    )
    const args = sessionCreate.mock.calls[0][0]
    expect(args.line_items[0].quantity).toBe(1)
  })
})
