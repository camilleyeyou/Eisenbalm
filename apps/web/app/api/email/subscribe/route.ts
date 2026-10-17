import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { generateUnsubscribeToken } from '@eisenbalm/emails'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status })

export async function POST(req: Request) {
  let data: { email?: unknown; company?: unknown } = {}
  try {
    data = await req.json()
  } catch {
    return json(400, { ok: false, error: 'invalid-email' })
  }
  if (typeof data.company === 'string' && data.company.trim() !== '') return json(200, { ok: true })
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
  if (email.length < 3 || email.length > 254 || !EMAIL_RE.test(email)) {
    return json(400, { ok: false, error: 'invalid-email' })
  }
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) {
    console.error('[email.subscribe] NEXT_PUBLIC_CONVEX_URL is not set')
    return json(500, { ok: false, error: 'misconfigured' })
  }
  try {
    await new ConvexHttpClient(url).mutation(api.emailSubscribers.subscribeNewsletter, {
      email,
      unsubscribeToken: generateUnsubscribeToken(),
      webhookSecret: process.env.STRIPE_TO_CONVEX_SECRET ?? '',
    })
  } catch (err) {
    console.error('[email.subscribe] convex mutation failed', err)
    return json(502, { ok: false, error: 'unavailable' })
  }
  return json(200, { ok: true })
}
