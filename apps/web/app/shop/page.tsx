import type { Metadata } from 'next'
import { groq } from 'next-sanity'
import { sanityClient } from '@/lib/sanity/client'
import { SITE_NAME, getSiteUrl } from '@/lib/site'
import { Button } from '@/components/ui/button'

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
 * Phase 2 only needs the latest issue's charity name for the callout.
 * Inline query — this page is the only consumer of this specific projection,
 * and Phase 8 rewrites this page entirely when Stripe is wired.
 * Does NOT extend lib/sanity/queries.ts (per plan decision).
 */
const QUERY_LATEST_CHARITY_NAME = groq`
  *[_type == "weeklyIssue" && status == "published"]
  | order(issueNumber desc)[0] {
    "charityName": charity->name
  }
`

/**
 * Phase 2 shop shell. Phase 8 replaces this with the full Stripe Checkout flow.
 */
export default async function ShopPage() {
  const result = await sanityClient.fetch<{ charityName: string | null } | null>(
    QUERY_LATEST_CHARITY_NAME,
  )

  const charityCallout = result?.charityName
    ? `This week's proceeds benefit ${result.charityName}.`
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
      <p className="mt-4 font-ui text-[14px] text-[color:var(--color-text-muted)]">
        Product details coming soon.
      </p>
      {/*
        shadcn Button (installed by Plan 02-05). variant="default" applies
        the accent-colored background per UI-SPEC Component Inventory.
        Phase 8 enables this button and wires it to a Stripe Checkout session.
      */}
      <Button
        type="button"
        disabled
        aria-disabled="true"
        size="lg"
        className="mt-8"
      >
        Coming soon
      </Button>
    </section>
  )
}
