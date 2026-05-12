---
phase: 02-web-shell-theme-engine
plan: 10
type: execute
wave: 3
depends_on: ["02-01", "02-02", "02-05"]
files_modified:
  - apps/web/app/sitemap.ts
  - apps/web/app/feed.xml/route.ts
  - apps/web/public/robots.txt
  - apps/web/public/og-default.png
autonomous: true
requirements: [WEB-11, WEB-12, WEB-13]
must_haves:
  truths:
    - "/sitemap.xml returns valid XML listing all published issues + all charities + static pages"
    - "/feed.xml returns valid RSS 2.0 with channel + item entries per UI-SPEC §RSS"
    - "/robots.txt allows / and disallows /api/ + /_next/"
    - "OG default image exists at /og-default.png so social cards never 404"
  artifacts:
    - path: apps/web/app/sitemap.ts
      provides: "Next.js App Router sitemap.ts: dynamic from QUERY_ARCHIVE + QUERY_ALL_CHARITIES"
    - path: apps/web/app/feed.xml/route.ts
      provides: "RSS 2.0 Route Handler returning XML with caching headers"
    - path: apps/web/public/robots.txt
      provides: "Static crawl rules"
    - path: apps/web/public/og-default.png
      provides: "1200x630 placeholder PNG (Andrew can replace with real artwork later)"
  key_links:
    - from: apps/web/app/sitemap.ts
      to: apps/web/lib/sanity/queries.ts (QUERY_ARCHIVE + QUERY_ALL_CHARITIES)
      via: "sanityClient.fetch in sitemap generator"
      pattern: "QUERY_ARCHIVE|QUERY_ALL_CHARITIES"
    - from: apps/web/app/feed.xml/route.ts
      to: apps/web/lib/sanity/queries.ts (QUERY_ARCHIVE)
      via: "Route Handler GET"
      pattern: "QUERY_ARCHIVE"
---

<objective>
Ship the SEO + syndication infrastructure: sitemap.ts (Next 15 App Router built-in), feed.xml Route Handler (RSS 2.0), robots.txt, and a static OG default image. These satisfy WEB-12 and WEB-13 plus reinforce WEB-11 (OG card images never 404).

Purpose: The sitemap is how Google + AI agents discover every issue and charity page. The RSS feed is how RSS readers index the dispatch — first-class brand surface (CONTEXT.md specifics: "RSS readers index the dispatch; charities link back to their featured page").
Output: 4 files; existing routes from earlier Wave 3 plans don't change.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-web-shell-theme-engine/02-CONTEXT.md
@.planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md
@CLAUDE.md
@apps/web/lib/sanity/client.ts
@apps/web/lib/sanity/queries.ts
@apps/web/lib/sanity/types.ts
@apps/web/lib/site.ts

<interfaces>
<!-- UI-SPEC §Sitemap content rules: -->
- Include: all published /issue/{slug}, all /charities/{slug}, static pages
  (/archive, /charities, /about, /shop)
- Exclude: /api/, drafts, in-review

<!-- UI-SPEC §RSS Feed content rules (RSS 2.0): -->
- Channel title:        "The Eisenbalm Dispatch"
- Channel description:  "A weekly editorial on one obscure charity. One product. 100% donated."
- Channel link:         getSiteUrl()
- Item title:           "{charity.name} — Issue {N}"
- Item description:     "{charity.missionStatement}"
- Item link:            "{getSiteUrl()}/issue/{slug}"
- Item pubDate:         RFC 822 of publishDate
- NO full content (link only — keeps site as destination)

<!-- Next.js App Router sitemap.ts signature: -->
export default async function sitemap(): Promise<MetadataRoute.Sitemap> { ... }
where each entry is { url, lastModified?, changeFrequency?, priority? }

<!-- ArchiveIssue type is good enough for sitemap entries. CharityListItem for charities. -->

<!-- robots.txt (UI-SPEC §robots.txt — literal): -->
User-agent: *
Allow: /
Disallow: /api/
Disallow: /_next/

