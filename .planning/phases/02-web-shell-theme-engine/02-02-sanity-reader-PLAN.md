---
phase: 02-web-shell-theme-engine
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/lib/sanity/client.ts
  - apps/web/lib/sanity/queries.ts
  - apps/web/lib/sanity/image.ts
  - apps/web/lib/sanity/types.ts
autonomous: true
requirements: [WEB-01, WEB-02, WEB-03, WEB-04]
must_haves:
  truths:
    - "Sanity GROQ reads use the canonical queries from docs/API_CONTRACTS.md §1.1-§1.5 verbatim"
    - "Two clients exist: runtime (useCdn: true) and build-time/Publisher (useCdn: false)"
    - "Each query exports a typed result so route components consume Sanity data with full type safety"
    - "Image URL builder is available at apps/web/lib/sanity/image.ts"
  artifacts:
    - path: apps/web/lib/sanity/client.ts
      provides: "sanityClient (useCdn: true) + sanityBuildClient (useCdn: false) factories"
      exports: ["sanityClient", "sanityBuildClient", "SANITY_PROJECT_ID", "SANITY_DATASET", "SANITY_API_VERSION"]
    - path: apps/web/lib/sanity/queries.ts
      provides: "All 5 GROQ queries from API_CONTRACTS §1.1-§1.5, plus QUERY_ISSUE_RUN_ID and result types"
      exports: ["QUERY_LATEST_ISSUE_SLUG", "QUERY_ISSUE_BY_SLUG", "QUERY_ARCHIVE", "QUERY_ALL_CHARITIES", "QUERY_CHARITY_BY_SLUG", "QUERY_ISSUE_RUN_ID"]
    - path: apps/web/lib/sanity/image.ts
      provides: "urlFor(source) helper using @sanity/image-url"
      exports: ["urlFor"]
    - path: apps/web/lib/sanity/types.ts
      provides: "GROQ result types (LatestIssueSlug, Issue, ArchiveIssue, CharityListItem, CharityDetail)"
  key_links:
    - from: apps/web/lib/sanity/client.ts
      to: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
      via: "createClient call"
      pattern: "createClient\\(\\s*\\{[^}]*projectId"
    - from: apps/web/lib/sanity/queries.ts
      to: docs/API_CONTRACTS.md §1
      via: "verbatim GROQ strings"
      pattern: "_type == \"weeklyIssue\""
---

<objective>
Stand up the Sanity reader plumbing for `apps/web`: a runtime client (`useCdn: true`), a build-time/Publisher client (`useCdn: false`), the canonical GROQ queries from `docs/API_CONTRACTS.md §1.1-§1.7` (verbatim — these are LOCKED by CLAUDE.md "do not invent field names" rule), the `urlFor()` image helper, and the TypeScript result types that route components in Wave 3 will consume.

Purpose: Centralize all Sanity access behind a single module so theme injection (Plan 02-03), routes (Wave 3 plans 06-09), and SEO route handlers (Plan 02-10) all consume the same typed query interface. The split-client pattern (D-14) is encoded now so Phase 6's Publisher webhook reads via `useCdn: false` without code change.
Output: `apps/web/lib/sanity/{client,queries,image,types}.ts` — fully typed, ready for Wave 2 onwards.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/02-web-shell-theme-engine/02-CONTEXT.md
@.planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md
@docs/API_CONTRACTS.md
@CLAUDE.md
@apps/studio/schemas/charity.ts
@apps/studio/schemas/weeklyIssue.ts
@apps/studio/sanity.types.ts
@packages/shared/src/sanity-types.ts

<interfaces>
<!-- CANONICAL GROQ queries — copy VERBATIM from docs/API_CONTRACTS.md §1.1-§1.7. -->
<!-- DO NOT modify field names. DO NOT add fields. DO NOT remove projections. -->
<!-- CLAUDE.md rule: "do not modify field names without checking API_CONTRACTS.md first" -->

Schema fields the GROQ queries depend on (from apps/studio/schemas/):
- charity.ts: name, slug, location, website, charityNavigatorUrl, guidestarUrl,
  foundingYear, assetRange, focusArea, missionStatement, scoutNotes, firstFeaturedIn
