'use client'
/**
 * Phase 40 Plan 40-05 (§40-UI-SPEC, ISS-04, D-17) — a held issue's row on
 * the Issues home. Row treatment (not a card) — structurally quieter than
 * `IssueCard`/`ScheduledSlotCard` per the Visual Hierarchy.
 *
 * Reopen is a single click — no confirmation dialog. Reopening is
 * additive/safe and status re-derives on its own once `held` flips back to
 * `false` (D-17); there is no "restore previous status" bookkeeping to
 * confirm.
 *
 * quick 260722-tv1: text container gets `min-w-0` and the free-text reason
 * span gets `break-words` — a long `heldReason` could shove the Reopen
 * button out of view.
 */
import { PauseCircle } from 'lucide-react'
import { useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'

/** `just now` / `{n}m ago` / `{n}h ago` / `{n}d ago`. */
export function relativeTime(ms: number | undefined): string {
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

export interface HeldIssueRowProps {
  issue: {
    issueNumber: number
    heldReason?: string
    heldBy?: string
    heldAt?: number
  }
}

export default function HeldIssueRow({ issue }: HeldIssueRowProps) {
  const reopen = useMutation(api.issues.reopen)

  async function handleReopen() {
    await reopen({ workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: issue.issueNumber })
  }

  return (
    <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-ink)]/[.08] py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="flex items-center gap-[4px] font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-vermilion)]">
          <PauseCircle size={13} aria-hidden="true" />
          Held
        </span>
        <span className="break-words font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)]">
          Issue {issue.issueNumber} — Held · {issue.heldReason ?? '—'} · {issue.heldBy ?? '—'} ·{' '}
          {relativeTime(issue.heldAt)}
        </span>
      </div>

      <button
        type="button"
        onClick={handleReopen}
        className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)]"
      >
        Reopen
      </button>
    </div>
  )
}
