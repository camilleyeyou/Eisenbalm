import type { Metadata } from 'next'
import { sanityClient } from '@/lib/sanity/client'
import { QUERY_ARCHIVE } from '@/lib/sanity/queries'
import type { ArchiveIssue } from '@/lib/sanity/types'
import { ArchiveList } from '@/components/archive/ArchiveList'
import { SITE_NAME, getSiteUrl } from '@/lib/site'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Archive',
  description: 'Every issue of The Eisenbalm Dispatch. One obscure charity per week.',
  alternates: {
    canonical: `${getSiteUrl()}/archive`,
  },
  openGraph: {
    type: 'website',
    title: `Archive — ${SITE_NAME}`,
    description: 'Every issue of The Eisenbalm Dispatch. One obscure charity per week.',
    url: '/archive',
    images: ['/og-default.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Archive — ${SITE_NAME}`,
    description: 'Every issue of The Eisenbalm Dispatch. One obscure charity per week.',
    images: ['/og-default.png'],
  },
}

export default async function ArchivePage() {
  const issues = await sanityClient.fetch<ArchiveIssue[]>(QUERY_ARCHIVE)

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-12 md:px-6 lg:px-8">
      <h1 className="font-display text-[28px] font-semibold leading-[1.15] md:text-[36px]">
        Archive
      </h1>
      <p className="mt-2 font-ui text-[14px] text-[color:var(--color-text-muted)]">
        Every issue of The Eisenbalm Dispatch.
      </p>
      <div className="mt-8">
        {issues && issues.length > 0 ? (
          <ArchiveList issues={issues} />
        ) : (
          <p className="font-ui text-[14px] text-[color:var(--color-text-muted)]">
            Nothing to read yet.
          </p>
        )}
      </div>
    </main>
  )
}
