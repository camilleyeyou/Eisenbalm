/**
 * /feed.xml — RSS 2.0 feed.
 *
 * Per UI-SPEC §RSS Feed: no full content (link only); keeps site as
 * destination. Charities link back to their featured issue page.
 *
 * Uses an inline QUERY_FEED projection rather than extending QUERY_ARCHIVE
 * because the RSS feed needs charity.missionStatement, which is not part of
 * the canonical archive projection in API_CONTRACTS.md §1.3.
 * Keeping QUERY_ARCHIVE byte-for-byte aligned with the contract is the
 * higher priority.
 *
 * Exclusion: /_debug/* — this handler only emits published weeklyIssue items
 * from QUERY_FEED. The /_debug/convex route (Phase 3, removed in Phase 9)
 * is not a weeklyIssue and cannot appear here.
 */
import { groq } from 'next-sanity'
import { sanityClient } from '@/lib/sanity/client'
import { SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from '@/lib/site'

export const revalidate = 60

// ─── RSS-specific GROQ projection ──────────────────────────────────────────

type FeedIssue = {
  issueNumber: number
  publishDate: string
  slug: string
  charity: {
    name: string
    missionStatement: string | null
  } | null
}

const QUERY_FEED = groq`
  *[_type == "weeklyIssue" && status == "published"]
  | order(issueNumber desc) {
    issueNumber,
    publishDate,
    "slug": slug.current,
    charity-> {
      name,
      missionStatement,
    },
  }
`

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Minimal XML escape for text inside element content and attribute values. */
function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * RFC 822 / RFC 2822 date format for RSS <pubDate>.
 * Date.toUTCString() produces "Tue, 15 Nov 1994 12:45:26 GMT" which is
 * compatible with RSS 2.0 pubDate requirements.
 */
function toRfc822(input: string): string {
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return new Date().toUTCString()
  return d.toUTCString()
}

// ─── Route Handler ─────────────────────────────────────────────────────────

export async function GET() {
  const base = getSiteUrl()
  // Exclusion: do not list /_debug/* routes (Phase 3 D-18)

  // Guard: return a minimal valid RSS channel when Sanity credentials are absent
  // (CI builds, unconfigured preview environments).
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  if (!projectId) {
    const emptyXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      '  <channel>',
      `    <title>${escapeXml(SITE_NAME)}</title>`,
      `    <link>${escapeXml(base)}</link>`,
      `    <atom:link href="${escapeXml(base + '/feed.xml')}" rel="self" type="application/rss+xml"/>`,
      `    <description>${escapeXml(SITE_DESCRIPTION)}</description>`,
      '    <language>en-us</language>',
      `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
      '  </channel>',
      '</rss>',
    ].join('\n')
    return new Response(emptyXml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    })
  }

  const issues = (await sanityClient.fetch<FeedIssue[]>(QUERY_FEED)) ?? []

  const lastBuildDate = new Date().toUTCString()

  const items = issues
    .map((issue) => {
      const charityName = issue.charity?.name ?? 'Issue'
      // Title format per UI-SPEC: "{charity.name} — Issue {N}"
      const title = `${charityName} — Issue ${issue.issueNumber}`
      const link = `${base}/issue/${issue.slug}`
      const description = issue.charity?.missionStatement ?? ''
      return [
        '    <item>',
        `      <title>${escapeXml(title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${toRfc822(issue.publishDate)}</pubDate>`,
        `      <description>${escapeXml(description)}</description>`,
        '    </item>',
      ].join('\n')
    })
    .join('\n')

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(SITE_NAME)}</title>`,
    `    <link>${escapeXml(base)}</link>`,
    `    <atom:link href="${escapeXml(base + '/feed.xml')}" rel="self" type="application/rss+xml"/>`,
    `    <description>${escapeXml(SITE_DESCRIPTION)}</description>`,
    '    <language>en-us</language>',
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    items,
    '  </channel>',
    '</rss>',
  ].join('\n')

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  })
}
