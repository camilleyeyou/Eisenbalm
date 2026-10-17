/**
 * Full issue page — Phase 55 Dispatch front page.
 *
 * Fetches the live issue, the archive and the latest slug from Sanity, plus the
 * initial balms count from Convex (tolerant of failure). Rendering is delegated
 * to IssueLayout (shared with home and preview) so they can never drift.
 *
 * Section order (LOCKED — Phase 55 UI-SPEC):
 *   masthead, ticker, hero, how strip, sticky nav, sections 01-08
 *   (origin, problem, founder, case, game, bonus, delib, pod), buy band,
 *   back issues. Footer is supplied by the root layout outside <main>.
 *
 * JSON-LD (WEB-10): schema.org/Article with charity-level data.
 * generateMetadata (WEB-11): per-issue OG + Twitter card.
 * generateStaticParams: build-time slugs for published issues.
 * ISR: export const revalidate = 60 (CONTEXT.md D-02).
 */
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { groq } from 'next-sanity'

import { sanityClient } from '@/lib/sanity/client'
import { QUERY_ISSUE_BY_SLUG, QUERY_ARCHIVE, QUERY_LATEST_ISSUE_SLUG } from '@/lib/sanity/queries'
import type { Issue, ArchiveIssue, LatestIssueSlug } from '@/lib/sanity/types'
import { fetchBalms } from '@/lib/dispatch/balms-server'
import { SITE_NAME, getSiteUrl } from '@/lib/site'

import { IssueLayout } from '@/components/issue/IssueLayout'

// ─── ISR revalidation (CONTEXT.md D-02) ──────────────────────────────────────

export const revalidate = 60

// ─── generateStaticParams ─────────────────────────────────────────────────────

/** Minimal slug list query for build-time static generation. */
const QUERY_ALL_ISSUE_SLUGS = groq`
  *[_type == "weeklyIssue" && status == "published"] {
    "slug": slug.current
  }
`

export async function generateStaticParams() {
  try {
    const slugs: Array<{ slug: string }> = await sanityClient.fetch(
      QUERY_ALL_ISSUE_SLUGS,
    )
    return slugs.map((s) => ({ slug: s.slug }))
  } catch {
    return []
  }
}

// ─── generateMetadata (WEB-11) ────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  let issue: Issue = null

  try {
    issue = await sanityClient.fetch<Issue>(QUERY_ISSUE_BY_SLUG, { slug })
  } catch {
    // Fall through — metadata will use generic fallbacks
  }

  if (!issue) {
    return { title: 'Issue not found' }
  }

  const charityName = issue.charity.name
  const pageTitle = charityName
  const description = issue.charity.missionStatement?.slice(0, 160) ?? SITE_NAME
  const siteUrl = getSiteUrl()
  const pageUrl = `${siteUrl}/issue/${slug}`
  const ogImage = `${siteUrl}/og-default.png`

  return {
    title: pageTitle,
    description,
    openGraph: {
      type: 'article',
      title: pageTitle,
      description,
      url: pageUrl,
      siteName: SITE_NAME,
      publishedTime: issue.publishDate,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${charityName} — ${SITE_NAME}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: [ogImage],
    },
    alternates: { canonical: pageUrl },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IssuePage({ params }: PageProps) {
  const { slug } = await params

  const [issue, archive, latest] = await Promise.all([
    sanityClient.fetch<Issue>(QUERY_ISSUE_BY_SLUG, { slug }),
    sanityClient.fetch<ArchiveIssue[]>(QUERY_ARCHIVE).catch(() => [] as ArchiveIssue[]),
    sanityClient.fetch<LatestIssueSlug>(QUERY_LATEST_ISSUE_SLUG).catch(() => null),
  ])
  if (!issue) {
    notFound()
  }

  const isCurrent = latest?.slug === slug
  const sinceMs = Date.parse(`${issue.publishDate}T00:00:00Z`)
  const initialBalms = await fetchBalms(
    issue.charity.slug,
    isCurrent && Number.isFinite(sinceMs) ? sinceMs : undefined,
  )

  return (
    <IssueLayout
      issue={issue}
      slug={slug}
      archive={archive ?? []}
      isCurrent={isCurrent}
      initialBalms={initialBalms}
    />
  )
}
