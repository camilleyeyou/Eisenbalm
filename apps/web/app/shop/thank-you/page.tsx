import type { Metadata } from 'next'
import Link from 'next/link'

/**
 * /shop/thank-you — decorative post-purchase landing.
 *
 * CMR-03: this page MUST NOT query any database. The Stripe webhook
 * at /api/stripe/webhook is the source of truth for fulfillment.
 * Stripe sends a default email receipt to the customer; this page is
 * a visual confirmation that the redirect landed where it should.
 *
 * Source-scan tripwire at apps/web/__tests__/thank-you-source.test.ts
 * will fail if any DB/HTTP client is imported or called here.
 * See the test file for the exact forbidden patterns.
 *
 * The session_id URL param is accepted (Stripe templates it into the
 * success_url) but we deliberately do NOT use it for any lookup —
 * exposing it would invite enumeration attacks.
 */

export const metadata: Metadata = {
  title: 'Thank you',
  description: 'Order received.',
  robots: { index: false, follow: false },
}

interface PageProps {
  // Next.js 15: searchParams is a Promise
  searchParams: Promise<{ session_id?: string }>
}

export default async function ThankYouPage({ searchParams }: PageProps) {
  // We resolve the searchParams Promise to satisfy the Next.js 15 contract,
  // but we deliberately discard the value. The session_id is meaningful
  // only to Stripe; we do not look it up.
  await searchParams

  return (
    <section className="mx-auto max-w-[860px] px-4 md:px-6 lg:px-8 py-16">
      <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
        Order received
      </p>
      <h1 className="mt-3 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
        Your lip balm is on the way.
      </h1>
      <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
        A receipt is in your inbox. 100% of proceeds from this week&apos;s
        sales go to the featured charity.
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
