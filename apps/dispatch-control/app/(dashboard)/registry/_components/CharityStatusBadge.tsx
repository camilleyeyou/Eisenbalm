/**
 * Phase 26 — REG-01: Charity state badge.
 *
 * Color-coded badge for the three charity lifecycle states.
 * Text label is always present (color is additive, not the sole signal — WCAG).
 */

interface CharityStatusBadgeProps {
  status: string
}

export default function CharityStatusBadge({ status }: CharityStatusBadgeProps) {
  let classes: string
  let label: string

  switch (status) {
    case 'featured':
      classes =
        'inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700'
      label = 'Featured'
      break
    case 'blocklisted':
      classes =
        'inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700'
      label = 'Blocklisted'
      break
    case 'candidate':
    default:
      classes =
        'inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium text-neutral-600'
      label = 'Candidate'
      break
  }

  return <span className={classes}>{label}</span>
}
