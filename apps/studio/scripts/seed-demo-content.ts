/**
 * Seeds one stub charity + one stub published weeklyIssue into the
 * configured Sanity dataset, so apps/web Phase 2 routes have something
 * to render during local dev. Mirrors apps/studio/scripts/seed-agents.ts.
 *
 * Run from repo root: `pnpm seed:demo`
 * Or from apps/studio:  `pnpm seed:demo`
 *
 * Idempotent: deterministic _ids + createOrReplace.
 *   _id 'charity-demo-quiet-foundation'  (charity)
 *   _id 'issue-001-demo'                 (weeklyIssue)
 *
 * Required env vars (loaded from apps/studio/.env.local):
 *   SANITY_STUDIO_PROJECT_ID
 *   SANITY_STUDIO_DATASET (defaults to 'production')
 *   SANITY_API_TOKEN
 */
import { createClient } from '@sanity/client'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

type DemoCharity = {
  name: string
  slug: string
  location: string
  website: string
  foundingYear: number
  assetRange: string
  focusArea: string
  missionStatement: string
  scoutNotes: string
}

type DemoIssue = {
  issueNumber: number
  publishDate: string
  status: 'draft' | 'in-review' | 'published'
  bonusType: 'bigBudget' | 'jingle' | 'specAd'
  theme: {
    primaryColor: string
    accentColor: string
    backgroundColor: string
    textColor: string
    fontDisplay: string
    fontBody: string
    visualDirection: string
  }
  originStory: { headline: string; body: string }
  problemStatement: { headline: string; body: string }
  founderBio: { headline: string; body: string }
  caseStudy: { subjectName: string; headline: string; body: string }
  game: { headline: string; description: string; embedCode: string }
  bonus: {
    headline: string
    lyrics: string
    sunoPrompt: string
    sunoAudioUrl: string
  }
  podcast: { podcastDescription: string; deliberationTranscript: string }
  selectionDeliberation: { editorDecision: string; runnerUpNotes: string }
}

type DemoContent = { charity: DemoCharity; issue: DemoIssue }

const __dirname = dirname(fileURLToPath(import.meta.url))
const contentPath = resolve(__dirname, 'demo-content.json')

const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'
const token = process.env.SANITY_API_TOKEN

function fail(message: string): never {
  console.error(`\n✗ seed-demo: ${message}\n`)
  process.exit(1)
}

if (!projectId) {
  fail(
    'Missing SANITY_STUDIO_PROJECT_ID. Run `npx sanity@latest init` ' +
      '(see apps/studio/README.md) and populate apps/studio/.env.local.',
  )
}
if (!token) {
  fail(
    'Missing SANITY_API_TOKEN. Create a write-scoped token at ' +
      'https://www.sanity.io/manage > project > API > Tokens (Editor role) ' +
      'and add it to apps/studio/.env.local as SANITY_API_TOKEN=...',
  )
}

const raw = readFileSync(contentPath, 'utf8')
const content = JSON.parse(raw) as DemoContent

/**
 * Convert a plain-text paragraph to a single Portable Text block.
 * Each block + span needs a unique _key per Sanity Portable Text shape.
 */
function textToPortableTextBlock(text: string): Record<string, unknown> {
  return {
    _type: 'block',
    _key: randomUUID().slice(0, 12),
    style: 'normal',
    markDefs: [],
    children: [
      {
        _type: 'span',
        _key: randomUUID().slice(0, 12),
        text,
        marks: [],
      },
    ],
  }
}

/** Wrap a text string in a single-block Portable Text array. */
function pt(text: string): Record<string, unknown>[] {
  return [textToPortableTextBlock(text)]
}

const CHARITY_ID = 'charity-demo-quiet-foundation'
const ISSUE_ID = 'issue-001-demo'

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2024-01-01',
  useCdn: false,
})

async function main(): Promise<void> {
  console.log(`Seeding demo content into ${projectId}/${dataset}…`)

  // 1. Charity — must exist before the issue references it
  const charityDoc = {
    _id: CHARITY_ID,
    _type: 'charity' as const,
    name: content.charity.name,
    slug: { _type: 'slug' as const, current: content.charity.slug },
    location: content.charity.location,
    website: content.charity.website,
    foundingYear: content.charity.foundingYear,
    assetRange: content.charity.assetRange,
    focusArea: content.charity.focusArea,
    missionStatement: content.charity.missionStatement,
    scoutNotes: content.charity.scoutNotes,
  }
  try {
    await client.createOrReplace(charityDoc)
    console.log(`  ✓ ${CHARITY_ID}`)
  } catch (err) {
    console.error(`  ✗ ${CHARITY_ID}: ${(err as Error).message}`)
    throw err
  }

  // 2. Weekly issue (references the charity by deterministic _id)
  const issueDoc = {
    _id: ISSUE_ID,
    _type: 'weeklyIssue' as const,
    issueNumber: content.issue.issueNumber,
    slug: { _type: 'slug' as const, current: `issue-${content.issue.issueNumber}` },
    publishDate: content.issue.publishDate,
    status: content.issue.status,
    charity: {
      _type: 'reference' as const,
      _ref: CHARITY_ID,
    },
    theme: content.issue.theme,
    bonusType: content.issue.bonusType,
    originStory: {
      headline: content.issue.originStory.headline,
      body: pt(content.issue.originStory.body),
    },
    problemStatement: {
      headline: content.issue.problemStatement.headline,
      body: pt(content.issue.problemStatement.body),
    },
    founderBio: {
      headline: content.issue.founderBio.headline,
      body: pt(content.issue.founderBio.body),
    },
    caseStudy: {
      subjectName: content.issue.caseStudy.subjectName,
      headline: content.issue.caseStudy.headline,
      body: pt(content.issue.caseStudy.body),
    },
    game: {
      headline: content.issue.game.headline,
      description: content.issue.game.description,
      embedCode: content.issue.game.embedCode,
    },
    // Jingle bonus: headline + lyrics + sunoPrompt + empty sunoAudioUrl.
    // The empty sunoAudioUrl exercises the "audio coming soon" empty state
    // in the Plan 02-06 issue route so both player states are testable.
    bonus: {
      headline: content.issue.bonus.headline,
      lyrics: content.issue.bonus.lyrics,
      sunoPrompt: content.issue.bonus.sunoPrompt,
      sunoAudioUrl: content.issue.bonus.sunoAudioUrl || undefined,
    },
    podcast: {
      podcastDescription: content.issue.podcast.podcastDescription,
      deliberationTranscript: content.issue.podcast.deliberationTranscript,
    },
    selectionDeliberation: {
      editorDecision: content.issue.selectionDeliberation.editorDecision,
      runnerUpNotes: content.issue.selectionDeliberation.runnerUpNotes,
    },
    // pipelineMetadata intentionally omitted — Phase 4 populates real values.
    // The Convex deliberation slot renders its empty state for this demo issue.
    //
    // firstFeaturedIn back-reference on the charity is set by the Publisher
    // agent (Phase 6). Wave 3 <CharityCard> handles null featuredIn gracefully.
  }
  try {
    await client.createOrReplace(issueDoc)
    console.log(`  ✓ ${ISSUE_ID}`)
  } catch (err) {
    console.error(`  ✗ ${ISSUE_ID}: ${(err as Error).message}`)
    throw err
  }

  console.log(`\nSeeded 2/2 demo documents.`)
  console.log(`Visit /issue/issue-${content.issue.issueNumber} to render the demo issue.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
