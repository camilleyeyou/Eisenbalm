/**
 * /charities — Charity database list page.
 *
 * Server component. Fetches all charities via QUERY_ALL_CHARITIES (alphabetical,
 * order enforced in GROQ: order(name asc) — API_CONTRACTS.md §1.4).
 *
 * Empty state: "No charities indexed yet." (Jesse voice — dry, no exclamations)
 * Filtering UI deferred to v2 (UI-SPEC defers until > 50 entries).
 *
 * ISR: revalidate = 60 (new charities appear within 60s of Sanity write).
 */
import type { Metadata } from 'next'
import { sanityClient } from '@/lib/sanity/client'
import { QUERY_ALL_CHARITIES } from '@/lib/sanity/queries'
import type { CharityListItem } from '@/lib/sanity/types'
import { CharityCard } from '@/components/charities/CharityCard'
import { SITE_NAME, getSiteUrl } from '@/lib/site'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Charities',
  description: 'Every charity featured by The Eisenbalm Dispatch.',
  alternates: { canonical: `${getSiteUrl()}/charities` },
  openGraph: {
    type: 'website',
    title: `Charities — ${SITE_NAME}`,
    description: 'Every charity featured by The Eisenbalm Dispatch.',
    url: `${getSiteUrl()}/charities`,
    images: ['/og-default.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Charities — ${SITE_NAME}`,
    description: 'Every charity featured by The Eisenbalm Dispatch.',
    images: ['/og-default.png'],
  },
}

export default async function CharitiesPage() {
  const charities = await sanityClient.fetch<CharityListItem[]>(
    QUERY_ALL_CHARITIES,
  )

  return (
    <div className="mx-auto max-w-[1100px] px-4 md:px-6 lg:px-8 py-12">
      {/* Page title — Display 36px/28px semibold (UI-SPEC list container 1100px) */}
      <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
        Charities
      </h1>
      <p className="mt-2 font-ui text-[14px] text-[color:var(--color-text-muted)]">
        Every charity featured by The Eisenbalm Dispatch.
      </p>

      {!charities || charities.length === 0 ? (
        /* Empty state — Jesse voice, dry, no exclamation */
        <p className="mt-8 font-ui text-[14px] text-[color:var(--color-text-muted)]">
          No charities indexed yet.
        </p>
      ) : (
        <ul className="mt-8">
          {charities.map((charity) => (
            <CharityCard key={charity.slug} charity={charity} />
          ))}
        </ul>
      )}
    </div>
  )
}
