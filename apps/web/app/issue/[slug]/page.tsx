/**
 * Full issue page. The central reader experience. UI-SPEC §/issue/[slug].
 *
 * Requirements: WEB-02, WEB-06, WEB-07, WEB-08, WEB-09, WEB-10, WEB-11,
 *               WEB-14, WEB-15, WEB-16.
 *
 * Section order (LOCKED — docs/CLAUDE_CODE_BRIEF.md):
 *   1. IssueHero        (charity header)
 *   2. EditorialSection (origin story,   id="origin-story")
 *   3. EditorialSection (problem,        id="problem")
 *   4. EditorialSection (founder bio,    id="founder-bio")
 *   5. CaseStudySection (case study,     id="case-study")
 *   6. GameSlot         (game,           id="game")
 *   7. BonusSection     (bonus,          id="bonus")
 *   8. DeliberationSlot (deliberation,   id="deliberation")
 *   9. PodcastSlot      (podcast,        id="podcast")
 *  10. ShopCallout      (no id — not an anchor target)
 *
 * JSON-LD (WEB-10): schema.org/Article with charity-level data.
 * generateMetadata (WEB-11): per-issue OG + Twitter card.
 * generateStaticParams: build-time slugs for published issues.
 * ISR: export const revalidate = 60 (CONTEXT.md D-02).
 */
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { sanityClient } from '@/lib/sanity/client'
import { QUERY_ISSUE_BY_SLUG } from '@/lib/sanity/queries'
import type { Issue } from '@/lib/sanity/types'
import { readingTime } from '@/lib/reading-time'
import { SITE_NAME, SITE_AUTHOR, getSiteUrl } from '@/lib/site'

import { JsonLd } from '@/components/JsonLd'
import { IssueHero } from '@/components/issue/IssueHero'
import { EditorialSection } from '@/components/issue/EditorialSection'
import { CaseStudySection } from '@/components/issue/CaseStudySection'
import { GameSlot } from '@/components/issue/GameSlot'
import { BonusSection } from '@/components/issue/BonusSection'
import { DeliberationSlot } from '@/components/issue/DeliberationSlot'
import { PodcastSlot } from '@/components/issue/PodcastSlot'
import { ShopCallout } from '@/components/issue/ShopCallout'
import { groq } from 'next-sanity'

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
    // If Sanity is unreachable at build time (e.g., missing env), return empty
    // so the build succeeds; pages are generated on first request instead.
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
    // Fall through — metadata will use site-level defaults
  }

  if (!issue) {
    return {
      title: 'Issue not found',
    }
  }

  const charityName = issue.charity.name
  const pageTitle = charityName
  const description =
    issue.charity.missionStatement?.slice(0, 160) ?? SITE_NAME
  const siteUrl = getSiteUrl()
  const pageUrl = `${siteUrl}/issue/${slug}`
  // Phase 2: static OG image fallback (per-issue dynamic OG deferred to v2 — CONTEXT.md D-23)
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
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${charityName} — ${SITE_NAME}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: pageUrl,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IssuePage({ params }: PageProps) {
  const { slug } = await params

  const issue: Issue = await sanityClient.fetch<Issue>(
    QUERY_ISSUE_BY_SLUG,
    { slug },
  )

  if (!issue) {
    notFound()
  }

  // Reading time from all editorial body fields (lib/reading-time.ts)
  const minutes = readingTime(
    issue.originStory?.body,
    issue.problemStatement?.body,
    issue.founderBio?.body,
    issue.caseStudy?.body,
    issue.bonus?.body,
  )

  // JSON-LD Article schema (WEB-10)
  const siteUrl = getSiteUrl()
  const jsonLdData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: issue.originStory?.headline ?? issue.charity.name,
    datePublished: issue.publishDate,
    author: {
      '@type': 'Organization',
      name: SITE_AUTHOR,
    },
    about: {
      '@type': 'NGO',
      name: issue.charity.name,
      url: issue.charity.website ?? undefined,
      location: issue.charity.location,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: siteUrl,
    },
  }

  return (
    <article className="pb-0">
      {/* JSON-LD (WEB-10) */}
      <JsonLd data={jsonLdData} />

      {/* 1. IssueHero */}
      <IssueHero
        charity={issue.charity}
        issueNumber={issue.issueNumber}
        publishDate={issue.publishDate}
        readingTimeMinutes={minutes}
        problemPdfUrl={issue.problemPdfUrl}
      />

      {/* 2. Origin story — id="origin-story" */}
      <EditorialSection
        id="origin-story"
        label="ORIGIN STORY"
        headline={issue.originStory?.headline}
        body={issue.originStory?.body}
      />

      {/* 3. Problem statement — id="problem" */}
      <EditorialSection
        id="problem"
        label="THE PROBLEM"
        headline={issue.problemStatement?.headline}
        body={issue.problemStatement?.body}
      />

      {/* 4. Founder bio — id="founder-bio" */}
      <EditorialSection
        id="founder-bio"
        label="FOUNDER BIO"
        headline={issue.founderBio?.headline}
        body={issue.founderBio?.body}
      />

      {/* 5. Case study — id="case-study" */}
      <CaseStudySection
        subjectName={issue.caseStudy?.subjectName}
        headline={issue.caseStudy?.headline}
        body={issue.caseStudy?.body}
      />

      {/* 6. Game slot — id="game" */}
      <GameSlot game={issue.game} runId={issue.runId ?? null} />

      {/* 7. Bonus section — id="bonus" */}
      <BonusSection bonus={issue.bonus} bonusType={issue.bonusType} />

      {/* 8. Deliberation slot — id="deliberation" */}
      <DeliberationSlot />

      {/* 9. Podcast slot — id="podcast" */}
      <PodcastSlot podcast={issue.podcast} />

      {/* 10. Shop callout (no anchor id) */}
      <ShopCallout />
    </article>
  )
}
