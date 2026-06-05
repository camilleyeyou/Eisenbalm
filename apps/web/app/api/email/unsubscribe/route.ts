/**
 * GET/POST /api/email/unsubscribe?token=...
 *
 * One-click unsubscribe surface (EMAIL-10). Accepts both GET and POST so that
 * RFC 8058 List-Unsubscribe-Post email clients work alongside simple GET links.
 *
 * Contract:
 *   - Missing or blank token → 400 (Convex is never called)
 *   - Valid token → calls api.emailSubscribers.unsubscribeByTokenPublic once,
 *     flipping consentState to 'unsubscribed' and cancelling all pending
 *     scheduled marketing steps (4-8); returns 200 text/html confirmation
 *
 * The Convex mutation is fire-and-forget-on-bad-token: if the token is not found,
 * the mutation returns { ok: false } but we still show the confirmation page —
 * this prevents enumeration of valid tokens while remaining user-friendly.
 *
 * Runtime: nodejs (ConvexHttpClient uses Node.js crypto; edge is unsupported).
 */
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get('token')

  if (!token || token.length === 0) {
    return new Response('Missing token', { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) {
    // eslint-disable-next-line no-console
    console.error('[email.unsubscribe] NEXT_PUBLIC_CONVEX_URL is not set')
    return new Response('Misconfigured', { status: 500 })
  }

  const convex = new ConvexHttpClient(url)
  await convex.mutation(api.emailSubscribers.unsubscribeByTokenPublic, { token })

  return new Response(
    '<html><body><p>You have been unsubscribed from marketing emails. Transactional receipts will still be sent for any orders.</p></body></html>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  )
}

/** GET: standard link-click unsubscribe */
export async function GET(req: Request) {
  return handle(req)
}

/** POST: RFC 8058 one-click unsubscribe (List-Unsubscribe-Post header clients) */
export async function POST(req: Request) {
  return handle(req)
}
