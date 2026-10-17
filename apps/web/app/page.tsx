/**
 * Home — Phase 55: renders the latest published issue's Dispatch front page
 * (no redirect). Canonical points at /issue/<slug> so the two URLs do not
 * compete in search. With no published issue, shows the dry empty state.
 */
import type { Metadata } from 'next'
import { sanityClient } from '@/lib/sanity/client'
import { QUERY_LATEST_ISSUE_SLUG, QUERY_ISSUE_BY_SLUG, QUERY_ARCHIVE } from '@/lib/sanity/queries'
import type { Issue, ArchiveIssue, LatestIssueSlug } from '@/lib/sanity/types'
import { SITE_NAME, SITE_DESCRIPTION, getSiteUrl } from '@/lib/site'
import { fetchBalms } from '@/lib/dispatch/balms-server'
import { EMPTY_HOME_HEADING, EMPTY_HOME_BODY } from '@/lib/dispatch/copy'
import { IssueLayout } from '@/components/issue/IssueLayout'
import { DispatchMasthead } from '@/components/dispatch/DispatchMasthead'

export const revalidate = 60

async function getLatest(): Promise<LatestIssueSlug> {
  try {
    return await sanityClient.fetch<LatestIssueSlug>(QUERY_LATEST_ISSUE_SLUG)
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const latest = await getLatest()
  return {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    alternates: {
      canonical: latest?.slug ? `${getSiteUrl()}/issue/${latest.slug}` : getSiteUrl(),
    },
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
}

function EmptyHome() {
  return (
    <div className="dispatch">
      <DispatchMasthead issueNumber={null} dateLabel={null} compact />
      <section className="d-container d-sec" aria-labelledby="empty-title">
        <h1 id="empty-title" className="d-display">{EMPTY_HOME_HEADING}</h1>
        <p className="d-body">{EMPTY_HOME_BODY}</p>
      </section>
    </div>
  )
}

export default async function HomePage() {
  const latest = await getLatest()
  if (!latest?.slug) return <EmptyHome />

  let issue: Issue = null
  let archive: ArchiveIssue[] = []
  try {
    const [i, a] = await Promise.all([
      sanityClient.fetch<Issue>(QUERY_ISSUE_BY_SLUG, { slug: latest.slug }),
      sanityClient.fetch<ArchiveIssue[]>(QUERY_ARCHIVE).catch(() => [] as ArchiveIssue[]),
    ])
    issue = i
    archive = a ?? []
  } catch {
    issue = null
  }
  if (!issue) return <EmptyHome />

  const sinceMs = Date.parse(`${issue.publishDate}T00:00:00Z`)
  const initialBalms = await fetchBalms(
    issue.charity.slug,
    Number.isFinite(sinceMs) ? sinceMs : undefined,
  )

  return (
    <IssueLayout
      issue={issue}
      slug={latest.slug}
      archive={archive}
      isCurrent
      initialBalms={initialBalms}
    />
  )
}
