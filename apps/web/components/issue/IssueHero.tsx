/**
 * Issue hero — charity header at the top of every issue page.
 * UI-SPEC §1.
 *
 * Phase 10: masthead treatment — larger charity name (44/64), italic byline,
 * .eyebrow utility for issue label and metadata row, .prose-measure for
 * column consistency with the editorial body below. DES-01.
 *
 * Renders:
 *   - Issue label "Issue {N} — {Month D, YYYY}" (.eyebrow, block)
 *   - Charity name (Display, 44/64, weight 600, --color-primary) — <h1>
 *   - "by Jesse A. Eisenbalm" italic byline (Body, 16px, italic)
 *   - Metadata row (.eyebrow spans): focus area, location, "Est. {year}", "{N} min read"
 *   - Mission statement (Body, 20px, regular) — 3-line clamp
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
    <header className="prose-measure pt-16 pb-10 sm:pt-20">
      {/* Issue label — eyebrow, occupies its own line */}
      <p className="eyebrow mb-6 block">
        {issueLabel}
      </p>

      {/* Charity name — primary visual anchor (h1), masthead-scale display */}
      <h1 className="mb-6 font-display text-[44px] font-semibold leading-[1.05] tracking-[-0.01em] text-[color:var(--color-primary)] sm:text-[64px]">
        {charity.name}
      </h1>

      {/* Masthead byline — body serif italic, full name */}
      <p className="mb-6 font-body text-[16px] italic leading-[1.55] text-[color:var(--color-text)] opacity-75">
        by Jesse A. Eisenbalm
      </p>

      {/* Metadata row: focus area, location, founding year, reading time */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1">
        {charity.focusArea && <span className="eyebrow">{charity.focusArea}</span>}
        <span className="eyebrow">{charity.location}</span>
        {charity.foundingYear != null && (
          <span className="eyebrow">Est. {charity.foundingYear}</span>
        )}
        {readingTimeMinutes > 0 && (
          <span className="eyebrow ml-auto">{readingTimeMinutes} min read</span>
        )}
      </div>

      {/* Mission statement — lede-style 20px body, 3-line clamp */}
      {charity.missionStatement && (
        <p
          className="mb-8 font-body text-[20px] leading-[1.55] text-[color:var(--color-text)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden"
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
          className="inline-flex items-center min-h-11 font-ui text-[14px] leading-[1.5] text-[color:var(--color-primary)] underline underline-offset-2 transition-opacity hover:opacity-75"
          download
        >
          Download the problem framework
        </a>
      )}
    </header>
  )
}
