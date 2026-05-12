---
phase: 02-web-shell-theme-engine
plan: 08
type: execute
wave: 3
depends_on: ["02-01", "02-02", "02-05"]
files_modified:
  - apps/web/app/charities/page.tsx
  - apps/web/app/charities/[slug]/page.tsx
  - apps/web/components/charities/CharityCard.tsx
  - apps/web/components/charities/CharityDetail.tsx
autonomous: true
requirements: [WEB-04, WEB-10, WEB-11]
must_haves:
  truths:
    - "/charities renders alphabetically (enforced in GROQ via order(name asc))"
    - "/charities/[slug] renders single charity detail using QUERY_CHARITY_BY_SLUG"
    - "Charity detail page emits schema.org/NGO JSON-LD"
    - "External links (website, Charity Navigator, GuideStar) render with rel='noopener noreferrer' target='_blank'"
    - "Featured issue back-link renders when featuredIn is non-null; gracefully absent when null"
    - "generateStaticParams enumerates all charity slugs"
  artifacts:
    - path: apps/web/app/charities/page.tsx
      provides: "Server component: fetch QUERY_ALL_CHARITIES + list render"
    - path: apps/web/app/charities/[slug]/page.tsx
      provides: "Server component: fetch QUERY_CHARITY_BY_SLUG + generateStaticParams + JSON-LD + metadata"
    - path: apps/web/components/charities/CharityCard.tsx
      provides: "Single charity row (name link, focus, location, mission 2-line clamp, featuredIn link)"
    - path: apps/web/components/charities/CharityDetail.tsx
      provides: "Charity detail render: name, location, focus, founding, asset range, mission, external links, scout notes, featured issue back-link"
  key_links:
    - from: apps/web/app/charities/[slug]/page.tsx
      to: apps/web/lib/sanity/queries.ts (QUERY_CHARITY_BY_SLUG)
      via: "sanityClient.fetch"
      pattern: "QUERY_CHARITY_BY_SLUG"
    - from: apps/web/app/charities/[slug]/page.tsx
      to: apps/web/components/JsonLd.tsx
      via: "schema.org/NGO"
      pattern: "@type.*NGO"
---

<objective>
Build the charity database routes — `/charities` (alphabetical list) and `/charities/[slug]` (detail page). Detail pages emit `schema.org/NGO` JSON-LD so charities are discoverable as standalone entities. Both routes consume the canonical queries from API_CONTRACTS.md §1.4 and §1.5.

Purpose: The charity is the heart of every issue. The database route gives them their own surface area — Fortune 500 treatment, separate from the editorial framing. Phase 2 ships the simple alphabetical list (UI-SPEC defers filtering until > 50 entries).
Output: Two routes + 2 components.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-web-shell-theme-engine/02-CONTEXT.md
@.planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md
@docs/API_CONTRACTS.md
@CLAUDE.md
@apps/web/lib/sanity/client.ts
@apps/web/lib/sanity/queries.ts
@apps/web/lib/sanity/types.ts
@apps/web/lib/site.ts
@apps/web/lib/format.ts
@apps/web/components/JsonLd.tsx

<interfaces>
<!-- QUERY_ALL_CHARITIES result type (apps/web/lib/sanity/types.ts CharityListItem): -->
- name, slug, location, website, foundingYear, focusArea, assetRange, missionStatement
- featuredIn: { issueNumber, slug, publishDate } | null     # firstFeaturedIn projection

<!-- QUERY_CHARITY_BY_SLUG result type (CharityDetail): -->
- name, slug, location, website, charityNavigatorUrl, guidestarUrl, foundingYear,
  assetRange, focusArea, missionStatement, scoutNotes, featuredIn

<!-- UI-SPEC §12 CharityCard copy: -->
- "Featured in Issue {N}"    (link to /issue/{slug})
- Mission statement: 2-line clamp via -webkit-line-clamp: 2

<!-- UI-SPEC §13 CharityDetailPage copy: -->
- "Est. {year}"
- Scout notes label: "About this charity"
- External link to website:   "Visit {charity.name}"  + lucide ExternalLink
- External link to Charity Navigator: "View on Charity Navigator"
- External link to GuideStar/Candid: "View on Candid"
- Featured back-link:         "This charity was featured in Issue {N} ({Month YYYY})"