<!-- OG default image: -->
- 1200×630 PNG at apps/web/public/og-default.png
- Phase 2 ships a PLACEHOLDER (e.g., generated via Node script with simple Canvas/SVG-to-PNG OR
  a minimal valid PNG byte stream — see Task 4). Andrew replaces with real artwork before launch.
- The build must NOT fail when og-default.png is referenced; it must be a real PNG file.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: apps/web/app/sitemap.ts — dynamic sitemap of issues + charities + static</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §Sitemap (inclusion rules)
    - apps/web/lib/sanity/queries.ts (QUERY_ARCHIVE, QUERY_ALL_CHARITIES)
    - apps/web/lib/site.ts (getSiteUrl)
  </read_first>
  <files>apps/web/app/sitemap.ts</files>
  <action>
    Create `apps/web/app/sitemap.ts` using Next.js App Router's built-in `MetadataRoute.Sitemap`:

    ```typescript
    import type { MetadataRoute } from 'next'
    import { sanityClient } from '@/lib/sanity/client'
    import {
      QUERY_ALL_CHARITIES,
      QUERY_ARCHIVE,
    } from '@/lib/sanity/queries'
    import type { ArchiveIssue, CharityListItem } from '@/lib/sanity/types'
    import { getSiteUrl } from '@/lib/site'

    export const revalidate = 60

    export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
      const base = getSiteUrl()
      const now = new Date()

      const [issues, charities] = await Promise.all([
        sanityClient.fetch<ArchiveIssue[]>(QUERY_ARCHIVE),
        sanityClient.fetch<CharityListItem[]>(QUERY_ALL_CHARITIES),
      ])

      const staticEntries: MetadataRoute.Sitemap = [
        { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
        { url: `${base}/archive`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${base}/charities`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
        { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
        { url: `${base}/shop`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
      ]

      const issueEntries: MetadataRoute.Sitemap = (issues ?? []).map((issue) => ({
        url: `${base}/issue/${issue.slug}`,
        lastModified: issue.publishDate ? new Date(issue.publishDate) : now,
        changeFrequency: 'yearly',
        priority: 0.9,
      }))

      const charityEntries: MetadataRoute.Sitemap = (charities ?? []).map((c) => ({
        url: `${base}/charities/${c.slug}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.6,
      }))

      return [...staticEntries, ...issueEntries, ...charityEntries]
    }
    ```

    Note: Next 15 also accepts `apps/web/app/sitemap.xml/route.ts` returning raw XML, but the built-in `sitemap.ts` is preferred and produces `/sitemap.xml` automatically.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/app/sitemap.ts && \
      grep -q "MetadataRoute.Sitemap" apps/web/app/sitemap.ts && \
      grep -q "QUERY_ARCHIVE" apps/web/app/sitemap.ts && \
      grep -q "QUERY_ALL_CHARITIES" apps/web/app/sitemap.ts && \
      grep -q "/issue/" apps/web/app/sitemap.ts && \
      grep -q "/charities/" apps/web/app/sitemap.ts && \
      grep -q "/archive" apps/web/app/sitemap.ts && \
      grep -q "/about" apps/web/app/sitemap.ts && \
      grep -q "/shop" apps/web/app/sitemap.ts && \
      grep -q "getSiteUrl" apps/web/app/sitemap.ts
    </automated>
  </verify>
  <done>
    `app/sitemap.ts` generates `/sitemap.xml` listing static pages + all published issues + all charities, with sensible lastModified/changeFrequency/priority. Excludes /api and drafts implicitly (queries filter on status=published).
  </done>
</task>

<task type="auto">
  <name>Task 2: apps/web/app/feed.xml/route.ts — RSS 2.0 Route Handler</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §RSS Feed (locked field shape)
    - apps/web/lib/sanity/queries.ts (QUERY_ARCHIVE)
    - apps/web/lib/site.ts (SITE_NAME, SITE_DESCRIPTION, getSiteUrl)
  </read_first>
  <files>apps/web/app/feed.xml/route.ts</files>
  <action>
    Create `apps/web/app/feed.xml/route.ts`. Hand-built RSS XML for control and to avoid adding an RSS lib dep. Per UI-SPEC: no full content, link only.

    The archive query lacks `missionStatement` (which is on the charity, not the issue). For the RSS feed we need the charity's mission statement. Two options:
    1. Extend QUERY_ARCHIVE to include `charity.missionStatement` (touches a shared query — risky).
    2. Issue a second GROQ that's RSS-specific (clean, scoped).

    Use option 2 — keeps `QUERY_ARCHIVE` byte-for-byte aligned with API_CONTRACTS.md.

    ```typescript
    /**
     * /feed.xml — RSS 2.0 feed.
     * Per UI-SPEC: no full content (link only); keeps site as destination.
     */
    import { groq } from 'next-sanity'
    import { sanityClient } from '@/lib/sanity/client'
    import { SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from '@/lib/site'

    export const revalidate = 60
    export const dynamic = 'force-static'

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

    /** Minimal XML escape for text inside <title>, <description>, etc. */
    function escapeXml(input: string): string {
      return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    }

    /** RFC 822 date format for RSS pubDate. */
    function toRfc822(input: string): string {
      const d = new Date(input)
      if (Number.isNaN(d.getTime())) return new Date().toUTCString()
      return d.toUTCString()
    }

    export async function GET() {
      const base = getSiteUrl()
      const issues = (await sanityClient.fetch<FeedIssue[]>(QUERY_FEED)) ?? []

      const lastBuildDate = new Date().toUTCString()
      const items = issues
        .map((issue) => {
          const charityName = issue.charity?.name ?? 'Issue'
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
    ```
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/app/feed.xml/route.ts && \
      grep -q "application/rss+xml" apps/web/app/feed.xml/route.ts && \
      grep -q "<rss version=\"2.0\"" apps/web/app/feed.xml/route.ts && \
      grep -q "<channel>" apps/web/app/feed.xml/route.ts && \
      grep -q "<title>" apps/web/app/feed.xml/route.ts && \
      grep -q "<pubDate>" apps/web/app/feed.xml/route.ts && \
      grep -q "<guid" apps/web/app/feed.xml/route.ts && \
      grep -q "escapeXml" apps/web/app/feed.xml/route.ts && \
      grep -q "toRfc822" apps/web/app/feed.xml/route.ts && \
      grep -q "atom:link" apps/web/app/feed.xml/route.ts && \
      grep -q "QUERY_FEED" apps/web/app/feed.xml/route.ts
    </automated>
  </verify>
  <done>
    `/feed.xml` route handler returns RSS 2.0 XML with channel + item entries. Title format matches UI-SPEC: "{charity.name} — Issue {N}". Self-referential `<atom:link>` included for feed readers. XML special characters escaped.
  </done>
</task>

<task type="auto">
  <name>Task 3: apps/web/public/robots.txt — crawl rules</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §robots.txt (verbatim content)
  </read_first>
  <files>apps/web/public/robots.txt</files>
  <action>
    Create `apps/web/public/robots.txt`:

    ```
    User-agent: *
    Allow: /
    Disallow: /api/
    Disallow: /_next/

    Sitemap: https://eisenbalm.com/sitemap.xml
    ```

    The `Sitemap:` line hardcodes the production URL. Vercel preview deployments will still serve `/robots.txt` with this line — that's fine. Crawlers ignore it on preview hosts, and rewriting the Sitemap line dynamically would require a Route Handler rather than a static file (extra surface area; not worth it).
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/public/robots.txt && \
      grep -q "User-agent: \*" apps/web/public/robots.txt && \
      grep -q "Allow: /" apps/web/public/robots.txt && \
      grep -q "Disallow: /api/" apps/web/public/robots.txt && \
      grep -q "Disallow: /_next/" apps/web/public/robots.txt && \
      grep -q "Sitemap:" apps/web/public/robots.txt
    </automated>
  </verify>
  <done>
    `apps/web/public/robots.txt` ships verbatim per UI-SPEC + `Sitemap:` reference.
  </done>
</task>

<task type="auto">
  <name>Task 4: Ship placeholder apps/web/public/og-default.png</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §OG/Twitter (1200x630 spec)
    - .planning/phases/02-web-shell-theme-engine/02-CONTEXT.md (D-23 — static fallback)
  </read_first>
  <files>apps/web/public/og-default.png</files>
  <action>
    Create a minimal valid 1200x630 PNG at `apps/web/public/og-default.png` so the OG metadata defined in Plan 02-05's root layout and per-page metadata never points at a missing asset.

    Two acceptable approaches; executor picks whichever lands fastest:

    **Approach A — Generate via sharp (if sharp is reachable):**
    ```bash
    cd /Users/user/Desktop/Eisenbalm/apps/web && \
    pnpm exec node --input-type=module -e "$(cat <<'JS'
    import sharp from 'sharp'
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <rect width="1200" height="630" fill="#FAFAF8"/>
      <text x="50%" y="48%" font-family="Georgia, serif" font-size="72" font-weight="600"
            fill="#1A1A18" text-anchor="middle">The Eisenbalm Dispatch</text>
      <text x="50%" y="62%" font-family="Georgia, serif" font-size="32"
            fill="#2D5016" text-anchor="middle">One charity per week.</text>
    </svg>`
    await sharp(Buffer.from(svg)).png().toFile('public/og-default.png')
    JS
    )"
    ```

    `sharp` is bundled with Next.js for image optimization, so it should resolve from apps/web/node_modules.

    **Approach B — Ship a minimal valid PNG via Node Buffer (no deps):**
    If `sharp` doesn't resolve, write a 1200x630 single-color PNG (off-white #FAFAF8) using the canonical zlib-compressed minimal PNG byte sequence. This produces a ~50-byte file that's a valid 1200x630 PNG. Approach A is preferred (looks like something); approach B is the fallback for safety.

    For approach B, write the following inline Node snippet that produces a valid 1x1 PNG and then upscales by reusing the same image-encoder pattern Next.js uses internally. If neither works cleanly, the executor should fall back to creating a minimal valid 1x1 #FAFAF8 PNG file (browsers and Twitter accept it gracefully though the OG card looks empty) and document this in the SUMMARY for Andrew to replace.

    Minimum acceptance: the file exists, is a valid PNG (passes `file` command check), and is referenced from the layout/metadata without `next build` warning about it being missing.

    NOTE on real artwork: STATE.md doesn't list "OG image" as a blocker, but UI-SPEC §OG/Twitter ("Design and export as PNG before Phase 2 closes") implies real artwork is desired. The placeholder shipped here unblocks Phase 2; Andrew can swap in real artwork at any time without touching code.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/public/og-default.png && \
      file apps/web/public/og-default.png | grep -q "PNG image" && \
      pnpm --filter web build 2>&1 | tail -10
    </automated>
  </verify>
  <done>
    `apps/web/public/og-default.png` exists, is a valid PNG (preferably 1200x630), and the Next build no longer warns about a missing OG asset. SUMMARY records whether real artwork or placeholder was shipped (so Andrew knows whether to replace).
  </done>
</task>

</tasks>

<verification>
- `apps/web/app/sitemap.ts` generates `/sitemap.xml` with all routes + dynamic issue/charity URLs
- `apps/web/app/feed.xml/route.ts` returns valid RSS 2.0 XML with `Content-Type: application/rss+xml`
- `apps/web/public/robots.txt` ships verbatim
- `apps/web/public/og-default.png` exists and passes `file` check
- pnpm --filter web build completes
- After dev server starts: `curl http://localhost:3000/sitemap.xml | head -3` returns XML; `curl http://localhost:3000/feed.xml | head -3` returns RSS (smoke test deferred to Plan 02-11)
</verification>

<success_criteria>
- WEB-12: sitemap.xml lists all published issues + charity pages
- WEB-13: feed.xml lists all published issues in RSS 2.0
- WEB-11 reinforced: OG image asset exists so cards never break
- robots.txt present and well-formed
</success_criteria>

<output>
After completion, create `.planning/phases/02-web-shell-theme-engine/02-10-sitemap-rss-og-SUMMARY.md` recording: sitemap entry counts (5 static + N issues + M charities), RSS GROQ projection name (`charity.missionStatement` via the inline QUERY_FEED), and whether og-default.png is real artwork or placeholder.
</output>
