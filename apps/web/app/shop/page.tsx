import type { Metadata } from 'next'
import { groq } from 'next-sanity'

import { sanityClient } from '@/lib/sanity/client'
import { SITE_NAME, getSiteUrl } from '@/lib/site'
import { BuyButton } from '@/components/marketing/BuyButton'

/**
 * ISR: charity callout refreshes within 60s of a new issue publishing.
 * Preserves the Phase 2 revalidate value verbatim.
 */
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Jesse A. Eisenbalm lip balm. 100% of proceeds go to the featured charity.',
  alternates: { canonical: `${getSiteUrl()}/shop` },
  openGraph: {
    type: 'website',
    title: `Shop — ${SITE_NAME}`,
    description: 'Jesse A. Eisenbalm lip balm. 100% of proceeds go to the featured charity.',
    url: '/shop',
    images: ['/og-default.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Shop — ${SITE_NAME}`,
    description: 'Jesse A. Eisenbalm lip balm. 100% of proceeds go to the featured charity.',
    images: ['/og-default.png'],
  },
}

/**
 * Inline projection — single consumer (this page). The same name pattern
 * was used in Phase 2 Plan 02-09; preserving the inline location avoids
 * polluting apps/web/lib/sanity/queries.ts with a one-off projection.
 */
const QUERY_LATEST_CHARITY_NAME = groq`
  *[_type == "weeklyIssue" && status == "published"]
  | order(issueNumber desc)[0] {
    "charityName": charity->name
  }
`

/**
 * /shop — Server Component.
 *
 * CMR-01: server-rendered (no 'use client', no useEffect, no loading skeleton).
 * The BuyButton below is a Client Component island; it does not block the
 * server-rendered page from streaming or hydrating with the charity name
 * already in the HTML.
 *
 * Error path: a Sanity outage must not 500 the shop page. The try/catch
 * falls through with null and renders the fallback copy + BuyButton.
 */
export default async function ShopPage() {
  let charityName: string | null = null
  try {
    const result = await sanityClient.fetch<{ charityName: string | null } | null>(
      QUERY_LATEST_CHARITY_NAME,
    )
    charityName = result?.charityName ?? null
  } catch {
    // Fall through with null — the fallback copy still renders.
    charityName = null
  }

  const charityCallout = charityName
    ? `This week's proceeds benefit ${charityName}.`
    : 'Proceeds go to our featured charity each week.'

  return (
    <section className="mx-auto max-w-[860px] px-4 md:px-6 lg:px-8 py-16">
      <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
        Shop
      </p>
      <h1 className="mt-3 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
        Jesse A. Eisenbalm
      </h1>
      <p className="mt-1 font-display text-[22px] font-semibold text-[color:var(--color-text-muted)]">
        Lip Balm
      </p>

      <p className="mt-8 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
        {charityCallout}
      </p>

      <p className="mt-4 font-body text-[16px] leading-[1.65] text-[color:var(--color-text)]">
        One tube. Mineral-tinted, unscented, made by a small contract
        manufacturer in the Pacific Northwest. Ships flat-rate within the
        continental United States.
      </p>

      <BuyButton />
    </section>
  )
}