<!-- JSON-LD schema.org/NGO shape (UI-SPEC §SEO + Structured Data): -->
{
  "@context": "https://schema.org",
  "@type": "NGO",
  "name": "{charity.name}",
  "description": "{charity.missionStatement}",
  "url": "{charity.website}",
  "foundingDate": "{charity.foundingYear}",
  "location": "{charity.location}"
}
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: CharityCard component</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §12 CharityCard
    - apps/web/lib/sanity/types.ts (CharityListItem)
  </read_first>
  <files>apps/web/components/charities/CharityCard.tsx</files>
  <action>
    Create `apps/web/components/charities/CharityCard.tsx`:

    ```typescript
    import Link from 'next/link'
    import type { CharityListItem } from '@/lib/sanity/types'

    export function CharityCard({ charity }: { charity: CharityListItem }) {
      return (
        <li className="border-b border-[color:var(--color-border)] py-6">
          <h2 className="font-display text-[22px] font-semibold">
            <Link
              href={`/charities/${charity.slug}`}
              className="text-[color:var(--color-primary)] underline-offset-4 hover:text-[color:var(--color-accent)] hover:underline"
            >
              {charity.name}
            </Link>
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-[14px] text-[color:var(--color-text-muted)]">
            <span>{charity.location}</span>
            {charity.focusArea ? <span>{charity.focusArea}</span> : null}
          </div>
          {charity.missionStatement ? (
            <p
              className="mt-3 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {charity.missionStatement}
            </p>
          ) : null}
          {charity.featuredIn ? (
            <p className="mt-3 font-ui text-[14px]">
              <Link
                href={`/issue/${charity.featuredIn.slug}`}
                className="text-[color:var(--color-text-muted)] underline underline-offset-4 hover:text-[color:var(--color-accent)]"
              >
                Featured in Issue {charity.featuredIn.issueNumber}
              </Link>
            </p>
          ) : null}
        </li>
      )
    }
    ```
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/components/charities/CharityCard.tsx && \
      grep -q "Featured in Issue" apps/web/components/charities/CharityCard.tsx && \
      grep -q "/charities/" apps/web/components/charities/CharityCard.tsx && \
      grep -q "WebkitLineClamp: 2" apps/web/components/charities/CharityCard.tsx && \
      grep -q "featuredIn" apps/web/components/charities/CharityCard.tsx
    </automated>
  </verify>
  <done>
    `<CharityCard>` renders single charity row with name link, location/focus metadata, 2-line clamped mission, optional featured-issue back-link.
  </done>
</task>

<task type="auto">
  <name>Task 2: CharityDetail component</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §13 CharityDetailPage
    - apps/web/lib/sanity/types.ts (CharityDetail)
    - apps/web/lib/format.ts (formatMonthYear)
  </read_first>
  <files>apps/web/components/charities/CharityDetail.tsx</files>
  <action>
    Create `apps/web/components/charities/CharityDetail.tsx`:

    ```typescript
    import Link from 'next/link'
    import { ExternalLink } from 'lucide-react'
    import type { CharityDetail as CharityDetailType } from '@/lib/sanity/types'
    import { formatMonthYear } from '@/lib/format'

    export function CharityDetail({ charity }: { charity: NonNullable<CharityDetailType> }) {
      return (
        <article className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8 py-12">
          <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
            {charity.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-[14px] text-[color:var(--color-text-muted)]">
            <span>{charity.location}</span>
            {charity.focusArea ? <span>{charity.focusArea}</span> : null}
            {charity.foundingYear ? <span>Est. {charity.foundingYear}</span> : null}
            {charity.assetRange ? <span>{charity.assetRange}</span> : null}
          </div>

          {charity.missionStatement ? (
            <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
              {charity.missionStatement}
            </p>
          ) : null}

          <ul className="mt-6 flex flex-col gap-2 font-ui text-[14px]">
            {charity.website ? (
              <li>
                <a
                  href={charity.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[color:var(--color-primary)] hover:text-[color:var(--color-accent)]"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  Visit {charity.name}
                </a>
              </li>
            ) : null}
            {charity.charityNavigatorUrl ? (
              <li>
                <a
                  href={charity.charityNavigatorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[color:var(--color-primary)] hover:text-[color:var(--color-accent)]"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  View on Charity Navigator
                </a>
              </li>
            ) : null}
            {charity.guidestarUrl ? (
              <li>
                <a
                  href={charity.guidestarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[color:var(--color-primary)] hover:text-[color:var(--color-accent)]"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  View on Candid
                </a>
              </li>
            ) : null}
          </ul>

          {charity.scoutNotes ? (
            <section className="mt-10 border-t border-[color:var(--color-border)] pt-8">
              <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
                About this charity
              </p>
              <p className="mt-3 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
                {charity.scoutNotes}
              </p>
            </section>
          ) : null}

          {charity.featuredIn ? (
            <p className="mt-10 font-ui text-[14px]">
              <Link
                href={`/issue/${charity.featuredIn.slug}`}
                className="underline underline-offset-4 text-[color:var(--color-primary)] hover:text-[color:var(--color-accent)]"
              >
                This charity was featured in Issue {charity.featuredIn.issueNumber} (
                {formatMonthYear(charity.featuredIn.publishDate)})
              </Link>
            </p>
          ) : null}
        </article>
      )
    }
    ```
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/components/charities/CharityDetail.tsx && \
      grep -q "Visit {charity.name}" apps/web/components/charities/CharityDetail.tsx && \
      grep -q "View on Charity Navigator" apps/web/components/charities/CharityDetail.tsx && \
      grep -q "View on Candid" apps/web/components/charities/CharityDetail.tsx && \
      grep -q "About this charity" apps/web/components/charities/CharityDetail.tsx && \
      grep -q "This charity was featured in Issue" apps/web/components/charities/CharityDetail.tsx && \
      grep -q "Est. {charity.foundingYear}" apps/web/components/charities/CharityDetail.tsx && \
      grep -q 'rel="noopener noreferrer"' apps/web/components/charities/CharityDetail.tsx
    </automated>
  </verify>
  <done>
    `<CharityDetail>` renders all UI-SPEC §13 elements: name h1, metadata row, mission, three external links (rel=noopener), scout notes block, featured-issue back-link. Every link uses target=_blank + rel=noopener noreferrer.
  </done>
