/**
 * Phase 20 Plan 05 — Task 2: GET/POST /api/email/unsubscribe route
 *
 * RFC 8058 one-click unsubscribe. Tests:
 *   - GET with no token → 400 (Convex never called)
 *   - GET with blank token → 400 (Convex never called)
 *   - GET with valid token → 200 text/html, Convex mutation called once
 *   - POST exported as a function (RFC 8058 one-click clients POST)
 *   - runtime = 'nodejs' exported from the module
 *
 * Mocking strategy: vi.doMock with vi.resetModules() (mirrors stripe-webhook pattern).
 * ConvexHttpClient is mocked so no real Convex connection is made.
 * @convex/_generated/api is mocked to provide the api.emailSubscribers.unsubscribeByTokenPublic reference.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('GET /api/email/unsubscribe', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud'
    vi.resetModules()
  })

  it('returns 400 when token is missing from the URL', async () => {
    const mutationSpy = vi.fn()
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: class {
        mutation = mutationSpy
      },
    }))
    vi.doMock('@convex/_generated/api', () => ({
      api: {
        emailSubscribers: { unsubscribeByTokenPublic: 'unsubscribeByTokenPublic' },
      },
    }))

    const { GET } = await import('@/app/api/email/unsubscribe/route')
    const req = new Request('https://x/api/email/unsubscribe')
    const res = await GET(req)

    expect(res.status).toBe(400)
    expect(mutationSpy).not.toHaveBeenCalled()
  })

  it('returns 400 when token is present but blank (?token=)', async () => {
    const mutationSpy = vi.fn()
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: class {
        mutation = mutationSpy
      },
    }))
    vi.doMock('@convex/_generated/api', () => ({
      api: {
        emailSubscribers: { unsubscribeByTokenPublic: 'unsubscribeByTokenPublic' },
      },
    }))

    const { GET } = await import('@/app/api/email/unsubscribe/route')
    const req = new Request('https://x/api/email/unsubscribe?token=')
    const res = await GET(req)

    expect(res.status).toBe(400)
    expect(mutationSpy).not.toHaveBeenCalled()
  })

  it('returns 200 text/html and calls the Convex mutation once with the token', async () => {
    const mutationSpy = vi.fn(async () => ({ ok: true }))
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: class {
        mutation = mutationSpy
      },
    }))
    vi.doMock('@convex/_generated/api', () => ({
      api: {
        emailSubscribers: { unsubscribeByTokenPublic: 'unsubscribeByTokenPublic' },
      },
    }))

    const { GET } = await import('@/app/api/email/unsubscribe/route')
    const req = new Request('https://x/api/email/unsubscribe?token=abc123')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const contentType = res.headers.get('Content-Type') ?? res.headers.get('content-type') ?? ''
    expect(contentType).toMatch(/text\/html/)
    expect(mutationSpy).toHaveBeenCalledOnce()
    expect(mutationSpy).toHaveBeenCalledWith('unsubscribeByTokenPublic', { token: 'abc123' })
  })

  it('response body mentions transactional receipts will still be sent', async () => {
    const mutationSpy = vi.fn(async () => ({ ok: true }))
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: class {
        mutation = mutationSpy
      },
    }))
    vi.doMock('@convex/_generated/api', () => ({
      api: {
        emailSubscribers: { unsubscribeByTokenPublic: 'unsubscribeByTokenPublic' },
      },
    }))

    const { GET } = await import('@/app/api/email/unsubscribe/route')
    const req = new Request('https://x/api/email/unsubscribe?token=tok999')
    const res = await GET(req)

    const body = await res.text()
    expect(body.toLowerCase()).toMatch(/transactional/)
  })
})

describe('POST /api/email/unsubscribe (RFC 8058 one-click)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud'
    vi.resetModules()
  })

  it('POST is exported as a function', async () => {
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: class {
        mutation = vi.fn()
      },
    }))
    vi.doMock('@convex/_generated/api', () => ({
      api: {
        emailSubscribers: { unsubscribeByTokenPublic: 'unsubscribeByTokenPublic' },
      },
    }))

    const module = await import('@/app/api/email/unsubscribe/route')
    expect(typeof module.POST).toBe('function')
  })

  it('POST with a valid token returns 200 (same logic as GET)', async () => {
    const mutationSpy = vi.fn(async () => ({ ok: true }))
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: class {
        mutation = mutationSpy
      },
    }))
    vi.doMock('@convex/_generated/api', () => ({
      api: {
        emailSubscribers: { unsubscribeByTokenPublic: 'unsubscribeByTokenPublic' },
      },
    }))

    const { POST } = await import('@/app/api/email/unsubscribe/route')
    const req = new Request('https://x/api/email/unsubscribe?token=xyz789', { method: 'POST' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mutationSpy).toHaveBeenCalledOnce()
  })
})

describe('Module exports: runtime + dynamic', () => {
  it('exports runtime = nodejs', async () => {
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: class {
        mutation = vi.fn()
      },
    }))
    vi.doMock('@convex/_generated/api', () => ({
      api: {
        emailSubscribers: { unsubscribeByTokenPublic: 'unsubscribeByTokenPublic' },
      },
    }))

    const module = await import('@/app/api/email/unsubscribe/route')
    expect((module as any).runtime).toBe('nodejs')
  })
})
