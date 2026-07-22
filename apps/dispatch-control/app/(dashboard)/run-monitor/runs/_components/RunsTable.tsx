'use client'
/**
 * Phase 23 — OBS-02: Run history table.
 *
 * Displays all runs for a workspace, newest-first. Each row links to the
 * run detail page at /runs/{runId}. Read-only.
 *
 * Data source: api.runs.listForWorkspace (Convex query, real-time subscription)
 */
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { parseCostJson } from '@/lib/costRollup'
import HelpTip from '@/components/ui/HelpTip'
import { HELP_COPY } from '@/components/help/helpCopy'

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

export const STATUS_CLASSES: Record<string, string> = {
  running: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  'awaiting-review': 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-neutral-100 text-neutral-600',
}

export default function RunsTable({ workspace_id }: RunsTableProps) {
  const runs = useQuery(api.runs.listForWorkspace, { workspace_id })

  if (runs === undefined) {
    return (
      <div className="text-sm text-neutral-500 py-4">Loading runs…</div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
        <p className="text-sm text-neutral-500">
          No pipeline runs recorded yet. The first run will appear here once the
          dispatch pipeline is triggered.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
            <th className="px-4 py-3 font-medium text-neutral-600">
              <span className="flex items-center gap-1">
                Status
                <HelpTip text={HELP_COPY.runMonitor.runState} label="Explain run status" />
              </span>
            </th>
            <th className="px-4 py-3 font-medium text-neutral-600">Trigger</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Triggered By</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Started</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Duration</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {runs.map(run => {
            const cost = parseCostJson(run.cost).total
            const statusClass =
              STATUS_CLASSES[run.status] ?? 'bg-neutral-100 text-neutral-700'
            return (
              <tr
                key={run._id}
                className="hover:bg-neutral-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
                  >
                    {run.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {run.triggerSource}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {run.triggeredBy ?? '—'}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {formatTimestamp(run.startedAt)}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {formatDuration(run.durationMs)}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {cost > 0 ? `$${cost.toFixed(4)}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/run-monitor/runs/${run.runId}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