</task>

<task type="auto">
  <name>Task 3: /charities list page</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §"/charities"
    - apps/web/lib/sanity/queries.ts (QUERY_ALL_CHARITIES)
  </read_first>
  <files>apps/web/app/charities/page.tsx</files>
  <action>
    Create `apps/web/app/charities/page.tsx`:

    ```typescript
    import type { Metadata } from 'next'
    import { sanityClient } from '@/lib/sanity/client'
    import { QUERY_ALL_CHARITIES } from '@/lib/sanity/queries'
    import type { CharityListItem } from '@/lib/sanity/types'
    import { CharityCard } from '@/components/charities/CharityCard'
    import { SITE_NAME, getSiteUrl } from '@/lib/site'

    export const revalidate = 60

    export const metadata: Metadata = {
      title: 'Charities',
      description: 'Every charity featured by The Eisenbalm Dispatch.',
      alternates: { canonical: `${getSiteUrl()}/charities` },
      openGraph: {
        type: 'website',
        title: `Charities — ${SITE_NAME}`,
        description: 'Every charity featured by The Eisenbalm Dispatch.',
        url: '/charities',
        images: ['/og-default.png'],
      },
    }

    export default async function CharitiesPage() {
      const charities = await sanityClient.fetch<CharityListItem[]>(QUERY_ALL_CHARITIES)

      return (
        <div className="mx-auto max-w-[1100px] px-4 md:px-6 lg:px-8 py-12">
          <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-[1.15]">
            Charities
          </h1>
          <p className="mt-2 font-ui text-[14px] text-[color:var(--color-text-muted)]">
            Every charity featured by The Eisenbalm Dispatch.
          </p>
          {!charities || charities.length === 0 ? (
            <p className="mt-8 font-ui text-[14px] text-[color:var(--color-text-muted)]">
              No charities indexed yet.
            </p>
          ) : (
            <ul className="mt-8">
              {charities.map((charity) => (
                <CharityCard key={charity.slug} charity={charity} />
              ))}
            </ul>
          )}
        </div>
      )
    }
    ```
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/app/charities/page.tsx && \
      grep -q "QUERY_ALL_CHARITIES" apps/web/app/charities/page.tsx && \
      grep -q "CharityCard" apps/web/app/charities/page.tsx && \
      grep -q "'Charities'" apps/web/app/charities/page.tsx
    </automated>
  </verify>
  <done>
    `/charities` resolves and renders an alphabetical list of all charity documents.
  </done>
</task>

