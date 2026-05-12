/**
 * GROQ result types. These shapes match the projections in queries.ts
 * (and docs/API_CONTRACTS.md §1).
 *
 * Why hand-written instead of relying on Sanity TypeGen GA?
 *   - Phase 2 ships these types BEFORE running typegen on the new web queries.
 *   - Wave 3 components type-check against these names immediately.
 *   - Once apps/studio's typegen pipeline (Phase 1 Plan 05) is re-pointed at
 *     these queries (Phase 5 or later), we can switch to generated types and
 *     remove this file. Until then, this is the source of TypeScript truth
 *     for what GROQ returns.
 *
 * NOTE: Field names match the GROQ projections, NOT the underlying schema.
 * For example: problemPdfUrl (projected) — NOT problemPdf (schema field).
 *
 * IssueTheme is used by the theme engine (apps/web/lib/theme.ts).
 * Do not rename that export — theme.ts imports it by exact name.
 */
import type { PortableTextBlock } from '@portabletext/react'

// ─── Shared sub-shapes ─────────────────────────────────────────────────────

export type IssueTheme = {
  primaryColor?: string
  accentColor?: string
  backgroundColor?: string
  textColor?: string
  fontDisplay?: string
  fontBody?: string
  visualDirection?: string
} | null

export type BonusType = 'bigBudget' | 'jingle' | 'specAd'

export type CharityRef = {
  name: string
  slug: string
  location: string
}

export type FeaturedInRef = {
  issueNumber: number
  slug: string
  publishDate: string
} | null

// ─── §1.1 — Latest issue slug ──────────────────────────────────────────────

export type LatestIssueSlug = {
  issueNumber: number
  slug: string
} | null

// ─── §1.2 — Full issue ────────────────────────────────────────────────────

export type IssueCharity = {
  name: string
  slug: string
  location: string
  website: string | null
  charityNavigatorUrl: string | null
  foundingYear: number | null
  assetRange: string | null
  focusArea: string | null
  missionStatement: string | null
}

export type IssueSection = {
  headline: string
  body: PortableTextBlock[]
} | null

export type IssueCaseStudy = {
  subjectName: string | null
  headline: string
  body: PortableTextBlock[]
} | null

export type IssueGame = {
  headline: string
  description: string | null
  embedCode: string
} | null

export type IssueBonus = {
  headline: string
  body: PortableTextBlock[] | null
  lyrics: string | null
  sunoPrompt: string | null
  sunoAudioUrl: string | null
  storyboards: Array<{ asset: { url: string } | null }> | null
} | null

export type IssuePodcast = {
  audioUrl: string | null
  podcastDescription: string | null
  duration: number | null
  deliberationTranscript: string | null
} | null

export type IssueDeliberationCandidate = {
  charity: CharityRef | null
  scoutSummary: string | null
  advocateArgument: string | null
  advocateScore: number | null
}

export type IssueDeliberation = {
  candidates: IssueDeliberationCandidate[] | null
  editorDecision: string | null
  runnerUpNotes: string | null
} | null

export type Issue = {
  issueNumber: number
  publishDate: string
  bonusType: BonusType
  runId: string | null
  charity: IssueCharity
  theme: IssueTheme
  originStory: IssueSection
  problemStatement: IssueSection
  problemPdfUrl: string | null
  founderBio: IssueSection
  caseStudy: IssueCaseStudy
  game: IssueGame
  bonus: IssueBonus
  podcast: IssuePodcast
  selectionDeliberation: IssueDeliberation
} | null

// ─── §1.3 — Archive ────────────────────────────────────────────────────────

export type ArchiveIssue = {
  issueNumber: number
  publishDate: string
  slug: string
  bonusType: BonusType
  charity: {
    name: string
    slug: string
    location: string
    focusArea: string | null
    assetRange: string | null
  }
}

// ─── §1.4 — All charities ──────────────────────────────────────────────────

export type CharityListItem = {
  name: string
  slug: string
  location: string
  website: string | null
  foundingYear: number | null
  focusArea: string | null
  assetRange: string | null
  missionStatement: string | null
  featuredIn: FeaturedInRef
}

// ─── §1.5 — Charity detail ────────────────────────────────────────────────

export type CharityDetail = {
  name: string
  slug: string
  location: string
  website: string | null
  charityNavigatorUrl: string | null
  guidestarUrl: string | null
  foundingYear: number | null
  assetRange: string | null
  focusArea: string | null
  missionStatement: string | null
  scoutNotes: string | null
  featuredIn: FeaturedInRef
} | null

// ─── §1.7 — Issue runId (reserved for Phase 9) ────────────────────────────

export type IssueRunId = {
  runId: string | null
} | null
