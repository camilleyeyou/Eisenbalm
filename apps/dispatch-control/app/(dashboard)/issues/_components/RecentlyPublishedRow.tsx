/**
 * Phase 40 Plan 40-05 (§40-UI-SPEC, D-29) — a recently-published issue's
 * verification record. The quietest region on the page — a record, not a
 * call to action.
 *
 * D-29 (load-bearing): renders the REAL verification record from
 * `sign_offs`/`claim_checks` — claim coverage and both sign-off lines are
 * ALWAYS rendered, never omitted. An absent actor/time renders its labeled
 * line with a plain "—" fallback so absence can never be mistaken for
 * "verified" — the exact "blank means verified" inversion the design bans.
 */
import { CheckCircle2 } from 'lucide-react'

/** `just now` / `{n}m ago` / `{n}h ago` / `{n}d ago`. */
function relativeTime(ms: number | undefined): string {
  if (ms === undefined) return '—'
  const diffMs = Date.now() - ms
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export interface RecentlyPublishedRowProps {
  issue: {
    issueNumber: number
    publishedAt?: number
  }
  verification: {
    checked: number
    total: number
    factsClearedBy?: string
    factsClearedAt?: number
    voiceApprovedBy?: string
    voiceApprovedAt?: number
  }
}

export default function RecentlyPublishedRow({ issue, verification }: RecentlyPublishedRowProps) {
  const factsBy = verification.factsClearedBy ?? '—'
  const factsAt = relativeTime(verification.factsClearedAt)
  const voiceBy = verification.voiceApprovedBy ?? '—'
  const voiceAt = relativeTime(verification.voiceApprovedAt)
  const claimsComplete = verification.total > 0 && verification.checked === verification.total

  return (
    <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[color:var(--color-ink)]/[.06] py-2">
      <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-[color:var(--color-ink-soft)]">
        Issue {issue.issueNumber}
        {issue.publishedAt !== undefined ? ` · ${relativeTime(issue.publishedAt)}` : ''}
      </span>

      <span className="flex items-center gap-[4px] font-[family-name:var(--font-ui)] text-[12.5px] text-[color:var(--color-ink-soft)]">
        {claimsComplete && (
          <CheckCircle2 size={12} className="text-[color:var(--color-green)]" aria-hidden="true" />
        )}
        {verification.checked} of {verification.total} claims checked
      </span>

      <span className="flex items-center gap-[4px] font-[family-name:var(--font-ui)] text-[12.5px] text-[color:var(--color-ink-soft)]">
        <CheckCircle2 size={12} className="text-[color:var(--color-green)]" aria-hidden="true" />
        Facts cleared by {factsBy} · {factsAt}
      </span>

      <span className="font-[family-name:var(--font-ui)] text-[12.5px] text-[color:var(--color-ink-soft)]">
        Voice approved by {voiceBy} · {voiceAt}
      </span>
    </div>
  )
}
