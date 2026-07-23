'use client'
/**
 * Phase 37 (MON-04, D-08) — DriftStrip: current run vs the trailing 8
 * COMPLETED runs, cost + duration.
 *
 * Client-side aggregation over existing data — no new table (D-08). Reads
 * `pipelineRuns.byRunId(runId).cost` (JSON, parsed via the existing
 * `parseCostJson`) and `.durationMs` per run — these are reliably populated
 * by the Publisher/failure/cancel paths. It intentionally does NOT read the
 * sibling dashboard table's own per-run cost/duration fields — those are
 * never written by any mutation and always resolve to undefined (see
 * 37-RESEARCH.md Pitfall 5 for the full trace).
 *
 * `runs.listForWorkspace` supplies the candidate run list + statuses.
 * "Completed" here means status 'complete' or 'awaiting-review' WITH
 * `completedAt` set (Pitfall 4 disambiguator — a Gate-1-paused
 * 'awaiting-review' row has no completedAt yet and is excluded). The most
 * recent 8 by startedAt (excluding the current run) form the trailing set;
 * fewer than 8 existing means compare against what exists and label the n.
 *
 * Research Pattern 1: `useQuery` cannot be called a variable number of
 * times inside one component body, so each trailing runId (and the current
 * run) gets its own `DriftBar` child with its own `useQuery` call — the
 * hook count stays stable regardless of how many trailing runs exist.
 *
 * quick 260722-v01 (audit item 9): mechanical class-token swap onto the
 * `var(--color-*)` / bracket-pixel system — no structural change. Preserves
 * every `data-testid` (DriftStrip.test.tsx asserts text/behavior, not
 * classes — see plan RESEARCH).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { parseCostJson } from '@/lib/costRollup'

export interface DriftStripProps {
  currentRunId: string
  workspace_id: string
}

interface RunListRow {
  runId: string
  status: string
  completedAt?: number
  startedAt: number
}

interface RunMetrics {
  cost: number
  durationMs?: number
}

/** Both statuses that can mean "this run has finished" (Pitfall 4). */
const COMPLETED_STATUSES = new Set(['complete', 'awaiting-review'])

/**
 * Fetches ONE run's `pipelineRuns` row and reports `{cost, durationMs}` up
 * to the parent via `onData` once loaded. Renders nothing itself — purely
 * a per-row data-fetcher (Research Pattern 1) so the trailing set's size
 * never changes the number of `useQuery` calls any single component makes.
 */
function DriftBar({
  runId,
  onData,
}: {
  runId: string
  onData: (runId: string, data: RunMetrics) => void
}) {
  const run = useQuery(api.pipelineRuns.byRunId, { runId }) as
    | { cost?: string; durationMs?: number }
    | null
    | undefined

  useEffect(() => {
    if (run === undefined || run === null) return
    onData(runId, { cost: parseCostJson(run.cost).total, durationMs: run.durationMs })
  }, [run, runId, onData])

  return null
}

/** `N% over` / `N% under` / `on par` / `—` (no comparison data yet). */
function formatDelta(pct: number | undefined): string {
  if (pct == null) return '—'
  const rounded = Math.round(pct)
  if (rounded === 0) return 'on par'
  return rounded > 0 ? `${rounded}% over` : `${Math.abs(rounded)}% under`
}

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function deltaPct(current: number | undefined, avg: number | undefined): number | undefined {
  if (current == null || avg == null || avg === 0) return undefined
  return ((current - avg) / avg) * 100
}

function deltaColorClass(pct: number | undefined): string {
  if (pct == null || pct === 0) return 'text-[color:var(--color-faint)]'
  return pct > 0 ? 'text-[color:var(--color-vermilion)]' : 'text-[color:var(--color-green)]'
}

export function DriftStrip({ currentRunId, workspace_id }: DriftStripProps) {
  const runs = useQuery(api.runs.listForWorkspace, { workspace_id }) as
    | RunListRow[]
    | undefined

  // Most recent 8 COMPLETED runs (excluding the current run), newest-first.
  const trailingRunIds = useMemo(() => {
    if (!runs) return []
    return runs
      .filter(
        r =>
          r.runId !== currentRunId &&
          COMPLETED_STATUSES.has(r.status) &&
          r.completedAt != null,
      )
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 8)
      .map(r => r.runId)
  }, [runs, currentRunId])

  const [trailingData, setTrailingData] = useState<Record<string, RunMetrics>>({})
  const [currentData, setCurrentData] = useState<RunMetrics | undefined>(undefined)

  const handleTrailingData = useCallback((runId: string, data: RunMetrics) => {
    setTrailingData(prev => {
      const existing = prev[runId]
      if (existing && existing.cost === data.cost && existing.durationMs === data.durationMs) {
        return prev
      }
      return { ...prev, [runId]: data }
    })
  }, [])

  const handleCurrentData = useCallback((_runId: string, data: RunMetrics) => {
    setCurrentData(prev =>
      prev && prev.cost === data.cost && prev.durationMs === data.durationMs ? prev : data,
    )
  }, [])

  const trailingCosts = trailingRunIds
    .map(id => trailingData[id]?.cost)
    .filter((v): v is number => v != null)
  const trailingDurations = trailingRunIds
    .map(id => trailingData[id]?.durationMs)
    .filter((v): v is number => v != null)

  const meanCost = mean(trailingCosts)
  const meanDuration = mean(trailingDurations)

  const costDeltaPct = deltaPct(currentData?.cost, meanCost)
  const durationDeltaPct = deltaPct(currentData?.durationMs, meanDuration)

  return (
    <div
      className="flex flex-wrap items-center gap-6 border-b border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-4 py-2 text-[11px]"
      role="region"
      aria-label="Run drift vs trailing completed runs"
    >
      {/* Per-row data fetchers — render nothing, Research Pattern 1. */}
      {trailingRunIds.map(id => (
        <DriftBar key={id} runId={id} onData={handleTrailingData} />
      ))}
      <DriftBar runId={currentRunId} onData={handleCurrentData} />

      <span className="font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">Drift</span>

      <span data-testid="drift-cost" className="text-[color:var(--color-ink-soft)]">
        Cost: {currentData?.cost != null ? `$${currentData.cost.toFixed(4)}` : '—'}
        {' · '}
        <span data-testid="drift-cost-delta" className={deltaColorClass(costDeltaPct)}>
          {formatDelta(costDeltaPct)}
        </span>
      </span>

      <span data-testid="drift-duration" className="text-[color:var(--color-ink-soft)]">
        Duration:{' '}
        {currentData?.durationMs != null
          ? `${(currentData.durationMs / 1000).toFixed(1)}s`
          : '—'}
        {' · '}
        <span data-testid="drift-duration-delta" className={deltaColorClass(durationDeltaPct)}>
          {formatDelta(durationDeltaPct)}
        </span>
      </span>

      <span data-testid="drift-trailing-count" className="text-[color:var(--color-faint)]">
        vs last {trailingRunIds.length}
      </span>
    </div>
  )
}
