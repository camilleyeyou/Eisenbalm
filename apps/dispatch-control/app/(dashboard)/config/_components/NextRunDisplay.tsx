'use client'
/**
 * Phase 25 (RUN-03 D-11) — Next-run time display.
 *
 * Shows the next scheduled run time in the operator's local timezone plus UTC
 * side-by-side (D-11). When nextRunAt is 0 or unset, shows "Not scheduled yet."
 *
 * Format: "Next run: {Day} {Month} {D}, {H}:{MM} {TZ} ({HH}:{MM} UTC)"
 * Example: "Next run: Thu Jun 26, 2:00 PM PDT (21:00 UTC)"
 *
 * Uses Intl.DateTimeFormat for locale-aware formatting.
 */

interface NextRunDisplayProps {
  /** Schedule cadence string (for context; not parsed here). */
  cadence?: string
  /** Next run time as Unix milliseconds (UTC). 0 means not scheduled. */
  nextRunAt: number
}

export default function NextRunDisplay({ nextRunAt }: NextRunDisplayProps) {
  if (!nextRunAt || nextRunAt === 0) {
    return (
      <p className="text-sm text-[color:var(--color-faint)]">Not scheduled yet.</p>
    )
  }

  const date = new Date(nextRunAt)

  // Local timezone formatting (operator's browser locale)
  const localFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',   // "Thu"
    month: 'short',     // "Jun"
    day: 'numeric',     // "26"
    hour: 'numeric',    // "2"
    minute: '2-digit',  // "00"
    timeZoneName: 'short', // "PDT"
  })

  const localParts = localFormatter.formatToParts(date)
  const localStr = localFormatter.format(date)

  // Extract timezone abbreviation for display
  const tzPart = localParts.find(p => p.type === 'timeZoneName')
  const tzAbbr = tzPart?.value ?? ''

  // UTC time formatting
  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
  const utcStr = utcFormatter.format(date)

  return (
    <p className="text-sm text-[color:var(--color-ink-soft)]">
      Next run: {localStr} ({utcStr} UTC)
    </p>
  )
}
