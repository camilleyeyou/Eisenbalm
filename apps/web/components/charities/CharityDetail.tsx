/**
 * CharityDetail — full charity detail render for /charities/[slug].
 *
 * UI-SPEC §13: name h1 (Display 36px), metadata row, mission (Body 18px),
 * three external links with rel="noopener noreferrer" + target="_blank",
 * scout notes block labelled "About this charity", featured-issue back-link.
 *
 * External link safety: all href values originate from Sanity (user-supplied URLs).
 * Every external anchor uses rel="noopener noreferrer" + target="_blank" to
 * prevent tab-napping and restrict referrer leakage.
 */
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { CharityDetail as CharityDetailType } from '@/lib/sanity/types'
import { formatMonthYear } from '@/lib/format'
import '@/components/dispatch/pages.css'

export function CharityDetail({
  charity,
}: {
  charity: NonNullable<CharityDetailType>
}) {
  return (
    <article>
      {/* Charity name + metadata chips on a blue band */}
      <header className="d-page-head d-tone-blue d-on-dark d-detail-head">
        <h1 className="d-display">{charity.name}</h1>

        <ul className="d-meta-chips">
          {charity.location ? <li className="d-meta-chip">{charity.location}</li> : null}
          {charity.focusArea ? <li className="d-meta-chip">{charity.focusArea}</li> : null}
          {/* "Est. {year}" or omit entirely if null — never render "Est. null" */}
          {charity.foundingYear ? (
            <li className="d-meta-chip">Est. {charity.foundingYear}</li>
          ) : null}
          {charity.assetRange ? <li className="d-meta-chip">{charity.assetRange}</li> : null}
        </ul>
      </header>

      <div className="d-page-narrow d-detail-body">
        {/* Mission statement — full (no truncation on detail page) */}
        {charity.missionStatement ? (
          <p className="d-body d-detail-section">{charity.missionStatement}</p>
        ) : null}

        {/*
         * External links — all charity URLs are user-supplied via Sanity.
         * Security: rel="noopener noreferrer" + target="_blank" on every anchor.
         *   - noopener: prevents the opened page from accessing window.opener
         *   - noreferrer: suppresses the Referer header (privacy + noopener fallback)
         */}
        <ul className="d-detail-links">
          {charity.website ? (
          <li>
            <a
              href={charity.website}
              target="_blank"
              rel="noopener noreferrer" /* external link safety */
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
              rel="noopener noreferrer" /* external link safety */
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
              rel="noopener noreferrer" /* external link safety */
            >
              <ExternalLink size={14} aria-hidden="true" />
              View on Candid
            </a>
          </li>
          ) : null}
        </ul>

        {/* Scout notes — "About this charity" */}
        {charity.scoutNotes ? (
          <section className="d-detail-section">
            <p className="d-eyebrow">About this charity</p>
            <p className="d-body">{charity.scoutNotes}</p>
          </section>
        ) : null}

        {/*
         * Featured-issue back-link. GROQ projection: firstFeaturedIn-> projected
         * as "featuredIn" in QUERY_CHARITY_BY_SLUG (API_CONTRACTS.md §1.5).
         * Omit gracefully when null.
         */}
        {charity.featuredIn ? (
          <p className="d-detail-back">
            <Link href={`/issue/${charity.featuredIn.slug}`} className="d-tap">
              This charity was featured in Issue {charity.featuredIn.issueNumber}{' '}
              ({formatMonthYear(charity.featuredIn.publishDate)})
            </Link>
          </p>
        ) : null}
      </div>
    </article>
  )
}
