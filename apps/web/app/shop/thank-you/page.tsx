import type { Metadata } from 'next'
import Link from 'next/link'
import { groq } from 'next-sanity'

import { sanityClient } from '@/lib/sanity/client'
import { SitePage } from '@/components/dispatch/SitePage'

/**
 * /shop/thank-you — post-purchase confirmation page.
 *
 * CMR-03 REFINED CONTRACT: this page MAY do a server-side Sanity read of
 * the current featured charity (to name the beneficiary inline). It MUST NOT:
 *   - look up anything via URL parameters (no enumeration risk)
 *   - import or call any Convex client
 *   - call the Stripe API
 *
 * The webhook at /api/stripe/webhook remains the authoritative fulfillment
 * event; this page is a confirmation that names the cause the purchase served.
 *
 * Source-scan tripwire: apps/web/__tests__/thank-you-source.test.ts enforces
 * the above contract via static source analysis.
 */

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Thank you',
  description: 'Order received.',
  robots: { index: false, follow: false },
}

/**
 * Inline projection — mirrors shop/page.tsx exactly.
 * Single consumer; kept inline to avoid polluting lib/sanity/queries.ts.
 */
const QUERY_LATEST_CHARITY_NAME = groq`
  *[_type == "weeklyIssue" && status == "published"]
  | order(issueNumber desc)[0] {
    "charityName": charity->name
  }
`

export default async function ThankYouPage() {
  let charityName: string | null = null
  try {
    const result = await sanityClient.fetch<{ charityName: string | null } | null>(
      QUERY_LATEST_CHARITY_NAME,
    )
    charityName = result?.charityName ?? null
  } catch {
    charityName = null
  }

  return (
    <SitePage eyebrow="Order received" title="Your lip balm is on its way." tone="green" narrow>
      <div className="d-page-copy">
        <p className="d-body">
          This week, every dollar of proceeds goes to{' '}
          {charityName ?? "this week's featured charity"} — not the margin, the
          proceeds, in full. A small purchase pointed at a serious end. Thank you
          for pointing it there.
        </p>
        <p className="d-label d-muted">
          A receipt will follow by email.
        </p>
        <p className="d-body">
          <Link href="/">Return to the latest issue.</Link>
        </p>
      </div>
    </SitePage>
  )
}
