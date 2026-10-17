import { describe, it, expect, vi, beforeEach } from 'vitest'

const TOKEN = 'a'.repeat(64)

async function load(mutationImpl: () => unknown = () => null) {
  const mutationSpy = vi.fn(mutationImpl)
  vi.doMock('convex/browser', () => ({
    ConvexHttpClient: class {
      mutation = mutationSpy
    },
  }))
  vi.doMock('@convex/_generated/api', () => ({
    api: { emailSubscribers: { subscribeNewsletter: 'subscribeNewsletter' } },
  }))
  vi.doMock('@eisenbalm/emails', () => ({ generateUnsubscribeToken: () => TOKEN }))
  const { POST } = await import('@/app/api/email/subscribe/route')
  return { POST, mutationSpy }
}

const post = (body: unknown, raw = false) =>
  new Request('https://x/api/email/subscribe', {
    method: 'POST',
    body: raw ? (body as string) : JSON.stringify(body),
  })

describe('POST /api/email/subscribe', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud'
    process.env.STRIPE_TO_CONVEX_SECRET = 'sekrit'
    vi.resetModules()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it.each([
    ['non-JSON', 'nope', true],
    ['missing email', {}, false],
    ['bad email', { email: 'not-an-email' }, false],
    ['255-char email', { email: 'a'.repeat(250) + '@b.co' }, false],
  ])('400 on %s', async (_n, body, raw) => {
    const { POST, mutationSpy } = await load()
    const res = await POST(post(body, raw as boolean))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, error: 'invalid-email' })
    expect(mutationSpy).not.toHaveBeenCalled()
  })

  it('honeypot returns 200 without calling mutation', async () => {
    const { POST, mutationSpy } = await load()
    const res = await POST(post({ email: 'a@b.co', company: 'Acme' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mutationSpy).not.toHaveBeenCalled()
  })

  it('valid email normalised and mutation called once', async () => {
    const { POST, mutationSpy } = await load()
    const res = await POST(post({ email: ' Reader@Example.com ' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mutationSpy).toHaveBeenCalledTimes(1)
    expect(mutationSpy).toHaveBeenCalledWith('subscribeNewsletter', {
      email: 'reader@example.com',
      unsubscribeToken: TOKEN,
      webhookSecret: 'sekrit',
    })
  })

  it('502 without echoing error when mutation throws', async () => {
    const { POST } = await load(() => {
      throw new Error('secret internals')
    })
    const res = await POST(post({ email: 'a@b.co' }))
    expect(res.status).toBe(502)
    const text = await res.text()
    expect(text).not.toContain('secret internals')
    expect(JSON.parse(text)).toEqual({ ok: false, error: 'unavailable' })
  })

  it('500 when Convex URL unset', async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL
    const { POST } = await load()
    const res = await POST(post({ email: 'a@b.co' }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ ok: false, error: 'misconfigured' })
  })
})