- weeklyIssue.ts: issueNumber, slug, publishDate, status (draft|in-review|published),
  charity (reference), theme.{primaryColor, accentColor, backgroundColor, textColor,
  fontDisplay, fontBody, visualDirection}, bonusType (bigBudget|jingle|specAd),
  originStory.{headline,body}, problemStatement.{headline,body}, problemPdf (file),
  founderBio.{headline,body}, caseStudy.{subjectName,headline,body},
  game.{headline,description,embedCode}, bonus.{headline,body,lyrics,sunoPrompt,
  sunoAudioUrl,storyboards[]}, podcast.{audioFile,deliberationTranscript,
  podcastDescription,duration}, selectionDeliberation.{candidates[],editorDecision,
  runnerUpNotes}, pipelineMetadata.{runId,startedAt,completedAt,modelVersions}

Generated TypeScript types from apps/studio/sanity.types.ts (re-exported via
@eisenbalm/shared):
- type Charity, WeeklyIssue, AgentProfile, Slug, SanityImageAssetReference,
  SanityFileAssetReference, CharityReference

GROQ projections rename certain fields (do NOT change these names — Wave 3 components
reference them):
- weeklyIssue.problemPdf → projected as "problemPdfUrl" (problemPdf.asset->url)
- weeklyIssue.podcast.audioFile → projected as "audioUrl" inside podcast object
- charity.firstFeaturedIn → projected as "featuredIn" in QUERY_ALL_CHARITIES and QUERY_CHARITY_BY_SLUG
- weeklyIssue.charity (reference) → resolved with charity-> projection
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create apps/web/lib/sanity/client.ts with runtime + build-time clients</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-CONTEXT.md (D-02, D-13, D-14, D-15)
    - .planning/research/STACK.md ("@sanity/client 7.22.0", "next-sanity version note")
    - docs/API_CONTRACTS.md §1 preamble (`useCDN: true for reads`)
  </read_first>
  <files>apps/web/lib/sanity/client.ts</files>
  <action>
    Create `apps/web/lib/sanity/client.ts`:

    ```typescript
    /**
     * Sanity client factory.
     *
     * Two clients per CONTEXT.md D-14:
     *   - sanityClient: runtime reads (useCdn: true) for fast, cached editorial reads.
     *   - sanityBuildClient: build-time / Publisher webhook context (useCdn: false)
     *     so freshly-published content bypasses the Sanity CDN.
     *
     * Phase 6's Publisher webhook (Sanity → Railway) will import sanityBuildClient
     * to read the just-published issue for PDF generation.
     */
    import { createClient, type SanityClient } from '@sanity/client'

    export const SANITY_PROJECT_ID =
      process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? ''
    export const SANITY_DATASET =
      process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
    // Pin api version — bump only after testing GROQ behavior on new dates.
    export const SANITY_API_VERSION = '2024-01-01'

    if (!SANITY_PROJECT_ID) {
      // Fast-fail at module load so misconfiguration surfaces early.
      // Mirrors the pattern landed in apps/studio/sanity.config.ts (Phase 1).
      // Use console.error rather than throw so build/dev still surfaces the
      // error message to the developer without crashing the whole Next.js
      // server on a transient missing env (e.g. preview environments).
      console.error(
        '[sanity/client] NEXT_PUBLIC_SANITY_PROJECT_ID is not set. ' +
          'Copy apps/web/.env.example to apps/web/.env.local and fill in the project ID.',
      )
    }

    /**
     * Runtime client — used by all RSC page components and Route Handlers
     * (sitemap.xml, feed.xml). CDN-cached for low-latency reads.
     */
    export const sanityClient: SanityClient = createClient({
      projectId: SANITY_PROJECT_ID,
      dataset: SANITY_DATASET,
      apiVersion: SANITY_API_VERSION,
      useCdn: true,
      perspective: 'published',
    })

    /**
     * Build-time / Publisher webhook client — bypasses CDN. Use only when
     * freshness matters more than latency (Phase 6 PDF generation, build-time
     * static generation if we discover CDN propagation race issues).
     */
    export const sanityBuildClient: SanityClient = createClient({
      projectId: SANITY_PROJECT_ID,
      dataset: SANITY_DATASET,
      apiVersion: SANITY_API_VERSION,
      useCdn: false,
      perspective: 'published',
    })
    ```

    Notes:
    - `perspective: 'published'` ensures GROQ queries never return drafts. Andrew's `status: 'published'` filter in the queries is belt-and-suspenders.
    - We do NOT use `defineLive` from `next-sanity` in Phase 2 — CONTEXT.md D-16 keeps Convex out of Phase 2; `defineLive` and ISR tag wiring is deferred until Phase 9 (deliberation layer) since that's where live updates matter.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/lib/sanity/client.ts && \
      grep -q "useCdn: true" apps/web/lib/sanity/client.ts && \
      grep -q "useCdn: false" apps/web/lib/sanity/client.ts && \
      grep -q "export const sanityClient" apps/web/lib/sanity/client.ts && \
      grep -q "export const sanityBuildClient" apps/web/lib/sanity/client.ts && \
      grep -q "NEXT_PUBLIC_SANITY_PROJECT_ID" apps/web/lib/sanity/client.ts && \
      grep -q "perspective: 'published'" apps/web/lib/sanity/client.ts
    </automated>
  </verify>
  <done>
    `sanityClient` (CDN-on) and `sanityBuildClient` (CDN-off) both export from `apps/web/lib/sanity/client.ts`. Constants (project ID, dataset, API version) are exported for reuse by sitemap/feed. Missing env var produces a console.error.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create apps/web/lib/sanity/queries.ts with all 6 canonical GROQ queries</name>
  <read_first>
    - docs/API_CONTRACTS.md §1.1 through §1.7 (THE SOURCE OF TRUTH — copy verbatim)
    - apps/studio/schemas/weeklyIssue.ts (field reference)
    - apps/studio/schemas/charity.ts (field reference)
    - CLAUDE.md ("do not modify field names")
  </read_first>
  <files>apps/web/lib/sanity/queries.ts</files>
  <action>
    Create `apps/web/lib/sanity/queries.ts`. Copy each GROQ string VERBATIM from `docs/API_CONTRACTS.md §1.1-§1.5` and §1.7. Use `groq` template tag from `next-sanity` so IDE syntax highlighting + Sanity TypeGen (Phase 1 wired) can pick them up.

    ```typescript
    /**
     * Canonical GROQ queries. Source of truth: docs/API_CONTRACTS.md §1.
     * DO NOT modify field names or projections — CLAUDE.md rule.
     */
    import { groq } from 'next-sanity'

    /**
     * §1.1 — Latest published issue (homepage redirect target).
     */
    export const QUERY_LATEST_ISSUE_SLUG = groq`
      *[_type == "weeklyIssue" && status == "published"]
      | order(issueNumber desc)[0] {
        issueNumber,
        "slug": slug.current
      }
    `

    /**
     * §1.2 — Full issue by slug. Used by /issue/[slug].
     */
    export const QUERY_ISSUE_BY_SLUG = groq`
      *[_type == "weeklyIssue" && slug.current == $slug && status == "published"][0] {
        issueNumber,
        publishDate,
        bonusType,
        "runId": pipelineMetadata.runId,

        charity-> {
          name,
          "slug": slug.current,
          location,
          website,
          charityNavigatorUrl,
          foundingYear,
          assetRange,
          focusArea,
          missionStatement,
        },

        theme {
          primaryColor,
          accentColor,
          backgroundColor,
          textColor,
          fontDisplay,
          fontBody,
          visualDirection,
        },

        originStory { headline, body },
        problemStatement { headline, body },
        "problemPdfUrl": problemPdf.asset->url,

        founderBio { headline, body },

        caseStudy {
          subjectName,
          headline,
          body,
        },

        game {
          headline,
          description,
          embedCode,
        },

        bonus {
          headline,
          body,
          lyrics,
          sunoPrompt,
          sunoAudioUrl,
          storyboards[] { asset->{ url } },
        },

        podcast {
          "audioUrl": audioFile.asset->url,
          podcastDescription,
          duration,
          deliberationTranscript,
        },

        selectionDeliberation {
          candidates[] {
            charity->{ name, "slug": slug.current, location },
            scoutSummary,
            advocateArgument,
            advocateScore,
          },
          editorDecision,
          runnerUpNotes,
        },
      }
    `

    /**
     * §1.3 — Archive: all published issues, newest first.
     */
    export const QUERY_ARCHIVE = groq`
      *[_type == "weeklyIssue" && status == "published"]
      | order(issueNumber desc) {
        issueNumber,
        publishDate,
        "slug": slug.current,
        bonusType,
        charity-> {
          name,
          "slug": slug.current,
          location,
          focusArea,
          assetRange,
        },
      }
    `

    /**
     * §1.4 — Charity database: all charities, alphabetical.
     * Note: firstFeaturedIn (schema field) is projected as "featuredIn" in result.
     */
    export const QUERY_ALL_CHARITIES = groq`
      *[_type == "charity"] | order(name asc) {
        name,
        "slug": slug.current,
        location,
        website,
        foundingYear,
        focusArea,
        assetRange,
        missionStatement,
        "featuredIn": firstFeaturedIn-> {
          issueNumber,
          "slug": slug.current,
          publishDate,
        },
      }
    `

    /**
     * §1.5 — Single charity by slug.
     * Note: firstFeaturedIn (schema field) is projected as "featuredIn" in result.
     */
    export const QUERY_CHARITY_BY_SLUG = groq`
      *[_type == "charity" && slug.current == $slug][0] {
        name,
        "slug": slug.current,
        location,
        website,
        charityNavigatorUrl,
        guidestarUrl,
        foundingYear,
        assetRange,
        focusArea,
        missionStatement,
        scoutNotes,
        "featuredIn": firstFeaturedIn-> {
          issueNumber,
          "slug": slug.current,
          publishDate,
        },
      }
    `

    /**
     * §1.7 — Issue runId only (for Phase 9 Convex subscriptions; reserved here).
     */
    export const QUERY_ISSUE_RUN_ID = groq`
      *[_type == "weeklyIssue" && slug.current == $slug][0] {
        "runId": pipelineMetadata.runId,
      }
    `
    ```

    DO NOT include `QUERY_AGENT_PROFILES` from §1.6 — that's a Phase 9 (deliberation layer) concern; reserving it in queries.ts now would add unused code.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/lib/sanity/queries.ts && \
      grep -q "QUERY_LATEST_ISSUE_SLUG" apps/web/lib/sanity/queries.ts && \
      grep -q "QUERY_ISSUE_BY_SLUG" apps/web/lib/sanity/queries.ts && \
      grep -q "QUERY_ARCHIVE" apps/web/lib/sanity/queries.ts && \
      grep -q "QUERY_ALL_CHARITIES" apps/web/lib/sanity/queries.ts && \
      grep -q "QUERY_CHARITY_BY_SLUG" apps/web/lib/sanity/queries.ts && \
      grep -q "QUERY_ISSUE_RUN_ID" apps/web/lib/sanity/queries.ts && \
      grep -q 'order(issueNumber desc)' apps/web/lib/sanity/queries.ts && \
      grep -q 'order(name asc)' apps/web/lib/sanity/queries.ts && \
      grep -q 'problemPdfUrl' apps/web/lib/sanity/queries.ts && \
      grep -q '"audioUrl"' apps/web/lib/sanity/queries.ts && \
      grep -q '"featuredIn"' apps/web/lib/sanity/queries.ts && \
      grep -q 'pipelineMetadata.runId' apps/web/lib/sanity/queries.ts && \
      grep -q 'selectionDeliberation' apps/web/lib/sanity/queries.ts && \
      grep -q 'charityNavigatorUrl' apps/web/lib/sanity/queries.ts && \
      grep -q 'guidestarUrl' apps/web/lib/sanity/queries.ts
    </automated>
  </verify>
  <done>
    All six GROQ queries from API_CONTRACTS.md (§1.1, §1.2, §1.3, §1.4, §1.5, §1.7) are exported as `groq`-tagged template literals, byte-for-byte matching the contract. No fields invented or renamed.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create apps/web/lib/sanity/types.ts with GROQ result types</name>
  <read_first>
    - docs/API_CONTRACTS.md §1 (return-type definitions)
    - apps/studio/sanity.types.ts (base Sanity types)
    - packages/shared/src/sanity-types.ts (re-export point)
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §"Component Inventory" (fields each component reads)
  </read_first>
  <files>apps/web/lib/sanity/types.ts</files>
  <action>
    Create `apps/web/lib/sanity/types.ts`. These are hand-written GROQ result types that match the projections (since Sanity TypeGen GA generates types from schemas + queries, but for clarity and to avoid running typegen on every query edit, we hand-write the result types alongside the queries):

    ```typescript
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
    ```

    These types stay in `apps/web/lib/sanity/types.ts` rather than `packages/shared/` because they are GROQ result shapes specific to the web app's queries. The pipeline (Phase 4) writes RAW schema shapes (via `WeeklyIssue`, `Charity` from `@eisenbalm/shared`) — different concern.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/lib/sanity/types.ts && \
      grep -q "export type LatestIssueSlug" apps/web/lib/sanity/types.ts && \
      grep -q "export type Issue" apps/web/lib/sanity/types.ts && \
      grep -q "export type ArchiveIssue" apps/web/lib/sanity/types.ts && \
      grep -q "export type CharityListItem" apps/web/lib/sanity/types.ts && \
      grep -q "export type CharityDetail" apps/web/lib/sanity/types.ts && \
      grep -q "export type IssueTheme" apps/web/lib/sanity/types.ts && \
      grep -q "export type BonusType" apps/web/lib/sanity/types.ts && \
      grep -q "problemPdfUrl" apps/web/lib/sanity/types.ts && \
      grep -q "audioUrl" apps/web/lib/sanity/types.ts && \
      grep -q "featuredIn" apps/web/lib/sanity/types.ts && \
      grep -q "PortableTextBlock" apps/web/lib/sanity/types.ts && \
      grep -q "'bigBudget' | 'jingle' | 'specAd'" apps/web/lib/sanity/types.ts
    </automated>
  </verify>
  <done>
    All six GROQ result types exist with field names matching the projections (problemPdfUrl, audioUrl, featuredIn — not the underlying schema names). BonusType is the canonical 3-variant union. PortableTextBlock is imported from @portabletext/react for body fields.
  </done>
