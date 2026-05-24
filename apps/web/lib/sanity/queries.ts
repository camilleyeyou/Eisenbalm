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
      conversation[] { speaker, text },
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

/**
 * §1.6 — Agent profiles for the deliberation layer (DEL-02, DEL-06).
 * Called once per issue page render; the named personas (NEVER model names)
 * back the agent identity cards. Ordered for stable rendering.
 */
export const QUERY_AGENT_PROFILES = groq`
  *[_type == "agentProfile"] | order(agentId.current asc) {
    "agentId": agentId.current,
    displayName,
    role,
    personality,
    "avatarUrl": avatar.asset->url
  }
`
