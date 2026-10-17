import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'

/** Initial balms count for SSR. Returns undefined on any failure; the page renders without Convex. */
export async function fetchBalms(charitySlug: string, sinceMs?: number): Promise<number | undefined> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) return undefined
  try {
    const client = new ConvexHttpClient(url)
    const r = await client.query(
      api.stripeOrders.balmsForCharity,
      sinceMs === undefined ? { charitySlug } : { charitySlug, sinceMs },
    )
    return r.balms
  } catch {
    return undefined
  }
}
