---
phase: 02-web-shell-theme-engine
plan: 07
type: execute
wave: 3
depends_on: ["02-01", "02-02", "02-05"]
files_modified:
  - apps/web/app/archive/page.tsx
  - apps/web/components/archive/ArchiveList.tsx
  - apps/web/components/archive/ArchiveItem.tsx
autonomous: true
requirements: [WEB-03, WEB-11]
must_haves:
  truths:
    - "/archive renders without 404 and shows every published issue, newest first by default"
    - "User can search by charity name OR focus area (case-insensitive substring) — client-side, no debounce"
    - "User can toggle 'Newest first' / 'Oldest first' sort"
    - "Result count updates live: 'Showing {N} issues'"
    - "Empty search returns 'No issues match that search.'"
    - "Each item links to /issue/{slug}; charity name color shifts to accent on hover"
    - "Bonus type rendered as text-only badge: 'Big Budget' / 'Jingle' / 'Spec Ad'"
  artifacts:
    - path: apps/web/app/archive/page.tsx
      provides: "Server component: fetch + generateMetadata + render ArchiveList"
    - path: apps/web/components/archive/ArchiveList.tsx
      provides: "Client component: search input + sort buttons + filtered list"
    - path: apps/web/components/archive/ArchiveItem.tsx
      provides: "Single archive row: issue label, charity name link, focus, location, asset range, bonus type"
  key_links:
    - from: apps/web/app/archive/page.tsx
      to: apps/web/lib/sanity/queries.ts (QUERY_ARCHIVE)
      via: "sanityClient.fetch"
      pattern: "QUERY_ARCHIVE"
    - from: apps/web/components/archive/ArchiveList.tsx
      to: useState (client-side search + sort)
      via: "React hook"
      pattern: "useState"
---

<objective>
Build `/archive` — every published issue, searchable + sortable. Server component fetches the list via `QUERY_ARCHIVE`; client component owns the search input and sort toggle (small dataset; no URL-param state per UI-SPEC + CONTEXT.md D-decisions).

Purpose: Single readable archive that respects Jesse's magazine aesthetic. No card hover effects, no filter chips, no pagination — just a list.
Output: `/archive` route + 2 components.
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
@apps/web/lib/format.ts
@apps/web/lib/site.ts

<interfaces>
<!-- UI-SPEC §10 ArchiveItem renders these projected fields from QUERY_ARCHIVE: -->
- issueNumber, publishDate, slug, bonusType
- charity.name, charity.slug, charity.location, charity.focusArea, charity.assetRange

<!-- UI-SPEC §11 ArchivePage copy (LOCKED): -->
- Page title:           "Archive"
- Search placeholder:   "Search by charity or focus area"
- Sort labels:          "Newest first" / "Oldest first"
- Result count:         "Showing {N} issues"
- Empty result:         "No issues match that search."

<!-- Bonus type label map (UI-SPEC §10): -->
- bigBudget → "Big Budget"
- jingle    → "Jingle"
- specAd    → "Spec Ad"

