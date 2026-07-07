'use client'
/**
 * Phase 26 (RVW-01/RVW-02) — Awaiting-review queue panel.
 *
 * Displays runs with status "awaiting-review" above the run history table.
 * Each card links to the review screen at /runs/{runId}/review.
 *
 * Data source: api.runs.listForWorkspace (Convex real-time subscription)
 * filtered to status === "awaiting-review".
 */
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { parseCostJson } from '@/lib/costRollup'

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

export default function ReviewQueue({ workspace_id }: ReviewQueueProps) {
  const runs = useQuery(api.runs.listForWorkspace, { workspace_id })

  // Filter to awaiting-review only.
  const awaitingReview = runs?.filter(r => r.status === 'awaiting-review') ?? []

  // Still loading.
  if (runs === undefined) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">Awaiting Review</h2>
        <p className="mt-2 text-sm text-neutral-500">Loading…</p>
      </div>
    )
  }

  // Empty state.
  if (awaitingReview.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">Awaiting Review</h2>
        <div className="mt-4 rounded-md bg-neutral-50 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-neutral-700">No runs awaiting review</p>
          <p className="mt-1 text-sm text-neutral-500">
            Finished runs will appear here for your approval before publishing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <h2 className="text-base font-semibold text-neutral-900">Awaiting Review</h2>
      <ul role="list" className="mt-4 space-y-3">
        {awaitingReview.map(run => {
          const cost = parseCostJson(run.cost).total
          return (
            <li
              key={run._id}
              className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              {/* Left: run info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    Awaiting Review
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-neutral-900 truncate">
                  Run {run.runId}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Started {formatRelativeTime(run.startedAt)}
                </p>
                {cost > 0 && (
                  <p className="mt-0.5 text-xs text-neutral-500">
                    <span className="font-medium">Estimated run cost</span>{' '}
                    ${cost.toFixed(4)}
                  </p>
                )}
              </div>

              {/* Right: Review link */}
              <Link
                href={`/run-monitor/runs/${encodeURIComponent(run.runId)}/review`}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 transition-colors"
              >
                Review →
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
