'use client'
/**
 * Phase 23 — OBS-02: Past issues table (relabelled for the editor by plan 56-10).
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
import { costTotalsToMap, effectiveRunCostUsd } from '@/lib/costRollup'
import { SkeletonLine } from '@/components/ui/Skeleton'
import StatusWord from '@/components/editor/StatusWord'
import { formatRunLabel, splitStaleRuns } from '@/lib/runLabels'
import { runStatusWord } from '@/lib/editorState'
import type { StatusWord as StatusWordName } from '@/lib/nomenclature'
import { adminRunHref } from '@/lib/issueRouteResolver'

interface RunsTableProps {
  workspace_id: string
}

type Row = {
  _id: string
  runId: string
  startedAt: number
  status: string
  cost?: string
  durationMs?: number
  triggeredBy?: string
}

/** Stored status ('done' is a legacy spelling of 'complete') to one of the six words. */
export function statusWordForRow(status: string): StatusWordName {
  return runStatusWord({ status: status === 'done' ? 'complete' : status })
}

/** Every stored status mapped to the six status words (replaces the old coloured chip classes). */
export const STATUS_WORDS_FOR_RUN: Record<string, StatusWordName> = {
  running: statusWordForRow('running'),
  done: statusWordForRow('done'),
  complete: statusWordForRow('complete'),
  failed: statusWordForRow('failed'),
  'awaiting-review': statusWordForRow('awaiting-review'),
  cancelled: statusWordForRow('cancelled'),
}

function formatDuration(ms: number | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return 'Under a second'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} sec`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m} min ${rem} sec` : `${m} min`
}

/** Plain-word label for one issue ("Issue 47 — Charity · Oct 22"), linked to its step-by-step page. */
function RunLabelCell({ runId, startedAt }: { runId: string; startedAt: number }) {
  const pipelineRun = useQuery(api.pipelineRuns.byRunId, { runId })
  const pitch = useQuery(api.pitchLog.selectedByRunId, { runId })
  const label =
    pipelineRun === undefined || pitch === undefined
      ? '…'
      : formatRunLabel({
          issueNumber: pipelineRun?.issueNumber ?? null,
          charityName: pitch?.charityName ?? null,
          startedAt,
        })
  return (
    <Link
      href={adminRunHref(runId)}
      className="min-h-[48px] inline-flex items-center font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-ink)] hover:underline editor-focus"
    >
      {label}
    </Link>
  )
}

const TH = 'px-4 py-3 font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-ink-soft)]'
const TD = 'px-4 py-3 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]'

function IssueRows({ rows, totals }: { rows: Row[]; totals: Map<string, number> }) {
  return (
    <table className="w-full font-[family-name:var(--font-ui)] text-[15px]">
      <thead>
        <tr className="border-b border-[color:var(--color-faint)] text-left">
          <th className={TH}>Issue</th>
          <th className={TH}>Where it stands</th>
          <th className={TH}>Started by</th>
          <th className={TH}>Started</th>
          <th className={TH}>How long</th>
          <th className={TH}>What it cost</th>
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody>
        {rows.map((run, i) => {
          const cost = effectiveRunCostUsd(run.cost, totals.get(run.runId))
          const isLast = i === rows.length - 1
          return (
            <tr
              key={run._id}
              className={`hover:bg-[color:var(--color-card-alt)] transition-colors ${isLast ? '' : 'border-b border-[color:var(--color-faint)]'}`}
            >
              <td className="px-4 py-1">
                <RunLabelCell runId={run.runId} startedAt={run.startedAt} />
              </td>
              <td className="px-4 py-3">
                <StatusWord word={statusWordForRow(run.status)} />
              </td>
              <td className={TD}>{run.triggeredBy ?? '—'}</td>
              <td className={TD}>
                {new Date(run.startedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </td>
              <td className={TD}>{formatDuration(run.durationMs)}</td>
              <td className={TD}>{cost > 0 ? `$${cost.toFixed(2)}` : '—'}</td>
              <td className="px-4 py-1">
                <Link
                  href={adminRunHref(run.runId)}
                  className="min-h-[48px] inline-flex items-center font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-cobalt)] underline editor-focus"
                >
                  See the steps
                </Link>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function RunsTable({ workspace_id }: RunsTableProps) {
  const runs = useQuery(api.runs.listRecentForWorkspace, { workspace_id })
  // Called unconditionally (before the loading/empty guards below) so the
  // hook order never changes across renders of this component instance.
  const [showAll, setShowAll] = useState(false)
  const totalsRows = useQuery(
    api.agentRuns.costTotalsForRuns,
    runs === undefined ? 'skip' : { runIds: runs.slice(0, 100).map(r => r.runId) },
  )
  const totals = costTotalsToMap(totalsRows)

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
        <p className="font-[family-name:var(--font-body)] text-[17px] text-[color:var(--color-ink-soft)]">
          No issues yet. Start a new issue and it will be listed here.
        </p>
      </div>
    )
  }

  // Newest first from the query. Unfinished issues older than 14 days sit behind a closed fold.
  const { recent, older } = splitStaleRuns(runs, Date.now(), 14)
  const visible = showAll ? recent : recent.slice(0, 50)

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-[color:var(--color-faint)] bg-[color:var(--color-card)]">
        <IssueRows rows={visible} totals={totals} />
        {recent.length > 50 && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="min-h-[48px] w-full border-t border-[color:var(--color-faint)] px-4 py-3 font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-cobalt)] hover:bg-[color:var(--color-card-alt)] editor-focus"
          >
            Show every issue ({recent.length})
          </button>
        )}
      </div>
      {older.length > 0 && (
        <details className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)]">
          <summary className="min-h-[48px] cursor-pointer px-4 py-3 font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-ink-soft)]">
            Older unfinished issues ({older.length})
          </summary>
          <div className="overflow-x-auto border-t border-[color:var(--color-faint)]">
            <IssueRows rows={older} totals={totals} />
          </div>
        </details>
      )}
    </div>
  )
}
