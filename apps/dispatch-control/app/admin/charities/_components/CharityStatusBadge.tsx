/**
 * Phase 26 — REG-01: Charity state badge.
 * Phase 50-03 (D-03/WBN-05): the rendered label for 'blocklisted' is
 * "Do not use" — the STORED status literal + the `status === 'blocklisted'`
 * comparison stay unchanged; only the displayed text changes.
 *
 * Color-coded badge for the three charity lifecycle states.
 * Text label is always present (color is additive, not the sole signal — WCAG).
 *
 * quick 260724-lp1: rewritten to the uniform square-chip recipe (mockup 07
 * `.chip`) — featured -> cobalt, candidate -> marigold, blocklisted -> the
 * one solid-fill (vermilion) chip. Same 3 status branches, same labels.
 */

interface CharityStatusBadgeProps {
  status: string
}

const CHIP_BASE =
  'inline-block border px-2 py-[3px] font-[family-name:var(--font-mono)] text-[9.5px] tracking-[.09em] uppercase whitespace-nowrap'

export default function CharityStatusBadge({ status }: CharityStatusBadgeProps) {
  let classes: string
  let label: string

  switch (status) {
    case 'featured':
      classes = `${CHIP_BASE} border-[color:var(--color-cobalt)] bg-[color:var(--color-cobalt)]/[0.06] text-[color:var(--color-cobalt)]`
      label = 'Featured'
      break
    case 'blocklisted':
      classes = `${CHIP_BASE} border-[color:var(--color-vermilion)] bg-[color:var(--color-vermilion)] text-white`
      label = 'Do not use'
      break
    case 'candidate':
    default:
      classes = `${CHIP_BASE} border-[color:var(--color-marigold)] bg-[color:var(--color-marigold)]/[0.1] text-[color:var(--color-marigold-text)]`
      label = 'Candidate'
      break
  }

  return <span className={classes}>{label}</span>
}
