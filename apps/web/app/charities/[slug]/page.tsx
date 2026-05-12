/**
 * /charities/[slug] — Single charity detail page.
 *
 * Server component. Fetches QUERY_CHARITY_BY_SLUG, calls notFound() on null.
 * Emits schema.org/NGO JSON-LD (WEB-10) and OG/Twitter metadata (WEB-11).
 *
 * generateStaticParams: enumerates all charity slugs from QUERY_ALL_CHARITIES
 * at build time for static generation.
 *
 * ISR: revalidate = 60.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { sanityClient } from '@/lib/sanity/client'
import {
  QUERY_ALL_CHARITIES,
  QUERY_CHARITY_BY_SLUG,
} from '@/lib/sanity/queries'
import type {
  CharityDetail as CharityDetailType,
  CharityListItem,
} from '@/lib/sanity/types'
import { CharityDetail } from '@/components/charities/CharityDetail'
import { JsonLd } from '@/components/JsonLd'
import { SITE_NAME, getSiteUrl } from '@/lib/site'

export const revalidate = 60

// ─── Static params ─────────────────────────────────────────────────────────

/**
 * Enumerate all charity slugs at build time for static generation.
 * Uses QUERY_ALL_CHARITIES which returns the full list in alphabetical order.
 */
export async function generateStaticParams() {
  const charities = await sanityClient.fetch<CharityListItem[]>(
    QUERY_ALL_CHARITIES,
  )
  return charities.map((c) => ({ slug: c.slug }))
}

// ─── Data fetching ─────────────────────────────────────────────────────────

async function fetchCharity(slug: string): Promise<CharityDetailType> {
  return sanityClient.fetch<CharityDetailType>(QUERY_CHARITY_BY_SLUG, { slug })
}

// ─── Metadata ──────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const charity = await fetchCharity(slug)
  if (!charity) return { title: 'Charity not found' }

  const title = charity.name
  // Truncate mission statement to 160 chars for meta description; fall back to
  // generic description if missionStatement is null.
  const description =
    (charity.missionStatement ?? '').slice(0, 160) ||
    'A charity featured by The Eisenbalm Dispatch.'
  const url = `${getSiteUrl()}/charities/${slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: `${title} — ${SITE_NAME}`,
      description,
      url,
      images: ['/og-default.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — ${SITE_NAME}`,
      description,
      images: ['/og-default.png'],
    },
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function CharityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const charity = await fetchCharity(slug)

  // notFound() triggers the nearest not-found.tsx boundary (Next.js convention).
  if (!charity) notFound()

  /**
   * schema.org/NGO JSON-LD (WEB-10).
   * Only include fields that are non-null to avoid emitting "null" values
   * in the structured data output.
   */
  const ngoLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    name: charity.name,
    location: charity.location,
    ...(charity.missionStatement
      ? { description: charity.missionStatement }
      : {}),
    ...(charity.website ? { url: charity.website } : {}),
    // foundingDate expects a string in schema.org; foundingYear is stored as number.
    ...(charity.foundingYear
      ? { foundingDate: String(charity.foundingYear) }
      : {}),
  }

  return (
    <>
      {/* JSON-LD injected into <head> via dangerouslySetInnerHTML (see JsonLd.tsx) */}
      <JsonLd data={ngoLd} />
      <CharityDetail charity={charity} />
    </>
  )
}
