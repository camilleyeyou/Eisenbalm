/**
 * IssueLayout — shared rendering tree for published and preview issue pages.
 *
 * This component is the single source of truth for the Phase 19 magazine layout.
 * Both the published page (`/issue/[slug]/page.tsx`) and the draft-preview route
 * (`/issue/[slug]/preview/page.tsx`) import this component so the preview can
 * never drift from what ships (D-09 fidelity, Plan 26-04).
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
 */
import type { Issue } from '@/lib/sanity/types'
import { readingTime } from '@/lib/reading-time'

import { JsonLd } from '@/components/JsonLd'
import { ScrollProgressBar } from '@/components/issue/ScrollProgressBar'
import { SectionRail } from '@/components/issue/SectionRail'
import { IssueMasthead } from '@/components/issue/IssueMasthead'
import { IssueBriefing } from '@/components/issue/IssueBriefing'
import type { StatItem } from '@/components/issue/IssueBriefing'
import { MissionBand } from '@/components/issue/MissionBand'
import { EditorialSection } from '@/components/issue/EditorialSection'
import { CaseStudySection } from '@/components/issue/CaseStudySection'
import { GameSlot } from '@/components/issue/GameSlot'
import { BonusSection } from '@/components/issue/BonusSection'
import { DeliberationSlot } from '@/components/issue/DeliberationSlot'
import { PodcastSlot } from '@/components/issue/PodcastSlot'
import { ShopBand } from '@/components/issue/ShopBand'
import { SITE_NAME, SITE_AUTHOR, getSiteUrl } from '@/lib/site'

interface IssueLayoutProps {
  issue: NonNullable<Issue>
  slug: string
  /** When true, renders a noindex meta tag. Used on the preview route. */
  noindex?: boolean
}

/** Map bonusType to a human-readable label for the TOC. */
function getBonusLabel(bonusType: string): string {
  if (bonusType === 'specAd') return 'Spec Ad'
  if (bonusType === 'jingle') return 'The Jingle'
  return 'Bonus'
}

export function IssueLayout({ issue, slug, noindex = false }: IssueLayoutProps) {
  // Reading time from all editorial body fields
  const minutes = readingTime(
    issue.originStory?.body,
    issue.problemStatement?.body,
    issue.founderBio?.body,
    issue.caseStudy?.body,
    issue.bonus?.body,
  )

  // JSON-LD Article schema (WEB-10) — omitted on preview (noindex) to avoid
  // indexing draft content
  const siteUrl = getSiteUrl()
  const jsonLdData = noindex
    ? null
    : {
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

  // Derive IssueBriefing "At a glance" stats from live charity fields.
  const briefingStats: StatItem[] = []
  if (issue.charity.foundingYear) {
    briefingStats.push({ to: issue.charity.foundingYear, plain: true, label: 'Founded' })
  }
  if (issue.charity.focusArea) {
    briefingStats.push({ text: issue.charity.focusArea, label: 'Focus' })
  }
  if (issue.charity.assetRange) {
    briefingStats.push({ text: issue.charity.assetRange, label: 'Assets' })
  }
  if (issue.charity.location) {
    briefingStats.push({ text: issue.charity.location, label: 'Based in' })
  }

  // Derive deliberation scoreboard candidates.
  const featuredSlug = issue.charity.slug
  const hasEditorDecision = Boolean(issue.selectionDeliberation?.editorDecision)
  const rawCandidates = issue.selectionDeliberation?.candidates ?? []
  const scoreboardCandidates =
    rawCandidates.length > 0
      ? [...rawCandidates]
          .sort((a, b) => {
            const aWin = a.charity?.slug === featuredSlug
            const bWin = b.charity?.slug === featuredSlug
            if (aWin !== bWin) return aWin ? -1 : 1
            return (b.advocateScore ?? 0) - (a.advocateScore ?? 0)
          })
          .map((c, i) => ({
            name: c.charity?.name ?? '',
            location: c.charity?.location ?? '',
            score: c.advocateScore ?? null,
            note: c.advocateArgument ?? c.scoutSummary ?? '',
            winning: i === 0 && hasEditorDecision,
            runnerUp: i === 1,
          }))
      : null

  // Derive IssueBriefing TOC — always the same 8-section order (LOCKED Phase 19 UI-SPEC)
  const briefingToc = [
    { n: '01', name: 'Origin Story',              type: 'Editorial', id: 'origin' },
    { n: '02', name: 'The Problem',               type: 'Analysis',  id: 'problem' },
    { n: '03', name: 'Founder Bio',               type: 'Profile',   id: 'founder' },
    { n: '04', name: 'Case Study',                type: 'Impact',    id: 'case' },
    { n: '05', name: 'The Game',                  type: 'Play',      id: 'game' },
    { n: '06', name: getBonusLabel(issue.bonusType), type: 'Bonus',  id: 'bonus' },
    { n: '07', name: 'Watch the machines decide', type: 'Process',   id: 'delib', must: true },
    { n: '08', name: 'The Podcast',               type: 'Audio',     id: 'pod' },
  ]

  return (
    <article className="pb-0">
      {/* JSON-LD (WEB-10) — only on published pages */}
      {jsonLdData && <JsonLd data={jsonLdData} />}

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
        why={
          issue.charity.missionStatement ??
          `The Dispatch covers nonprofits by throughput and structure. ${issue.charity.name} is featured this issue.`
        }
        stats={briefingStats}
        toc={briefingToc}
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
        pdfUrl={issue.problemPdfUrl ?? undefined}
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
        candidates={scoreboardCandidates}
      />

      {/* 13. Podcast slot — id="pod" */}
      <PodcastSlot podcast={issue.podcast} />

      {/* 14. Shop band — data-shop-callout (CMR-09) */}
      <ShopBand charityName={issue.charity.name} />
    </article>
  )
}