</task>

<task type="auto">
  <name>Task 4: Create apps/web/lib/sanity/image.ts with urlFor helper</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-CONTEXT.md (D-03)
    - apps/web/next.config.ts (cdn.sanity.io whitelist — set in Plan 02-01)
  </read_first>
  <files>apps/web/lib/sanity/image.ts</files>
  <action>
    Create `apps/web/lib/sanity/image.ts`:

    ```typescript
    /**
     * Sanity image URL builder.
     * Per CONTEXT.md D-03: @sanity/image-url + next/image for optimization.
     *
     * Phase 2 uses this for:
     *   - <ShopShell> product imagery (if Andrew adds product images later)
     *   - <CharityCard> optional charity logo display
     * Phase 9 will use it for agent avatars (agentProfile.avatar).
     */
    import imageUrlBuilder from '@sanity/image-url'
    import type { SanityImageSource } from '@sanity/image-url/lib/types/types'
    import { sanityClient } from './client'

    const builder = imageUrlBuilder(sanityClient)

    /**
     * Build a Sanity image URL.
     * Usage:
     *   <img src={urlFor(charity.image).width(800).url()} alt={charity.name} />
     */
    export function urlFor(source: SanityImageSource) {
      return builder.image(source)
    }
    ```
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/lib/sanity/image.ts && \
      grep -q "import imageUrlBuilder from '@sanity/image-url'" apps/web/lib/sanity/image.ts && \
      grep -q "export function urlFor" apps/web/lib/sanity/image.ts && \
      grep -q "from './client'" apps/web/lib/sanity/image.ts
    </automated>
  </verify>
  <done>
    `urlFor(source)` is exported and uses the runtime `sanityClient` as the image URL builder source. Components in Wave 3 can call `urlFor(charity.image).width(800).url()`.
  </done>
</task>

</tasks>

<verification>
- All four files exist under `apps/web/lib/sanity/`
- GROQ queries match `docs/API_CONTRACTS.md §1.1-§1.5, §1.7` byte-for-byte where possible
- Types match the projections (problemPdfUrl, audioUrl, featuredIn names preserved)
- TypeScript compiles: `pnpm --filter web typecheck` returns 0 (apps/web/lib/** included via tsconfig)
</verification>

<success_criteria>
- Two Sanity clients exist with the correct useCdn settings
- Six canonical GROQ queries exported via `groq` tag (next-sanity)
- TypeScript result types match the projections, ready for Wave 3 routes
- `urlFor()` image builder is wired to the runtime client
- No new top-level deps required beyond Plan 02-01's set
</success_criteria>

<output>
After completion, create `.planning/phases/02-web-shell-theme-engine/02-02-sanity-reader-SUMMARY.md` recording: which queries are wired, what GROQ projection names downstream components must reference (problemPdfUrl, audioUrl, featuredIn), and a note that `defineLive` is intentionally deferred to Phase 9.
</output>
