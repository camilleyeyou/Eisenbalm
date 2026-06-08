import type { Metadata } from 'next'
import Link from 'next/link'
import { groq } from 'next-sanity'

import { sanityClient } from '@/lib/sanity/client'

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
    <section className="mx-auto max-w-[860px] px-4 md:px-6 lg:px-8 py-16">
      <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
        Order received
      </p>
      <h1 className="mt-3 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
        Your lip balm is on its way.
      </h1>
      <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
        This week, every dollar of proceeds goes to{' '}
        {charityName ?? "this week's featured charity"} — not the margin, the
        proceeds, in full. A small purchase pointed at a serious end. Thank you
        for pointing it there.
      </p>
      <p className="mt-4 font-body text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
        A receipt will follow by email.
      </p>
      <p className="mt-8 font-body text-[16px] leading-[1.65]">
        <Link
          href="/"
          className="text-[color:var(--color-accent)] underline-offset-4 hover:underline"
        >
          Return to the latest issue.
        </Link>
      </p>
    </section>
  )
}
