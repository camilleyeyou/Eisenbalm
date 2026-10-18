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
import { SitePage } from '@/components/dispatch/SitePage'
import '@/components/dispatch/pages.css'

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

  // Single-main-landmark pattern: layout.tsx owns the one <main id="main">;
  // route pages use <div> so the landmark is never nested (WCAG 1.3.1).
  return (
    <SitePage title="Charities" lead="Every charity featured by The Eisenbalm Dispatch." tone="yellow">
      {!charities || charities.length === 0 ? (
        /* Empty state — Jesse voice, dry, no exclamation */
        <p className="d-body d-muted">
          No charities indexed yet.
        </p>
      ) : (
        <ul className="d-rows">
          {charities.map((charity) => (
            <CharityCard key={charity.slug} charity={charity} />
          ))}
        </ul>
      )}
    </SitePage>
  )
}
