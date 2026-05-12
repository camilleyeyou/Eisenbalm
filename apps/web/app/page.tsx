import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { sanityClient } from '@/lib/sanity/client'
import { QUERY_LATEST_ISSUE_SLUG } from '@/lib/sanity/queries'
import type { LatestIssueSlug } from '@/lib/sanity/types'
import { SITE_NAME, SITE_DESCRIPTION, getSiteUrl } from '@/lib/site'

export const revalidate = 60

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  alternates: { canonical: getSiteUrl() },
  openGraph: {
    type: 'website',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: '/',
    images: ['/og-default.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/og-default.png'],
  },
}

export default async function HomePage() {
  const latest = await sanityClient.fetch<LatestIssueSlug>(QUERY_LATEST_ISSUE_SLUG)

  if (latest?.slug) {
    redirect(`/issue/${latest.slug}`)
  }

  // Empty state: no published issues yet.
  return (
    <section className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8 py-16">
      <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
        The Eisenbalm Dispatch
      </h1>
      <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
        The first issue is being prepared. Check back Thursday.
      </p>
    </section>
  )
}
