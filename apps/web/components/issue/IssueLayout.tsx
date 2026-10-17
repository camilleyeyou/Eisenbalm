/**
 * IssueLayout — shared rendering tree for published, home and preview pages.
 *
 * Phase 55: the single source of truth for the Dispatch front page. The
 * published page (`/issue/[slug]`), home (`/`) and the draft-preview route
 * (`/issue/[slug]/preview`) all render this component so they cannot drift
 * (D-09 fidelity). The weekly accent is emitted here via serializeAccentCss;
 * per-issue DesignAgent theming is no longer applied on public pages.
 *
 * Renders NO <main>: the root layout owns the single main#main. Footer is
 * supplied by the root layout (DispatchFooter) outside <main>.
 *
 * Section order (LOCKED — Phase 55 UI-SPEC):
 *   masthead, ticker, hero (#story, the only h1), how strip (#how),
 *   sticky nav, 01 origin, 02 problem, 03 founder, 04 case, 05 game,
 *   06 bonus, 07 delib, 08 pod, buy band (#buy), back issues (#back-issues)
 */
import type { Issue, ArchiveIssue } from '@/lib/sanity/types'
import { readingTime } from '@/lib/reading-time'
import { serializeAccentCss } from '@/lib/brand'
import { BALM_PRICE_CENTS, SITE_NAME, SITE_AUTHOR, getSiteUrl } from '@/lib/site'
import {
  tickerLines,
  heroHeadline,
  heroDek,
  factChips,
  readTimeLabel,
  statTiles,
  caseTimeline,
  pullQuote,
  adSummary,
  deliberationCards,
  editorConfidence,
  impactRange,
  issueDateLabel,
} from '@/lib/dispatch/derive'
import { COUNT_LABEL_CURRENT, COUNT_LABEL_LIFETIME } from '@/lib/dispatch/copy'

import { JsonLd } from '@/components/JsonLd'
import { DispatchMasthead } from '@/components/dispatch/DispatchMasthead'
import { Ticker } from '@/components/dispatch/Ticker'
import { Hero } from '@/components/dispatch/Hero'
import { HowStrip } from '@/components/dispatch/HowStrip'
import { IssueNav } from '@/components/dispatch/IssueNav'
import { OriginSection } from '@/components/dispatch/sections/OriginSection'
import { ProblemSection } from '@/components/dispatch/sections/ProblemSection'
import { FounderSection } from '@/components/dispatch/sections/FounderSection'
import { CaseSection } from '@/components/dispatch/sections/CaseSection'
import { GameSlot } from '@/components/issue/GameSlot'
import { BonusSection } from '@/components/issue/BonusSection'
import { PodcastSlot } from '@/components/issue/PodcastSlot'
import { DelibCards } from '@/components/dispatch/DelibCards'
import { BuyBand } from '@/components/dispatch/BuyBand'
import { BackIssues } from '@/components/dispatch/BackIssues'

interface IssueLayoutProps {
  issue: NonNullable<Issue>
  slug: string
  /** When true, renders a noindex meta tag. Used on the preview route. */
  noindex?: boolean
  /** undefined -> back-issues section omitted (preview). */
  archive?: ArchiveIssue[]
  /** true -> balms counted since publishDate ("this week"); false -> lifetime. */
  isCurrent?: boolean
  /** Server-fetched balms; undefined -> tile hidden until live value arrives. */
  initialBalms?: number
}

export function IssueLayout({
  issue,
  slug: _slug,
  noindex = false,
  archive,
  isCurrent = false,
  initialBalms,
}: IssueLayoutProps) {
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

  const sinceMs = Date.parse(`${issue.publishDate}T00:00:00Z`)
  const impact = impactRange(issue, BALM_PRICE_CENTS)

  return (
    <div className="dispatch">
      <style dangerouslySetInnerHTML={{ __html: serializeAccentCss(issue.issueNumber) }} />
      {jsonLdData && <JsonLd data={jsonLdData} />}
      <DispatchMasthead issueNumber={issue.issueNumber} dateLabel={issueDateLabel(issue.publishDate)} />
      <Ticker lines={tickerLines(issue)} />
      <Hero
        issueNumber={issue.issueNumber}
        charityName={issue.charity.name}
        headline={heroHeadline(issue)}
        dek={heroDek(issue)}
        chips={factChips(issue.charity)}
        readTime={readTimeLabel(minutes)}
        heroImage={issue.frontPage?.heroImage ?? null}
        narrator={issue.narrator ?? null}
      />
      <HowStrip />
      <IssueNav charityName={issue.charity.name} bonusType={issue.bonusType} omit={issue.bonus ? [] : ['bonus']} />
      <OriginSection
        headline={issue.originStory?.headline}
        body={issue.originStory?.body}
        pullQuote={pullQuote(issue, 'origin')}
      />
      <ProblemSection
        headline={issue.problemStatement?.headline}
        body={issue.problemStatement?.body}
        tiles={statTiles(issue)}
        pdfUrl={issue.problemPdfUrl ?? null}
      />
      <FounderSection headline={issue.founderBio?.headline} body={issue.founderBio?.body} />
      <CaseSection
        headline={issue.caseStudy?.headline}
        subjectName={issue.caseStudy?.subjectName}
        body={issue.caseStudy?.body}
        timeline={caseTimeline(issue)}
        pullQuote={pullQuote(issue, 'case')}
      />
      <GameSlot game={issue.game} runId={issue.runId ?? null} />
      <BonusSection bonus={issue.bonus} bonusType={issue.bonusType} adSummary={adSummary(issue)} />
      <DelibCards cards={deliberationCards(issue)} confidence={editorConfidence(issue)} />
      <PodcastSlot podcast={issue.podcast} />
      <BuyBand
        charityName={issue.charity.name}
        charitySlug={issue.charity.slug}
        sinceMs={isCurrent && Number.isFinite(sinceMs) ? sinceMs : undefined}
        countLabel={isCurrent ? COUNT_LABEL_CURRENT : COUNT_LABEL_LIFETIME}
        initialBalms={initialBalms}
        impact={impact}
      />
      {archive && <BackIssues issues={archive} currentIssueNumber={issue.issueNumber} />}
    </div>
  )
}
