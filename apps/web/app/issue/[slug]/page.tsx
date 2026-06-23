/**
 * Full issue page — Phase 19 Stage B: Live Data Wiring.
 * UI-SPEC §/issue/[slug] + §Delivery Stages (Stage B).
 *
 * Requirements: WEB-02, WEB-06, WEB-07, WEB-08, WEB-09, WEB-10, WEB-11,
 *               WEB-14, WEB-15, WEB-16.
 *
 * STAGE B: Fetches the live issue from Sanity via QUERY_ISSUE_BY_SLUG.
 * The component tree, section ids, and framer-motion wrappers are byte-identical
 * to Stage A — only the data source changed (P19-05).
 *
 * Rendering is delegated to IssueLayout (shared with preview/page.tsx) so that
 * the draft-preview can never drift from the published layout (D-09 fidelity,
 * Plan 26-04).
 *
 * Section order (LOCKED — Phase 19 UI-SPEC):
 *   1. ScrollProgressBar  (fixed top progress bar)
 *   2. SectionRail        (fixed left scroll-spy nav)
 *   3. IssueMasthead      (dateline / h1 / tagline)
 *   4. IssueBriefing      (why / at-a-glance stats / what's inside)
 *   5. MissionBand        (sitewide constant copy)
 *   6. EditorialSection   origin story   (id="origin", lead)
 *   7. EditorialSection   problem        (id="problem", lead)
 *   8. EditorialSection   founder bio    (id="founder", lead)
 *   9. CaseStudySection   case study     (id="case", lead)
 *  10. GameSlot                          (id="game")
 *  11. BonusSection                      (id="bonus")
 *  12. DeliberationSlot   dark-band      (id="delib")
 *  13. PodcastSlot                       (id="pod")
 *  14. ShopBand           shop section   (data-shop-callout)
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
import { QUERY_ISSUE_BY_SLUG } from '@/lib/sanity/queries'
import type { Issue } from '@/lib/sanity/types'
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

  // Stage B: live fetch from Sanity (QUERY_ISSUE_BY_SLUG already projects
  // all required fields including selectionDeliberation.conversation[]).
  const issue = await sanityClient.fetch<Issue>(QUERY_ISSUE_BY_SLUG, { slug })
  if (!issue) {
    notFound()
  }

  return <IssueLayout issue={issue} slug={slug} />
}
