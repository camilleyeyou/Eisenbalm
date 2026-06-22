'use client'
/**
 * Phase 23 — OBS-04: Run detail view.
 *
 * Displays full information for a single run:
 *   - Run header: status, trigger source, who triggered, duration, cost
 *   - Per-agent table: agentKey, status, costUsd, durationMs, tokensIn, tokensOut, error
 *   - Reconciliation panel: per-agent sum (from parseCostJson(run.cost).agents)
 *     vs. runs.cost.total — both rendered side-by-side for OBS-04 visibility
 *
 * Data sources:
 *   api.runs.byRunId       → run header + cost.total
 *   api.agentRuns.byRunId  → per-agent live status rows
 *
 * Read-only.
 */
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { parseCostJson } from '@/lib/costRollup'

interface RunDetailProps {
  runId: string
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(ms: number | undefined | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

const STATUS_CLASSES: Record<string, string> = {
  running: 'bg-blue-100 text-blue-800',
  queued: 'bg-neutral-100 text-neutral-600',
  done: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  'awaiting-review': 'bg-yellow-100 text-yellow-800',
}

export default function RunDetail({ runId }: RunDetailProps) {
  const run = useQuery(api.runs.byRunId, { runId })
  const agentRuns = useQuery(api.agentRuns.byRunId, { runId })

  if (run === undefined || agentRuns === undefined) {
    return (
      <div className="text-sm text-neutral-500 py-4">Loading run details…</div>
    )
  }

  if (run === null) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
        <p className="text-sm text-neutral-500">
          Run <code className="font-mono text-neutral-700">{runId}</code> not found.
        </p>
        <Link
          href="/runs"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          ← Back to Runs
        </Link>
      </div>
    )
  }

  const cost = parseCostJson(run.cost)
  const runStatusClass =
    STATUS_CLASSES[run.status] ?? 'bg-neutral-100 text-neutral-700'

  // Per-agent sum: sum of agents[agentKey].usd values from runs.cost.agents
  const perAgentSum = Object.values(cost.agents).reduce(
    (acc, entry) => acc + (entry.usd ?? 0),
    0,
  )

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/runs"
        className="inline-block text-sm text-blue-600 hover:text-blue-800 hover:underline"
      >
        ← Back to all runs
      </Link>

      {/* Run header */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
        <h2 className="text-base font-semibold text-neutral-900">
          Run Details
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Run ID</p>
            <p className="font-mono text-neutral-800 break-all">{run.runId}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Status</p>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${runStatusClass}`}
            >
              {run.status}
            </span>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Trigger</p>
            <p className="text-neutral-800">{run.triggerSource}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Triggered By</p>
            <p className="text-neutral-800">{run.triggeredBy ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Started</p>
            <p className="text-neutral-800">{formatTimestamp(run.startedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Duration</p>
            <p className="text-neutral-800">{formatDuration(run.durationMs)}</p>
          </div>
        </div>
      </div>

      {/* Per-agent table */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-x-auto">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-800">
            Per-Agent Status
          </h3>
        </div>
        {agentRuns.length === 0 ? (
          <div className="px-5 py-6 text-sm text-neutral-500">
            No agent runs recorded for this run yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-left">
                <th className="px-4 py-3 font-medium text-neutral-600">Agent</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Cost</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Duration</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Tokens In</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Tokens Out</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {agentRuns.map(ar => {
                const arStatusClass =
                  STATUS_CLASSES[ar.status] ?? 'bg-neutral-100 text-neutral-700'
                return (
                  <tr key={ar._id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                      {ar.agentKey}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${arStatusClass}`}
                      >
                        {ar.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {ar.costUsd != null ? `$${ar.costUsd.toFixed(4)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {formatDuration(ar.durationMs)}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {ar.tokensIn?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {ar.tokensOut?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-red-600 text-xs">
                      {ar.error ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Cost reconciliation panel (OBS-04) */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-800 mb-4">
          Cost Reconciliation
        </h3>
        <div className="flex gap-8">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
              Per-Agent Sum
            </p>
            <p className="text-lg font-semibold text-neutral-900">
              {perAgentSum > 0 ? `$${perAgentSum.toFixed(4)}` : '$0.00'}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              Sum of agents in runs.cost
            </p>
          </div>
          <div className="w-px bg-neutral-200" />
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
              runs.cost.total
            </p>
            <p className="text-lg font-semibold text-neutral-900">
              {cost.total > 0 ? `$${cost.total.toFixed(4)}` : '$0.00'}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              Recorded by pipeline recorder
            </p>
          </div>
          {Math.abs(perAgentSum - cost.total) > 0.0001 && (
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
                Discrepancy
              </p>
              <p className="text-lg font-semibold text-red-600">
                ${Math.abs(perAgentSum - cost.total).toFixed(4)}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">
                Investigate double-count
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
