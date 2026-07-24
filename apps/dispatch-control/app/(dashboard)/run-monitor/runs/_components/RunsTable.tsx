'use client'
/**
 * Phase 23 — OBS-02: Run history table.
 *
 * Displays all runs for a workspace, newest-first. Each row links to the
 * run detail page at /runs/{runId}. Read-only.
 *
 * Data source: api.runs.listRecentForWorkspace (Convex query, real-time
 * subscription — server-side capped to the latest 100 rows, see quick
 * 260722-v01 below).
 *
 * quick 260722-tv1: client-capped to the latest 50 rows (runs is already
 * newest-first) with a "Show all" toggle — an unbounded table ran
 * indefinitely long on a workspace with a long run history.
 *
 * quick 260722-v01 (audit item 3): switched from `api.runs.listForWorkspace`
 * (full-collect) to the additive `api.runs.listRecentForWorkspace`
 * (server-side `take(100)`, same newest-first ordering) — this table only
 * ever renders 50 rows client-side anyway. ReviewQueue/CostRollup/DriftStrip
 * are untouched and still subscribe to `listForWorkspace`.
 *
 * quick 260722-v01 (audit item 9): mechanical class-token swap onto the
 * `var(--color-*)` / bracket-pixel system used across the issues/workspace
 * surfaces — no structural change, no testid/behavior change.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { parseCostJson } from '@/lib/costRollup'
import HelpTip from '@/components/ui/HelpTip'
import { HELP_COPY } from '@/components/help/helpCopy'
import { SkeletonLine } from '@/components/ui/Skeleton'

interface RunsTableProps {
  workspace_id: string
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(ms: number | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

// quick 260724-lp1 — rewritten to the uniform square-chip recipe (mockup 05
// `.chip`): 1px matching-hue border + tinted fill, mono-caps label. Failed
// is the only status with a solid fill (the one chip allowed a solid).
export const STATUS_CLASSES: Record<string, string> = {
  running: 'border-[color:var(--color-cobalt)] bg-[color:var(--color-cobalt)]/[0.06] text-[color:var(--color-cobalt)]',
  done: 'border-[color:var(--color-green)] bg-[color:var(--color-green)]/[0.07] text-[color:var(--color-green)]',
  failed: 'border-[color:var(--color-vermilion)] bg-[color:var(--color-vermilion)] text-white',
  'awaiting-review': 'border-[color:var(--color-marigold)] bg-[color:var(--color-marigold)]/[0.1] text-[color:var(--color-marigold-text)]',
  cancelled: 'border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] text-[color:var(--color-ink-soft)]',
}

/** Uniform square-chip base classes (mockup 05 `.chip`). */
const CHIP_BASE =
  'inline-block border px-2 py-[3px] font-[family-name:var(--font-mono)] text-[9.5px] tracking-[.09em] uppercase whitespace-nowrap'

export default function RunsTable({ workspace_id }: RunsTableProps) {
  const runs = useQuery(api.runs.listRecentForWorkspace, { workspace_id })
  // Called unconditionally (before the loading/empty guards below) so the
  // hook order never changes across renders of this component instance.
  const [showAll, setShowAll] = useState(false)

  if (runs === undefined) {
    return (
      <div className="flex flex-col gap-2 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonLine key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-8 text-center">
        <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
          No pipeline runs recorded yet. The first run will appear here once the
          dispatch pipeline is triggered.
        </p>
      </div>
    )
  }

  // runs is already newest-first from the query — the first 50 are the most
  // recent.
  const visibleRuns = showAll ? runs : runs.slice(0, 50)

  return (
    <div className="overflow-x-auto border border-[color:var(--color-faint)] bg-[color:var(--color-card)]">
      <table className="w-full font-[family-name:var(--font-ui)] text-[13px]">
        <thead>
          <tr className="border-b border-[color:var(--color-faint)] text-left">
            <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
              <span className="flex items-center gap-1">
                Status
                <HelpTip text={HELP_COPY.runMonitor.runState} label="Explain run status" />
              </span>
            </th>
            <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
              Trigger
            </th>
            <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
              Triggered By
            </th>
            <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
              Started
            </th>
            <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
              Duration
            </th>
            <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
              Cost
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {visibleRuns.map((run, i) => {
            const cost = parseCostJson(run.cost).total
            const statusClass =
              STATUS_CLASSES[run.status] ??
              'border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] text-[color:var(--color-ink-soft)]'
            const isLast = i === visibleRuns.length - 1
            return (
              <tr
                key={run._id}
                className={`hover:bg-[color:var(--color-card-alt)] transition-colors ${isLast ? '' : 'border-b border-[color:var(--color-faint)]'}`}
              >
                <td className="px-4 py-3">
                  <span className={`${CHIP_BASE} ${statusClass}`}>{run.status}</span>
                </td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
                  {run.triggerSource}
                </td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
                  {run.triggeredBy ?? '—'}
                </td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
                  {formatTimestamp(run.startedAt)}
                </td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
                  {formatDuration(run.durationMs)}
                </td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
                  {cost > 0 ? `$${cost.toFixed(4)}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/run-monitor/runs/${run.runId}`}
                    className="text-[color:var(--color-cobalt)] hover:text-[color:var(--color-cobalt-dark)] hover:underline text-[12px] font-semibold"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {runs.length > 50 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full border-t border-[color:var(--color-faint)] px-4 py-3 text-[11px] font-medium text-[color:var(--color-cobalt)] hover:bg-[color:var(--color-card-alt)]"
        >
          Show all ({runs.length})
        </button>
      )}
    </div>
  )
}
