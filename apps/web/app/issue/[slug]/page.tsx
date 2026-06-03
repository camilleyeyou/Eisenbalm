/**
 * Full issue page — Phase 19 Stage A Static Shell.
 * UI-SPEC §/issue/[slug] + §Delivery Stages (Stage A).
 *
 * Requirements: WEB-02, WEB-06, WEB-07, WEB-08, WEB-09, WEB-10, WEB-11,
 *               WEB-14, WEB-15, WEB-16.
 *
 * STAGE A: Renders all 10 sections from a single MOCK_ISSUE object.
 * STAGE B: Plan 05 swaps MOCK_ISSUE → await sanityClient.fetch(QUERY_ISSUE_BY_SLUG)
 *          with a minimal diff (only the data source changes — structure/motion frozen).
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
 *  12. Deliberation stub  placeholder    (id="delib", Plan 03 fills)
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

import { sanityClient } from '@/lib/sanity/client'
import { QUERY_ISSUE_BY_SLUG } from '@/lib/sanity/queries'
import type { Issue, IssueSection, IssueCaseStudy, IssueGame, IssueBonus, IssuePodcast, IssueDeliberation } from '@/lib/sanity/types'
import { readingTime } from '@/lib/reading-time'
import { SITE_NAME, SITE_AUTHOR, getSiteUrl } from '@/lib/site'

import { JsonLd } from '@/components/JsonLd'
import { ScrollProgressBar } from '@/components/issue/ScrollProgressBar'
import { SectionRail } from '@/components/issue/SectionRail'
import { IssueMasthead } from '@/components/issue/IssueMasthead'
import { IssueBriefing } from '@/components/issue/IssueBriefing'
import { MissionBand } from '@/components/issue/MissionBand'
import { EditorialSection } from '@/components/issue/EditorialSection'
import { CaseStudySection } from '@/components/issue/CaseStudySection'
import { GameSlot } from '@/components/issue/GameSlot'
import { BonusSection } from '@/components/issue/BonusSection'
import { DeliberationSlot } from '@/components/issue/DeliberationSlot'
import { PodcastSlot } from '@/components/issue/PodcastSlot'
import { ShopBand } from '@/components/issue/ShopBand'
import { groq } from 'next-sanity'

// ─── ISR revalidation (CONTEXT.md D-02) ──────────────────────────────────────

export const revalidate = 60

// ─── MOCK_ISSUE — Stage A static data ────────────────────────────────────────
// Populated from the "Puppies Behind Bars" prototype (19-PROTOTYPE.html).
// Stage B (Plan 05) replaces this with a live GROQ fetch — minimal diff.

const MOCK_ORIGIN: IssueSection = {
  headline: 'A Prison That Trains Dogs for Freedom',
  body: [
    {
      _type: 'block',
      _key: 'origin-p1',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'origin-p1-s1',
          text: 'In 1997, a woman named Gloria Gilbert Stoga walked into a maximum-security prison with an unusual proposition: let the inmates raise Labrador retrievers. The Bureau of Prisons said yes. Nobody expected what happened next.',
          marks: [],
        },
      ],
    },
    {
      _type: 'block',
      _key: 'origin-pq',
      style: 'blockquote',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'origin-pq-s1',
          text: 'The program did not begin as a charity. It began as a hypothesis about what happens to a person who is responsible for another living thing.',
          marks: [],
        },
      ],
    },
    {
      _type: 'block',
      _key: 'origin-p2',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'origin-p2-s1',
          text: 'The dogs — selected for temperament and trained over eighteen months — would go on to serve as service animals for veterans with PTSD and civilians with physical disabilities. The trainers, serving sentences that measured in decades, found in the work something they had not expected to find: accountability without punishment, progress without parole.',
          marks: [],
        },
      ],
    },
  ],
}

const MOCK_PROBLEM: IssueSection = {
  headline: 'Two Systems That Have Run Out of Solutions',
  body: [
    {
      _type: 'block',
      _key: 'prob-p1',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'prob-p1-s1',
          text: 'The United States trains approximately twenty-two thousand service dogs per year. The demand, by conservative estimates, is four times that number. The waiting list for a fully trained psychiatric service dog runs three to five years.',
          marks: [],
        },
      ],
    },
    {
      _type: 'block',
      _key: 'prob-pq',
      style: 'blockquote',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'prob-pq-s1',
          text: 'The bottleneck is not resources. The bottleneck is labor — specifically, the sustained, patient, repeatable labor of training.',
          marks: [],
        },
      ],
    },
    {
      _type: 'block',
      _key: 'prob-p2',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'prob-p2-s1',
          text: 'Meanwhile, the United States incarcerates 2.1 million people. Recidivism rates hover near 67% within three years of release. The system has not, by any measure, solved the problem it was designed to solve.',
          marks: [],
        },
      ],
    },
  ],
}

const MOCK_FOUNDER: IssueSection = {
  headline: 'Gloria Gilbert Stoga Did Not Ask Permission Twice',
  body: [
    {
      _type: 'block',
      _key: 'found-p1',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'found-p1-s1',
          text: 'Before founding Puppies Behind Bars, Gloria Gilbert Stoga spent twenty years in corporate America managing large-scale logistics operations. She understood throughput. She understood system constraints. When she encountered the service-dog shortage, she saw it the way an engineer sees a supply chain problem: as a question of matching underutilized capacity to unmet demand.',
          marks: [],
        },
      ],
    },
    {
      _type: 'block',
      _key: 'found-pq',
      style: 'blockquote',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'found-pq-s1',
          text: 'She did not ask whether prison inmates could train service dogs. She asked what evidence would exist if they could not.',
          marks: [],
        },
      ],
    },
    {
      _type: 'block',
      _key: 'found-p2',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'found-p2-s1',
          text: 'The evidence, it turned out, pointed the other direction. The Bureau of Prisons approved the pilot. The first cohort of trainers placed eleven dogs. The program has since placed over one thousand.',
          marks: [],
        },
      ],
    },
  ],
}

const MOCK_CASE: IssueCaseStudy = {
  subjectName: 'Marcus T., Trainer, FCI Cumberland',
  headline: 'Seventeen Months, One Dog, One Deployment',
  body: [
    {
      _type: 'block',
      _key: 'case-p1',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'case-p1-s1',
          text: 'Marcus entered the Puppies Behind Bars program four years into a twelve-year sentence. He was assigned a yellow Labrador named Sergeant. Over seventeen months, he trained Sergeant to perform seventy-two discrete commands, including psychiatric interrupt behaviors for night terror response.',
          marks: [],
        },
      ],
    },
    {
      _type: 'block',
      _key: 'case-pq',
      style: 'blockquote',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'case-pq-s1',
          text: 'Sergeant was placed with a Marine veteran in 2022. Marcus was released in 2023. He has not reoffended.',
          marks: [],
        },
      ],
    },
  ],
}

const MOCK_GAME: IssueGame = {
  headline: 'The Training Protocol',
  description: 'Match each command to the correct behavioral outcome. All dogs respond differently.',
  embedCode: '<h2 style="text-align:center;font-family:Georgia,serif;margin-top:40px">Game loading...</h2>',
}

const MOCK_BONUS: IssueBonus = {
  headline: 'Puppies Behind Bars: A Spec Campaign',
  body: [
    {
      _type: 'block',
      _key: 'bonus-p1',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'bonus-p1-s1',
          text: 'The brief: a national awareness campaign for a program that does not advertise. The constraint: the audience already believes prisons do not work. The ask: change nothing about what they believe — change what they notice.',
          marks: [],
        },
      ],
    },
    {
      _type: 'block',
      _key: 'bonus-p2',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'bonus-p2-s1',
          text: 'Campaign concept: SIT/STAY. A series of portraits pairing the trainer and the dog at the moment of transfer — the last photograph before the dog ships out. No copy. No statistics. The image is the argument.',
          marks: [],
        },
      ],
    },
  ],
  lyrics: null,
  sunoPrompt: null,
  sunoAudioUrl: null,
  storyboards: null,
}

const MOCK_PODCAST: IssuePodcast = {
  audioUrl: null,
  podcastDescription: 'A twenty-minute deep dive into the Puppies Behind Bars model — how a prison became one of the most efficient service-dog training operations in the country.',
  duration: null,
  deliberationTranscript: null,
}

const MOCK_DELIBERATION: IssueDeliberation = {
  candidates: [
    {
      charity: { name: 'Puppies Behind Bars', slug: 'puppies-behind-bars', location: 'New York, NY' },
      scoutSummary: 'Dual-output model: service dogs for veterans + rehabilitation for trainers. 27 years operating. 1,000+ placements.',
      advocateArgument: 'The marginal dollar here produces a marginal placement. That is a measurable output in a field defined by waiting lists.',
      advocateScore: 9,
    },
    {
      charity: { name: 'Prison Scholar Fund', slug: 'prison-scholar-fund', location: 'Los Angeles, CA' },
      scoutSummary: 'Higher-education access for incarcerated individuals. Focuses on Pell Grant restoration and college-in-prison programs.',
      advocateArgument: 'High leverage on policy change, but output measurement is diffuse. Hard to track marginal dollar to marginal outcome.',
      advocateScore: 7,
    },
  ],
  editorDecision: 'Puppies Behind Bars selected. Clear dual-output model, verifiable placements, no vanity metrics.',
  runnerUpNotes: 'Prison Scholar Fund noted for future issue — policy leverage story warranted.',
  conversation: [
    { speaker: 'scout', text: 'Three candidates surfaced. Puppies Behind Bars leads on trackable output — 1,000+ placements across 27 years, six active facilities.' },
    { speaker: 'advocate', text: 'The dual-output model is the story. One program solves two institutional failures simultaneously. The marginal dollar here produces a marginal placement, not a marginal awareness metric.' },
    { speaker: 'editor', text: 'Agreed. We cover nonprofits by throughput and structure. This one has both. Puppies Behind Bars. Send it.' },
  ],
}

const MOCK_ISSUE: Issue = {
  issueNumber: 999,
  publishDate: 'May 30, 2026',
  bonusType: 'specAd',
  runId: null,
  charity: {
    name: 'Puppies Behind Bars',
    slug: 'puppies-behind-bars',
    location: 'New York, NY',
    website: 'https://www.puppiesbehindbars.com',
    charityNavigatorUrl: null,
    foundingYear: 1997,
    assetRange: '$10M–$25M',
    focusArea: 'Criminal Justice Reform + Veteran Services',
    missionStatement: 'Trains incarcerated individuals to raise service dogs for veterans with PTSD and people with disabilities.',
  },
  theme: null,
  originStory: MOCK_ORIGIN,
  problemStatement: MOCK_PROBLEM,
  problemPdfUrl: null,
  founderBio: MOCK_FOUNDER,
  caseStudy: MOCK_CASE,
  game: MOCK_GAME,
  bonus: MOCK_BONUS,
  podcast: MOCK_PODCAST,
  selectionDeliberation: MOCK_DELIBERATION,
}

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
    // Fall through — metadata will use MOCK_ISSUE defaults
  }

  const activeIssue = issue ?? MOCK_ISSUE
  if (!activeIssue) {
    return { title: 'Issue not found' }
  }

  const charityName = activeIssue.charity.name
  const pageTitle = charityName
  const description = activeIssue.charity.missionStatement?.slice(0, 160) ?? SITE_NAME
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
      publishedTime: activeIssue.publishDate,
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
  // Stage A: params.slug is read but RENDER uses MOCK_ISSUE.
  // Stage B (Plan 05): replace MOCK_ISSUE with live fetch.
  const { slug } = await params

  // Metadata fetch still attempts live data for SEO accuracy in Stage A.
  // Render body uses MOCK_ISSUE regardless.
  void slug // consumed by generateMetadata; Stage B wires this to fetch

  const issue = MOCK_ISSUE

  if (!issue) {
    notFound()
  }

  // Reading time from all editorial body fields
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
    author: { '@type': 'Organization', name: SITE_AUTHOR },
    about: {
      '@type': 'NGO',
      name: issue.charity.name,
      url: issue.charity.website ?? undefined,
      location: issue.charity.location,
    },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: siteUrl },
  }

  return (
    <article className="pb-0">
      {/* JSON-LD (WEB-10) */}
      <JsonLd data={jsonLdData} />

      {/* 1. Fixed scroll progress bar (framer-motion useScroll) */}
      <ScrollProgressBar />

      {/* 2. Fixed left scroll-spy rail — role=navigation, hidden <980px */}
      <SectionRail />

      {/* 3. Masthead — dateline / h1 / tagline */}
      <IssueMasthead
        issueNumber={issue.issueNumber}
        charityName={issue.charity.name}
        tagline={issue.charity.missionStatement ?? ''}
        publishDate={issue.publishDate}
        readingTimeMinutes={minutes}
      />

      {/* 4. Three-column briefing — why / at-a-glance stats / what's inside */}
      <IssueBriefing
        why="The Dispatch covers nonprofits the way a trade journal covers firms — by throughput and structure. Puppies Behind Bars runs two production lines inside one frame: rehabilitation for incarcerated trainers, and trained service dogs for those who need them. The marginal dollar produces a marginal placement. That is the standard the Dispatch applies."
        stats={[
          { to: 1997, plain: true,  label: 'Founded' },
          { to: 1000, suffix: '+',   label: 'Dogs placed' },
          { to: 6,                   label: 'Facilities' },
          { to: 27,   suffix: 'yr',  label: 'Operating' },
        ]}
        toc={[
          { n: '01', name: 'Origin Story',              type: 'Editorial', id: 'origin' },
          { n: '02', name: 'The Problem',               type: 'Analysis',  id: 'problem' },
          { n: '03', name: 'Founder Bio',               type: 'Profile',   id: 'founder' },
          { n: '04', name: 'Case Study',                type: 'Impact',    id: 'case' },
          { n: '05', name: 'The Game',                  type: 'Play',      id: 'game' },
          { n: '06', name: 'Spec Ad',                   type: 'Bonus',     id: 'bonus' },
          { n: '07', name: 'Watch the machines decide', type: 'Process',   id: 'delib', must: true },
          { n: '08', name: 'The Podcast',               type: 'Audio',     id: 'pod' },
        ]}
      />

      {/* 5. Mission band — sitewide constant dark strip */}
      <MissionBand />

      {/* 6. Origin story — id="origin", lead drop cap */}
      <EditorialSection
        id="origin"
        label="ORIGIN STORY"
        headline={issue.originStory?.headline}
        body={issue.originStory?.body}
        lead
      />

      {/* 7. Problem statement — id="problem", lead drop cap */}
      <EditorialSection
        id="problem"
        label="THE PROBLEM"
        headline={issue.problemStatement?.headline}
        body={issue.problemStatement?.body}
        lead
      />

      {/* 8. Founder bio — id="founder", lead drop cap */}
      <EditorialSection
        id="founder"
        label="FOUNDER BIO"
        headline={issue.founderBio?.headline}
        body={issue.founderBio?.body}
        lead
      />

      {/* 9. Case study — id="case", lead drop cap */}
      <CaseStudySection
        subjectName={issue.caseStudy?.subjectName}
        headline={issue.caseStudy?.headline}
        body={issue.caseStudy?.body}
      />

      {/* 10. Game slot — id="game" */}
      <GameSlot game={issue.game} runId={issue.runId ?? null} />

      {/* 11. Bonus section — id="bonus" */}
      <BonusSection bonus={issue.bonus} bonusType={issue.bonusType} />

      {/* 12. Deliberation dark-band centerpiece — Phase 19 Plan 03 */}
      <DeliberationSlot
        runId={issue.runId ?? null}
        conversation={
          (issue.selectionDeliberation?.conversation ?? null) as
            Array<{ speaker: 'scout' | 'advocate' | 'editor'; text: string }> | null
        }
        candidates={
          issue.selectionDeliberation?.candidates?.map((c, i) => ({
            name: c.charity?.name ?? '',
            location: c.charity?.location ?? '',
            score: c.advocateScore ?? null,
            note: c.advocateArgument ?? '',
            // Candidate order: index 0 = winner (highest score), index 1 = runner-up.
            // Stage B (Plan 05): live Convex data may reorder; field wins over position.
            winning: i === 0 && Boolean(issue.selectionDeliberation?.editorDecision),
            runnerUp: i === 1,
          })) ?? null
        }
      />

      {/* 13. Podcast slot — id="pod" */}
      <PodcastSlot podcast={issue.podcast} />

      {/* 14. Shop band — data-shop-callout (CMR-09) */}
      <ShopBand charityName={issue.charity.name} />
    </article>
  )
}
