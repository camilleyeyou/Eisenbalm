'use client'
/**
 * Phase 26 (RVW-01/RVW-02) — Awaiting-review queue panel.
 * Quick 260724-lp1: the "Open the issue" CTA now resolves to the Draft/Story Desk
 * stage (`issueDraftHref`), not Approval — reviewers land where the work
 * happens instead of dead-ending at the sign-off gate. `runs.listForWorkspace`
 * rows carry NO `issueNumber` field (schema.ts), so each row resolves its own
 * issueNumber via `api.pipelineRuns.byRunId` in the extracted
 * `AwaitingReviewRow` child component below; while that query is loading (or
 * unresolvable) the link falls back to the legacy run-keyed URL, which
 * redirects to Approval — never a dead end.
 *
 * Displays runs with status "awaiting-review" above the run history table.
 *
 * Data source: api.runs.listForWorkspace (Convex real-time subscription)
 * filtered to status === "awaiting-review").
 *
 * quick 260722-v01 (audit item 9): mechanical class-token swap onto the
 * `var(--color-*)` / bracket-pixel system — no structural change.
 */
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { costTotalsToMap, effectiveRunCostUsd } from '@/lib/costRollup'
import { issueOpenHref } from '@/lib/issueRouteResolver'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { splitStaleRuns } from '@/lib/runLabels'
import { useRunLabel } from '@/lib/useRunLabel'
import { SkeletonLine } from '@/components/ui/Skeleton'

interface ReviewQueueProps {
  workspace_id: string
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * One Awaiting Review card. "Open the issue" opens the front door, where the
 * current issue is read, edited and published.
 */
function AwaitingReviewRow({
  run,
  latestRunId,
  totals,
}: {
  run: { _id: string; runId: string; startedAt: number; cost?: string; completedAt?: number }
  latestRunId: string | null | undefined
  totals: Map<string, number>
}) {
  const cost = effectiveRunCostUsd(run.cost, totals.get(run.runId))
  // Quick 261022-cr6: '/' only when this IS the current run; otherwise the
  // section editor pinned to this run.
  const href = issueOpenHref(run.runId, latestRunId)
  const label = useRunLabel(run.runId, run.startedAt)
  const chip = 'Waiting for you'

  return (
    <li className="flex flex-col gap-3 border border-[color:var(--color-faint)] border-t-[3px] border-t-[color:var(--color-marigold)] bg-[color:var(--color-card)] p-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: run info — mockup-05 q-card idiom: chip -> Newsreader h3 -> mono meta */}
      <div className="min-w-0 flex-1">
        <span className="inline-block border border-[color:var(--color-marigold)] bg-[color:var(--color-marigold)]/[0.1] px-2 py-[3px] font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-marigold-text)]">
          {chip}
        </span>
        <p className="mt-1.5 font-[family-name:var(--font-display)] text-[18px] font-semibold text-[color:var(--color-ink)] truncate">
          {label ?? 'Loading…'}
        </p>
        <p className="mt-1 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-faint)]">
          Started {formatRelativeTime(run.startedAt)}
        </p>
        {cost > 0 && (
          <p className="mt-0.5 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-faint)]">
            What this issue cost so far ${cost.toFixed(2)}
          </p>
        )}
      </div>

      {/* Right: Review link — hard-edged ink CTA (mockup-05 .q-card .cta) */}
      <Link
        href={href}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-2 font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-masthead-text)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1 transition-colors"
      >
        Open the issue
      </Link>
    </li>
  )
}

export default function ReviewQueue({ workspace_id }: ReviewQueueProps) {
  const runs = useQuery(api.runs.listForWorkspace, { workspace_id })
  const totalsRows = useQuery(
    api.agentRuns.costTotalsForRuns,
    runs === undefined
      ? 'skip'
      : { runIds: runs.filter(r => r.status === 'awaiting-review').slice(0, 100).map(r => r.runId) },
  )
  const totals = costTotalsToMap(totalsRows)
  const latest = useQuery(api.runs.latest, { workspace_id: workspace_id ?? DEFAULT_WORKSPACE_ID })

  // Filter to awaiting-review only.
  const awaitingReview = runs?.filter(r => r.status === 'awaiting-review') ?? []

  const { recent, older } = splitStaleRuns(awaitingReview, Date.now(), 14)

  // Still loading.
  if (runs === undefined) {
    return (
      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-5">
        <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold text-[color:var(--color-ink)]">
          Ready for you to read
        </h2>
        <div className="mt-2 flex flex-col gap-2">
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-4 w-2/3" />
        </div>
      </div>
    )
  }

  // Empty state.
  if (awaitingReview.length === 0) {
    return (
      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-5">
        <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold text-[color:var(--color-ink)]">
          Ready for you to read
        </h2>
        <div className="mt-4 border border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] px-4 py-6 text-center">
          <p className="font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-ink-soft)]">
            Nothing is waiting for you
          </p>
          <p className="mt-1 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]">
            Finished issues will appear here for you to read before publishing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-[color:var(--color-faint)] border-t-[3px] border-t-[color:var(--color-marigold)] bg-[color:var(--color-card)] p-5">
      <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold text-[color:var(--color-ink)]">
        Ready for you to read
      </h2>
      <ul role="list" className="mt-4 space-y-3">
        {recent.map(run => (
          <AwaitingReviewRow key={run._id} run={run} latestRunId={latest?.runId} totals={totals} />
        ))}
      </ul>
      {older.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]">
            Older unfinished issues ({older.length})
          </summary>
          <ul role="list" className="mt-3 space-y-3">
            {older.map(run => (
              <AwaitingReviewRow key={run._id} run={run} latestRunId={latest?.runId} totals={totals} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
