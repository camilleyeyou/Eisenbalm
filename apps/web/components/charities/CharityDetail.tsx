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

export function CharityDetail({
  charity,
}: {
  charity: NonNullable<CharityDetailType>
}) {
  return (
    <article className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8 py-12">
      {/* Charity name — Display 36px semibold (UI-SPEC §13 visual anchor h1) */}
      <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
        {charity.name}
      </h1>

      {/* Metadata row — UI 14px muted */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-[14px] text-[color:var(--color-text-muted)]">
        {charity.location ? <span>{charity.location}</span> : null}
        {charity.focusArea ? <span>{charity.focusArea}</span> : null}
        {/* "Est. {year}" or omit entirely if null — never render "Est. null" */}
        {charity.foundingYear ? (
          <span>Est. {charity.foundingYear}</span>
        ) : null}
        {charity.assetRange ? <span>{charity.assetRange}</span> : null}
      </div>

      {/* Mission statement — Body 18px, full (no truncation on detail page) */}
      {charity.missionStatement ? (
        <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
          {charity.missionStatement}
        </p>
      ) : null}

      {/*
       * External links — all charity URLs are user-supplied via Sanity.
       * Security: rel="noopener noreferrer" + target="_blank" on every anchor.
       *   - noopener: prevents the opened page from accessing window.opener
       *   - noreferrer: suppresses the Referer header (privacy + noopener fallback)
       */}
      <ul className="mt-6 flex flex-col gap-2 font-ui text-[14px]">
        {charity.website ? (
          <li>
            <a
              href={charity.website}
              target="_blank"
              rel="noopener noreferrer" /* external link safety */
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
              rel="noopener noreferrer" /* external link safety */
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
              rel="noopener noreferrer" /* external link safety */
              className="inline-flex items-center gap-1 text-[color:var(--color-primary)] hover:text-[color:var(--color-accent)]"
            >
              <ExternalLink size={14} aria-hidden="true" />
              View on Candid
            </a>
          </li>
        ) : null}
      </ul>

      {/* Scout notes — "About this charity" label (UI 14px muted uppercase) + Body 18px */}
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

      {/*
       * Featured-issue back-link. GROQ projection: firstFeaturedIn-> projected
       * as "featuredIn" in QUERY_CHARITY_BY_SLUG (API_CONTRACTS.md §1.5).
       * Omit gracefully when null.
       */}
      {charity.featuredIn ? (
        <p className="mt-10 font-ui text-[14px]">
          <Link
            href={`/issue/${charity.featuredIn.slug}`}
            className="underline underline-offset-4 text-[color:var(--color-primary)] hover:text-[color:var(--color-accent)]"
          >
            This charity was featured in Issue {charity.featuredIn.issueNumber}{' '}
            ({formatMonthYear(charity.featuredIn.publishDate)})
          </Link>
        </p>
      ) : null}
    </article>
  )
}