<task type="auto">
  <name>Task 4: /charities/[slug] detail page + JSON-LD NGO + metadata + generateStaticParams</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §"/charities/[slug]" + §"JSON-LD"
    - apps/web/lib/sanity/queries.ts (QUERY_CHARITY_BY_SLUG, QUERY_ALL_CHARITIES)
  </read_first>
  <files>apps/web/app/charities/[slug]/page.tsx</files>
  <action>
    Create `apps/web/app/charities/[slug]/page.tsx`:

    ```typescript
    import type { Metadata } from 'next'
    import { notFound } from 'next/navigation'
    import { sanityClient } from '@/lib/sanity/client'
    import {
      QUERY_ALL_CHARITIES,
      QUERY_CHARITY_BY_SLUG,
    } from '@/lib/sanity/queries'
    import type { CharityDetail as CharityDetailType, CharityListItem } from '@/lib/sanity/types'
    import { CharityDetail } from '@/components/charities/CharityDetail'
    import { JsonLd } from '@/components/JsonLd'
    import { SITE_NAME, getSiteUrl } from '@/lib/site'

    export const revalidate = 60

    export async function generateStaticParams() {
      const charities = await sanityClient.fetch<CharityListItem[]>(QUERY_ALL_CHARITIES)
      return charities.map((c) => ({ slug: c.slug }))
    }

    async function fetchCharity(slug: string): Promise<CharityDetailType> {
      return await sanityClient.fetch<CharityDetailType>(QUERY_CHARITY_BY_SLUG, { slug })
    }

    export async function generateMetadata({
      params,
    }: {
      params: Promise<{ slug: string }>
    }): Promise<Metadata> {
      const { slug } = await params
      const charity = await fetchCharity(slug)
      if (!charity) return { title: 'Charity not found' }
      const title = charity.name
      const description = (charity.missionStatement ?? '').slice(0, 160) || 'A charity featured by The Eisenbalm Dispatch.'
      const url = `${getSiteUrl()}/charities/${slug}`
      return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: {
          type: 'website',
          title: `${title} — ${SITE_NAME}`,
          description,
          url,
          images: ['/og-default.png'],
        },
        twitter: {
          card: 'summary_large_image',
          title: `${title} — ${SITE_NAME}`,
          description,
          images: ['/og-default.png'],
        },
      }
    }

    export default async function CharityDetailPage({
      params,
    }: {
      params: Promise<{ slug: string }>
    }) {
      const { slug } = await params
      const charity = await fetchCharity(slug)
      if (!charity) notFound()

      const ngoLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'NGO',
        name: charity.name,
        ...(charity.missionStatement ? { description: charity.missionStatement } : {}),
        ...(charity.website ? { url: charity.website } : {}),
        ...(charity.foundingYear ? { foundingDate: String(charity.foundingYear) } : {}),
        location: charity.location,
      }

      return (
        <>
          <JsonLd data={ngoLd} />
          <CharityDetail charity={charity} />
        </>
      )
    }
    ```
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/app/charities/\[slug\]/page.tsx && \
      grep -q "QUERY_CHARITY_BY_SLUG" "apps/web/app/charities/[slug]/page.tsx" && \
      grep -q "QUERY_ALL_CHARITIES" "apps/web/app/charities/[slug]/page.tsx" && \
      grep -q "generateStaticParams" "apps/web/app/charities/[slug]/page.tsx" && \
      grep -q "generateMetadata" "apps/web/app/charities/[slug]/page.tsx" && \
      grep -q "'@type': 'NGO'" "apps/web/app/charities/[slug]/page.tsx" && \
      grep -q "notFound" "apps/web/app/charities/[slug]/page.tsx" && \
      pnpm --filter web typecheck 2>&1 | tail -3
    </automated>
  </verify>
  <done>
    `/charities/[slug]` resolves for every existing charity slug, emits schema.org/NGO JSON-LD, OG/Twitter metadata, canonical URL. typecheck passes.
  </done>
</task>

</tasks>

<verification>
- Both routes resolve against demo seed: `/charities` shows "The Quiet Foundation" entry; `/charities/the-quiet-foundation` shows the full detail
- JSON-LD NGO inspectable in page source via `<script type="application/ld+json">`
- typecheck + build pass
</verification>

<success_criteria>
- WEB-04: /charities + /charities/[slug] both resolve and render
- WEB-10: charity pages emit schema.org/NGO JSON-LD
- WEB-11: OG + Twitter metadata on both routes
- External links use target=_blank rel=noopener noreferrer
- Featured-in back-links omit gracefully when null
</success_criteria>

<output>
After completion, create `.planning/phases/02-web-shell-theme-engine/02-08-charities-routes-SUMMARY.md` recording: the NGO JSON-LD shape, the featuredIn omission pattern, and a note that filtering UI is deferred to v2 per UI-SPEC.
</output>