<!-- ArchiveIssue type from apps/web/lib/sanity/types.ts -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: ArchiveItem component (single row)</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §10 ArchiveItem (fields + layout)
    - apps/web/lib/sanity/types.ts (ArchiveIssue, BonusType)
    - apps/web/lib/format.ts (formatMonthYear)
  </read_first>
  <files>apps/web/components/archive/ArchiveItem.tsx</files>
  <action>
    Create `apps/web/components/archive/ArchiveItem.tsx`:

    ```typescript
    import Link from 'next/link'
    import type { ArchiveIssue, BonusType } from '@/lib/sanity/types'
    import { formatMonthYear } from '@/lib/format'

    const BONUS_LABEL: Record<BonusType, string> = {
      bigBudget: 'Big Budget',
      jingle: 'Jingle',
      specAd: 'Spec Ad',
    }

    export function ArchiveItem({ issue }: { issue: ArchiveIssue }) {
      return (
        <li className="border-b border-[color:var(--color-border)] py-6">
          <div className="flex flex-col gap-2">
            <p className="font-ui text-[14px] text-[color:var(--color-text-muted)]">
              Issue {issue.issueNumber}
            </p>
            <h2 className="font-display text-[22px] font-semibold">
              <Link
                href={`/issue/${issue.slug}`}
                className="text-[color:var(--color-primary)] underline-offset-4 hover:text-[color:var(--color-accent)] hover:underline"
              >
                {issue.charity.name}
              </Link>
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-[14px] text-[color:var(--color-text-muted)]">
              {issue.charity.focusArea ? <span>{issue.charity.focusArea}</span> : null}
              <span>{issue.charity.location}</span>
              <span>{formatMonthYear(issue.publishDate)}</span>
              {issue.charity.assetRange ? (
                <span className="text-[12px]">{issue.charity.assetRange} assets</span>
              ) : null}
              <span className="text-[12px] uppercase tracking-[0.05em]">
                {BONUS_LABEL[issue.bonusType]}
              </span>
            </div>
          </div>
        </li>
      )
    }
    ```
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/components/archive/ArchiveItem.tsx && \
      grep -q "Issue {issue.issueNumber}" apps/web/components/archive/ArchiveItem.tsx && \
      grep -q "Big Budget" apps/web/components/archive/ArchiveItem.tsx && \
      grep -q "Spec Ad" apps/web/components/archive/ArchiveItem.tsx && \
      grep -q "Jingle" apps/web/components/archive/ArchiveItem.tsx && \
      grep -q "/issue/" apps/web/components/archive/ArchiveItem.tsx && \
      grep -q "assets" apps/web/components/archive/ArchiveItem.tsx && \
      grep -q "formatMonthYear" apps/web/components/archive/ArchiveItem.tsx
    </automated>
  </verify>
  <done>
    `<ArchiveItem>` renders issue number, charity name as a styled link, focus/location/date/asset range/bonus type — all in the single-column list pattern with 1px border-bottom.
  </done>
</task>

