import type { Metadata } from 'next'
import { sanityClient } from '@/lib/sanity/client'
import { QUERY_ARCHIVE } from '@/lib/sanity/queries'
import type { ArchiveIssue } from '@/lib/sanity/types'
import { ArchiveList } from '@/components/archive/ArchiveList'
import { CardSwap } from '@/components/archive/CardSwap'
import { SITE_NAME, getSiteUrl } from '@/lib/site'
import { SitePage } from '@/components/dispatch/SitePage'
import '@/components/dispatch/pages.css'

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
    <SitePage title="Archive" lead="Every issue of The Eisenbalm Dispatch." tone="green">
      {issues && issues.length > 0 && <CardSwap issues={issues} />}
      <div>
        {issues && issues.length > 0 ? (
          <ArchiveList issues={issues} />
        ) : (
          <p className="d-body d-muted">
            Nothing to read yet.
          </p>
        )}
      </div>
    </SitePage>
  )
}
