'use client'
/**
 * Phase 26 (RVW-01/RVW-02) — Awaiting-review queue panel.
 * Quick 260724-lp1: the "Review →" CTA now resolves to the Draft/Story Desk
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
import { parseCostJson } from '@/lib/costRollup'
import { issueDraftHref } from '@/lib/issueRouteResolver'
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
 * One Awaiting Review card. Resolves its own issueNumber (runs rows have
 * none) so the "Review →" CTA can target the Draft/Story Desk stage
 * directly. While `pipelineRuns.byRunId` is loading/unresolved, the CTA
 * falls back to the legacy run-keyed URL — that route redirects to
 * Approval, so this is a safe loading fallback, never a dead end.
 */
function AwaitingReviewRow({
  run,
}: {
  run: { _id: string; runId: string; startedAt: number; cost?: string }
}) {
  const pRun = useQuery(api.pipelineRuns.byRunId, { runId: run.runId })
  const cost = parseCostJson(run.cost).total
  const href = pRun?.issueNumber
    ? issueDraftHref(pRun.issueNumber)
    : `/run-monitor/runs/${encodeURIComponent(run.runId)}/review`

  return (
    <li className="flex flex-col gap-3 border border-[color:var(--color-faint)] border-t-[3px] border-t-[color:var(--color-marigold)] bg-[color:var(--color-card)] p-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: run info — mockup-05 q-card idiom: chip -> Newsreader h3 -> mono meta */}
      <div className="min-w-0 flex-1">
        <span className="inline-block border border-[color:var(--color-marigold)] bg-[color:var(--color-marigold)]/[0.1] px-2 py-[3px] font-[family-name:var(--font-mono)] text-[9.5px] tracking-[.09em] uppercase text-[color:var(--color-marigold-text)]">
          Awaiting Review
        </span>
        <p className="mt-1.5 font-[family-name:var(--font-display)] text-[18px] font-semibold text-[color:var(--color-ink)] truncate">
          Run {run.runId}
        </p>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-faint)]">
          Started {formatRelativeTime(run.startedAt)}
        </p>
        {cost > 0 && (
          <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-faint)]">
            Estimated run cost ${cost.toFixed(4)}
          </p>
        )}
      </div>

      {/* Right: Review link — hard-edged ink CTA (mockup-05 .q-card .cta) */}
      <Link
        href={href}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-2 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1 transition-colors"
      >
        Review →
      </Link>
    </li>
  )
}

export default function ReviewQueue({ workspace_id }: ReviewQueueProps) {
  const runs = useQuery(api.runs.listForWorkspace, { workspace_id })

  // Filter to awaiting-review only.
  const awaitingReview = runs?.filter(r => r.status === 'awaiting-review') ?? []

  // Still loading.
  if (runs === undefined) {
    return (
      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-5">
        <h2 className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-[color:var(--color-ink)]">
          Awaiting Review
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
        <h2 className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-[color:var(--color-ink)]">
          Awaiting Review
        </h2>
        <div className="mt-4 border border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] px-4 py-6 text-center">
          <p className="font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink-soft)]">
            No runs awaiting review
          </p>
          <p className="mt-1 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
            Finished runs will appear here for your approval before publishing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-[color:var(--color-faint)] border-t-[3px] border-t-[color:var(--color-marigold)] bg-[color:var(--color-card)] p-5">
      <h2 className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-[color:var(--color-ink)]">
        Awaiting Review
      </h2>
      <ul role="list" className="mt-4 space-y-3">
        {awaitingReview.map(run => (
          <AwaitingReviewRow key={run._id} run={run} />
        ))}
      </ul>
    </div>
  )
}
