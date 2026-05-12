/**
 * Issue hero — charity header at the top of every issue page.
 * UI-SPEC §1. Container: editorial wide (860px).
 *
 * Renders:
 *   - Charity name (Display, 36px/28px mobile, weight 600) — <h1>
 *   - Focus area + location (UI, 14px, muted)
 *   - Founding year "Est. {year}" (UI, 14px, muted) — omitted if null
 *   - Mission statement (Body, 18px, regular) — 3-line clamp
 *   - Reading time "{N} min read" (UI, 14px, muted)
 *   - Issue label "Issue {N} — {Month D, YYYY}" (UI, 14px, muted)
 *   - PDF download link — only when problemPdfUrl is non-null
 *
 * Voice rules: no exclamation marks. "Est. {year}" never "Est. null".
 */
import type { IssueCharity } from '@/lib/sanity/types'

function formatPublishDate(dateStr: string): string {
  // dateStr is ISO-8601 (e.g., "2025-06-05"). Parse in UTC to avoid
  // timezone drift that would shift the day.
  const parts = dateStr.split('-').map(Number)
  const year = parts[0] ?? 2000
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

interface IssueHeroProps {
  charity: IssueCharity
  issueNumber: number
  publishDate: string
  readingTimeMinutes: number
  problemPdfUrl: string | null
}

export function IssueHero({
  charity,
  issueNumber,
  publishDate,
  readingTimeMinutes,
  problemPdfUrl,
}: IssueHeroProps) {
  const issueLabel = `Issue ${issueNumber} — ${formatPublishDate(publishDate)}`

  return (
    <header className="mx-auto w-full max-w-[860px] px-4 pb-8 pt-12 sm:px-6 lg:px-8">
      {/* Issue label */}
      <p className="mb-4 font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
        {issueLabel}
      </p>

      {/* Charity name — primary visual anchor (h1) */}
      <h1 className="mb-4 font-display text-[28px] font-semibold leading-[1.15] text-[color:var(--color-primary)] sm:text-[36px]">
        {charity.name}
      </h1>

      {/* Metadata row: focus area, location, founding year */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        {charity.focusArea && (
          <span className="font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
            {charity.focusArea}
          </span>
        )}
        <span className="font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
          {charity.location}
        </span>
        {charity.foundingYear != null && (
          <span className="font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
            Est. {charity.foundingYear}
          </span>
        )}
        {/* Reading time — right-aligned on the same row where space allows */}
        {readingTimeMinutes > 0 && (
          <span className="ml-auto font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
            {readingTimeMinutes} min read
          </span>
        )}
      </div>

      {/* Mission statement — 3-line clamp */}
      {charity.missionStatement && (
        <p
          className="mb-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden"
          aria-label={`Mission: ${charity.missionStatement}`}
        >
          {charity.missionStatement}
        </p>
      )}

      {/* PDF download — Phase 6 populates this; omit if null */}
      {problemPdfUrl && (
        <a
          href={problemPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block font-ui text-[14px] leading-[1.5] text-[color:var(--color-primary)] underline underline-offset-2 transition-opacity hover:opacity-75"
          download
        >
          Download the problem framework
        </a>
      )}
    </header>
  )
}
