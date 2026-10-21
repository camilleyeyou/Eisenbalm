'use client'
/**
 * Cross-screen "Awaiting-you" inbox (CHR-04, Plan 30-06).
 *
 * A masthead dropdown answering "what needs me right now" — aggregated from
 * EXISTING Convex queries only (D-09: pure client-side derivation).
 *
 * quick 261021-ind: agents review and self-fix every section, so QA findings
 * and contradicted claims never appear here (nothing blocks Publish). Items:
 *   1. The current draft run — "Issue N is ready to publish" (finished,
 *      awaiting-review with completedAt) linking to `/`, or "Issue N: choose
 *      the charity" for a legacy run paused at Gate 1 (completedAt null)
 *   2. The current-cycle failed run (D-10: latest run only, not history)
 *
 * quick 260722-tv1: dropdown width clamped to `w-[min(360px,calc(100vw-24px))]`
 * so a fixed 360px never overflows a narrow viewport.
 */
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'

interface AwaitingYouInboxProps {
  open: boolean
  onClose: () => void
}

interface InboxItem {
  key: string
  label: string
  href: string
  dotColor: string
}

export default function AwaitingYouInbox({ open, onClose }: AwaitingYouInboxProps) {
  const runs = useQuery(api.runs.listForWorkspace, { workspace_id: DEFAULT_WORKSPACE_ID })
  const latest = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })

  const awaitingReview = runs?.filter(r => r.status === 'awaiting-review') ?? []

  // D-10: current-cycle failed run only — do not surface older failed runs
  // from listForWorkspace; history lives in Run Monitor, not the inbox.
  const failedItem = latest?.status === 'failed' ? latest : null

  // The current draft: the run awaiting review (there should only ever be ~1
  // in flight). `runs` rows carry no issueNumber; pipelineRuns does.
  const currentDraft = awaitingReview[0]
  const draftRun = useQuery(
    api.pipelineRuns.byRunId,
    currentDraft ? { runId: currentDraft.runId } : 'skip',
  )
  const failedRun = useQuery(
    api.pipelineRuns.byRunId,
    failedItem ? { runId: failedItem.runId } : 'skip',
  )

  if (!open) return null

  const items: InboxItem[] = []

  // 1. The run awaiting review.
  if (currentDraft && draftRun) {
    const finished = currentDraft.completedAt != null
    items.push({
      key: `review-${currentDraft.runId}`,
      label: finished
        ? `Issue ${draftRun.issueNumber} is ready to publish`
        : `Issue ${draftRun.issueNumber}: choose the charity`,
      href: finished ? '/' : `/issues/${draftRun.issueNumber}/story`,
      dotColor: 'var(--color-cobalt)',
    })
  }

  // 2. Current-cycle failed run.
  if (failedItem) {
    items.push({
      key: `failed-${failedItem.runId}`,
      label: failedRun
        ? `Issue ${failedRun.issueNumber}: the run failed`
        : 'The latest run failed',
      href: `/run-monitor/runs/${encodeURIComponent(failedItem.runId)}`,
      dotColor: 'var(--color-vermilion)',
    })
  }

  return (
    <div
      role="dialog"
      aria-label="Awaiting you"
      className="absolute top-[52px] right-0 z-50 w-[min(360px,calc(100vw-24px))] border border-[color:var(--color-ink)]/[.16] border-t-[3px] border-t-[color:var(--color-vermilion)] bg-[color:var(--color-card)] shadow-[0_24px_50px_-20px_rgba(20,16,10,.5)]"
    >
      <div className="border-b border-[color:var(--color-ink)]/[.1] px-4 py-3">
        <h2 className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-ink)]">
          Awaiting you
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[color:var(--color-ink-soft)]">
          Nothing needs you right now.
        </p>
      ) : (
        <ul role="list">
          {items.map(item => (
            <li
              key={item.key}
              className="border-b border-[color:var(--color-ink)]/[.06] last:border-b-0"
            >
              <Link
                href={item.href}
                onClick={onClose}
                className="flex min-h-[44px] items-center gap-2.5 px-4 py-3 text-sm text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.dotColor }}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Phase 43 Plan 43-05 (D-15) — the handoff to the full My Tasks
          screen. An ADDITION: this inbox's own item derivation above is
          UNCHANGED — a separate, narrower projection than /my-tasks'
          deriveTasks(...) cross-stage list. */}
      <div className="border-t border-[color:var(--color-ink)]/[.1] px-4 py-3">
        <Link
          href="/my-tasks"
          onClick={onClose}
          className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink)] hover:text-[color:var(--color-vermilion)]"
        >
          See all →
        </Link>
      </div>
    </div>
  )
}