<task type="auto">
  <name>Task 2: ArchiveList client component (search + sort)</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §11 ArchivePage
    - apps/web/lib/sanity/types.ts (ArchiveIssue)
  </read_first>
  <files>apps/web/components/archive/ArchiveList.tsx</files>
  <action>
    Create `apps/web/components/archive/ArchiveList.tsx`:

    ```typescript
    'use client'

    import { useMemo, useState } from 'react'
    import type { ArchiveIssue } from '@/lib/sanity/types'
    import { ArchiveItem } from './ArchiveItem'

    type SortOrder = 'newest' | 'oldest'

    export function ArchiveList({ issues }: { issues: ArchiveIssue[] }) {
      const [query, setQuery] = useState('')
      const [order, setOrder] = useState<SortOrder>('newest')

      const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        const matched = q === ''
          ? issues
          : issues.filter((issue) => {
              const name = issue.charity.name?.toLowerCase() ?? ''
              const focus = issue.charity.focusArea?.toLowerCase() ?? ''
              return name.includes(q) || focus.includes(q)
            })
        return order === 'newest'
          ? [...matched].sort((a, b) => b.issueNumber - a.issueNumber)
          : [...matched].sort((a, b) => a.issueNumber - b.issueNumber)
      }, [issues, query, order])

      return (
        <div>
          <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-between">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by charity or focus area"
              aria-label="Search the archive"
              className="h-11 w-full rounded border border-[color:var(--color-border)] bg-transparent px-3 font-ui text-[14px] text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] focus-visible:outline-offset-2 md:w-80"
            />
            <div className="flex gap-4 font-ui text-[14px]">
              <button
                type="button"
                onClick={() => setOrder('newest')}
                className={
                  order === 'newest'
                    ? 'underline underline-offset-4 text-[color:var(--color-text)]'
                    : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]'
                }
              >
                Newest first
              </button>
              <button
                type="button"
                onClick={() => setOrder('oldest')}
                className={
                  order === 'oldest'
                    ? 'underline underline-offset-4 text-[color:var(--color-text)]'
                    : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]'
                }
              >
                Oldest first
              </button>
            </div>
          </div>
          <p
            role="status"
            aria-live="polite"
            className="mt-6 font-ui text-[14px] text-[color:var(--color-text-muted)]"
          >
            Showing {filtered.length} {filtered.length === 1 ? 'issue' : 'issues'}
          </p>
          {filtered.length === 0 ? (
            <p className="mt-8 text-center font-ui text-[14px] text-[color:var(--color-text-muted)]">
              No issues match that search.
            </p>
          ) : (
            <ul className="mt-4">
              {filtered.map((issue) => (
                <ArchiveItem key={issue.slug} issue={issue} />
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
      test -f apps/web/components/archive/ArchiveList.tsx && \
      grep -q "'use client'" apps/web/components/archive/ArchiveList.tsx && \
      grep -q "useState" apps/web/components/archive/ArchiveList.tsx && \
      grep -q 'type="search"' apps/web/components/archive/ArchiveList.tsx && \
      grep -q "Search by charity or focus area" apps/web/components/archive/ArchiveList.tsx && \
      grep -q "Newest first" apps/web/components/archive/ArchiveList.tsx && \
      grep -q "Oldest first" apps/web/components/archive/ArchiveList.tsx && \
      grep -q "Showing" apps/web/components/archive/ArchiveList.tsx && \
      grep -q "No issues match that search\." apps/web/components/archive/ArchiveList.tsx && \
      grep -q "toLowerCase" apps/web/components/archive/ArchiveList.tsx
    </automated>
  </verify>
  <done>
    Client component owns query + order state; filters case-insensitively on charity name and focusArea; toggles between newest/oldest sort; renders live result count with aria-live; renders empty-state copy when no matches.
  </done>
</task>

<task type="auto">
  <name>Task 3: app/archive/page.tsx — RSC fetch + metadata</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §"/archive"
    - apps/web/lib/sanity/queries.ts (QUERY_ARCHIVE)
  </read_first>
  <files>apps/web/app/archive/page.tsx</files>
  <action>
    Create `apps/web/app/archive/page.tsx`:

    ```typescript
    import type { Metadata } from 'next'
    import { sanityClient } from '@/lib/sanity/client'
    import { QUERY_ARCHIVE } from '@/lib/sanity/queries'
    import type { ArchiveIssue } from '@/lib/sanity/types'
    import { ArchiveList } from '@/components/archive/ArchiveList'
    import { SITE_NAME, getSiteUrl } from '@/lib/site'

    export const revalidate = 60

    export const metadata: Metadata = {
      title: 'Archive',
      description: 'Every issue of The Eisenbalm Dispatch. One obscure charity per week.',
      alternates: { canonical: `${getSiteUrl()}/archive` },
      openGraph: {
        type: 'website',
        title: `Archive — ${SITE_NAME}`,
        description: 'Every issue of The Eisenbalm Dispatch. One obscure charity per week.',
        url: '/archive',
        images: ['/og-default.png'],
      },
    }

    export default async function ArchivePage() {
      const issues = await sanityClient.fetch<ArchiveIssue[]>(QUERY_ARCHIVE)

      return (
        <div className="mx-auto max-w-[1100px] px-4 md:px-6 lg:px-8 py-12">
          <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-[1.15]">
            Archive
          </h1>
          <p className="mt-2 font-ui text-[14px] text-[color:var(--color-text-muted)]">
            Every issue of The Eisenbalm Dispatch.
          </p>
          <div className="mt-8">
            <ArchiveList issues={issues ?? []} />
          </div>
        </div>
      )
    }
    ```
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/app/archive/page.tsx && \
      grep -q "QUERY_ARCHIVE" apps/web/app/archive/page.tsx && \
      grep -q "ArchiveList" apps/web/app/archive/page.tsx && \
      grep -q "export const metadata" apps/web/app/archive/page.tsx && \
      grep -q "'Archive'" apps/web/app/archive/page.tsx && \
      grep -q "Every issue of The Eisenbalm Dispatch" apps/web/app/archive/page.tsx && \
      pnpm --filter web typecheck 2>&1 | tail -3
    </automated>
  </verify>
  <done>
    `/archive` resolves, renders all published issues via the canonical GROQ query, lets readers search + sort client-side. Metadata includes canonical URL and OG defaults. typecheck passes.
  </done>
</task>

</tasks>

<verification>
- /archive page renders without 404 against the demo seed (one issue visible)
- Searching for "Quiet" filters to the demo charity
- Toggling "Oldest first" doesn't reorder a one-issue list but produces no console errors
- typecheck + build pass
</verification>

<success_criteria>
- WEB-03: archive sortable + searchable by charity name and focus area
- WEB-11: OG + Twitter metadata on /archive
- Single-column list pattern; no card hover backgrounds; charity name hover color is the accent
</success_criteria>

<output>
After completion, create `.planning/phases/02-web-shell-theme-engine/02-07-archive-route-SUMMARY.md` recording: client-side filter logic (case-insensitive substring on name+focusArea), default sort (newest), and aria-live result count.
</output>
