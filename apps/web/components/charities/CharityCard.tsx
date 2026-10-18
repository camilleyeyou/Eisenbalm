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
import '@/components/dispatch/pages.css'

export function CharityCard({ charity }: { charity: CharityListItem }) {
  return (
    <li className="d-row">
      {/* Charity name — links to /charities/[slug] */}
      <h2 className="d-row-title">
        <Link href={`/charities/${charity.slug}`} className="d-row-link">
          {charity.name}
        </Link>
      </h2>

      {/* Location + focus area metadata */}
      <div className="d-row-meta">
        {charity.location ? <span>{charity.location}</span> : null}
        {charity.focusArea ? <span>{charity.focusArea}</span> : null}
      </div>

      {/* Mission statement — 2-line clamp */}
      {charity.missionStatement ? (
        <p className="d-body d-row-excerpt">{charity.missionStatement}</p>
      ) : null}

      {/*
       * Featured-in back-link. GROQ projection: firstFeaturedIn->{ issueNumber, slug }
       * is exposed as "featuredIn" in QUERY_ALL_CHARITIES (API_CONTRACTS.md §1.4).
       * Omit gracefully when null.
       */}
      {charity.featuredIn ? (
        <p className="d-row-note">
          <Link href={`/issue/${charity.featuredIn.slug}`} className="d-tap">
            Featured in Issue {charity.featuredIn.issueNumber}
          </Link>
        </p>
      ) : null}
    </li>
  )
}
