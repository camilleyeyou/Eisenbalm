/**
 * Date formatters per UI-SPEC Copywriting Contract.
 *   - Full date:  "June 5, 2025"                 (formatIssueDate)
 *   - Month/year: "June 2025"                    (formatMonthYear)
 *   - Issue hero label: "Issue 1 — June 5, 2025" (formatIssueLabel)
 *
 * Locale fixed to en-US — UI-SPEC notes "English-only" for v1.
 */

function parseDate(input: string | Date): Date | null {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input
  if (typeof input !== 'string' || input.length === 0) return null
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatIssueDate(input: string | Date): string {
  const d = parseDate(input)
  if (!d) return ''
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC', // Sanity stores date-only; avoid TZ drift.
  })
}

export function formatMonthYear(input: string | Date): string {
  const d = parseDate(input)
  if (!d) return ''
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export function formatIssueLabel(issueNumber: number, publishDate: string | Date): string {
  const date = formatIssueDate(publishDate)
  return date ? `Issue ${issueNumber} — ${date}` : `Issue ${issueNumber}`
}
