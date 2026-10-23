'use client'
/**
 * Phase 23 — OBS-04: Cost roll-up component.
 *
 * Shows aggregate spend for the workspace across two windows:
 *   - Last 7 days (weekly)
 *   - Last 30 days (monthly)
 *
 * Reads runs via api.runs.listForWorkspace, filters by startedAt window, and
 * calls sumRunsCost() from the cost-rollup util. No second recorder — reads
 * the already-captured cost field on each run row.
 *
 * Rendered as a collapsible summary card above the RunsTable.
 *
 * quick 260722-v01 (audit item 9): mechanical class-token swap onto the
 * `var(--color-*)` / bracket-pixel system — no structural change.
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { formatRunLabel } from '@/lib/runLabels'
import { costTotalsToMap, effectiveRunCostUsd, sumEffectiveCost } from '@/lib/costRollup'

interface CostRollupProps {
  workspace_id: string
}

/** "Issue 47 — Charity · Oct 22" for one cost row. */
function CostRowLabel({ runId, startedAt }: { runId: string; startedAt: number }) {
  const pipelineRun = useQuery(api.pipelineRuns.byRunId, { runId })
  const pitch = useQuery(api.pitchLog.selectedByRunId, { runId })
  if (pipelineRun === undefined || pitch === undefined) return <>…</>
  return (
    <>
      {formatRunLabel({
        issueNumber: pipelineRun?.issueNumber ?? null,
        charityName: pitch?.charityName ?? null,
        startedAt,
      })}
    </>
  )
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export default function CostRollup({ workspace_id }: CostRollupProps) {
  const runs = useQuery(api.runs.listForWorkspace, { workspace_id })
  // Quick 261022-cr6 (bug 6): totals come from agent_runs, since runs.cost is never written.
  const monthRunIds = (runs ?? [])
    .filter(r => r.startedAt >= Date.now() - 30 * MS_PER_DAY)
    .map(r => r.runId)
    .slice(0, 100)
  const totalsRows = useQuery(
    api.agentRuns.costTotalsForRuns,
    runs === undefined ? 'skip' : { runIds: monthRunIds },
  )
  const totals = costTotalsToMap(totalsRows)

  if (runs === undefined) {
    return (
      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]">
        Loading what the writing cost…
      </div>
    )
  }

  const now = Date.now()
  const sevenDaysAgo = now - 7 * MS_PER_DAY
  const thirtyDaysAgo = now - 30 * MS_PER_DAY

  const runsLastWeek = runs.filter(r => r.startedAt >= sevenDaysAgo)
  const runsLastMonth = runs.filter(r => r.startedAt >= thirtyDaysAgo)

  const weekCost = sumEffectiveCost(runsLastWeek, totals)
  const monthCost = sumEffectiveCost(runsLastMonth, totals)

  // Per-run cost for the summary: most recent 5 runs with non-zero cost
  const recentWithCost = runs
    .filter(r => effectiveRunCostUsd(r.cost, totals.get(r.runId)) > 0)
    .slice(0, 5)

  return (
    <details className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)]" open>
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 select-none">
        <span className="font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-ink-soft)]">
          What the writing cost
        </span>
        <span className="text-[15px] text-[color:var(--color-faint)]">press to fold</span>
      </summary>

      <div className="border-t border-[color:var(--color-ink)]/10 px-4 pb-4 pt-3">
        {/* Aggregate windows */}
        <div className="mb-4 overflow-x-auto">
          <table className="w-full font-[family-name:var(--font-ui)] text-[15px]">
            <thead>
              <tr className="border-b border-[color:var(--color-ink)]/10 text-left">
                <th className="pb-2 pr-8 font-medium text-[color:var(--color-ink-soft)] text-[15px]">
                  When
                </th>
                <th className="pb-2 pr-8 font-medium text-[color:var(--color-ink-soft)] text-[15px]">
                  Issues
                </th>
                <th className="pb-2 font-medium text-[color:var(--color-ink-soft)] text-[15px]">
                  What it cost
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[color:var(--color-ink)]/[.06]">
                <td className="py-2 pr-8 text-[color:var(--color-ink-soft)]">Last 7 days</td>
                <td className="py-2 pr-8 text-[color:var(--color-ink-soft)]">
                  {runsLastWeek.length}
                </td>
                <td className="py-2 font-medium text-[color:var(--color-ink)]">
                  ${weekCost.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-8 text-[color:var(--color-ink-soft)]">Last 30 days</td>
                <td className="py-2 pr-8 text-[color:var(--color-ink-soft)]">
                  {runsLastMonth.length}
                </td>
                <td className="py-2 font-medium text-[color:var(--color-ink)]">
                  ${monthCost.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Recent per-run costs */}
        {recentWithCost.length > 0 && (
          <div>
            <p className="mb-2 text-[15px] font-medium text-[color:var(--color-ink-soft)] ">
              Latest issues
            </p>
            <table className="w-full font-[family-name:var(--font-ui)] text-[15px]">
              <thead>
                <tr className="border-b border-[color:var(--color-ink)]/10 text-left">
                  <th className="pb-1 pr-8 font-medium text-[color:var(--color-faint)] text-[15px]">
                    Issue
                  </th>
                  <th className="pb-1 font-medium text-[color:var(--color-faint)] text-[15px]">
                    What it cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentWithCost.map(run => (
                  <tr key={run._id} className="border-b border-[color:var(--color-ink)]/[.06]">
                    <td className="py-1.5 pr-8 text-[15px] text-[color:var(--color-ink-soft)]">
                      <CostRowLabel runId={run.runId} startedAt={run.startedAt} />
                    </td>
                    <td className="py-1.5 text-[15px] font-medium text-[color:var(--color-ink-soft)]">
                      ${effectiveRunCostUsd(run.cost, totals.get(run.runId)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {runs.length === 0 && (
          <p className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-faint)]">
            No issues yet. The cost will appear after the first issue is written.
          </p>
        )}
      </div>
    </details>
  )
}
