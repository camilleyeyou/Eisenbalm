/**
 * CharityCard — single row in the /charities alphabetical list.
 *
 * Renders: charity name (heading link), location + focus area metadata,
 * mission statement (2-line clamp), and an optional "Featured in Issue N"
 * back-link when featuredIn is non-null.
 *
 * UI-SPEC §12 — list container 1100px, 1px border-bottom, 24px vertical padding.
 */
import Link from 'next/link'
import type { CharityListItem } from '@/lib/sanity/types'

export function CharityCard({ charity }: { charity: CharityListItem }) {
  return (
    <li className="border-b border-[color:var(--color-border)] py-6">
      {/* Charity name — Heading 22px semibold, links to /charities/[slug] */}
      <h2 className="font-display text-[22px] font-semibold leading-[1.25]">
        <Link
          href={`/charities/${charity.slug}`}
          className="text-[color:var(--color-primary)] underline-offset-4 hover:text-[color:var(--color-accent)] hover:underline"
        >
          {charity.name}
        </Link>
      </h2>

      {/* Location + focus area metadata — UI 14px muted */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-[14px] text-[color:var(--color-text-muted)]">
        {charity.location ? <span>{charity.location}</span> : null}
        {charity.focusArea ? <span>{charity.focusArea}</span> : null}
      </div>

      {/* Mission statement — Body 18px, 2-line clamp per UI-SPEC §12 */}
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

      {/*
       * Featured-in back-link. GROQ projection: firstFeaturedIn->{ issueNumber, slug }
       * is exposed as "featuredIn" in QUERY_ALL_CHARITIES (API_CONTRACTS.md §1.4).
       * Omit gracefully when null.
       */}
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
