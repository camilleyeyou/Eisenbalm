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
import { parseCostJson, sumRunsCost } from '@/lib/costRollup'

interface CostRollupProps {
  workspace_id: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export default function CostRollup({ workspace_id }: CostRollupProps) {
  const runs = useQuery(api.runs.listForWorkspace, { workspace_id })

  if (runs === undefined) {
    return (
      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
        Loading cost data…
      </div>
    )
  }

  const now = Date.now()
  const sevenDaysAgo = now - 7 * MS_PER_DAY
  const thirtyDaysAgo = now - 30 * MS_PER_DAY

  const runsLastWeek = runs.filter(r => r.startedAt >= sevenDaysAgo)
  const runsLastMonth = runs.filter(r => r.startedAt >= thirtyDaysAgo)

  const weekCost = sumRunsCost(runsLastWeek)
  const monthCost = sumRunsCost(runsLastMonth)

  // Per-run cost for the summary: most recent 5 runs with non-zero cost
  const recentWithCost = runs
    .filter(r => parseCostJson(r.cost).total > 0)
    .slice(0, 5)

  return (
    <details className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)]" open>
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 select-none">
        <span className="font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink-soft)]">
          Spend Summary
        </span>
        <span className="text-[11px] text-[color:var(--color-faint)]">click to collapse</span>
      </summary>

      <div className="border-t border-[color:var(--color-ink)]/10 px-4 pb-4 pt-3">
        {/* Aggregate windows */}
        <div className="mb-4 overflow-x-auto">
          <table className="w-full font-[family-name:var(--font-ui)] text-[13px]">
            <thead>
              <tr className="border-b border-[color:var(--color-ink)]/10 text-left">
                <th className="pb-2 pr-8 font-medium text-[color:var(--color-ink-soft)] text-[11px] uppercase tracking-wide">
                  Window
                </th>
                <th className="pb-2 pr-8 font-medium text-[color:var(--color-ink-soft)] text-[11px] uppercase tracking-wide">
                  Runs
                </th>
                <th className="pb-2 font-medium text-[color:var(--color-ink-soft)] text-[11px] uppercase tracking-wide">
                  Total Cost
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
                  {weekCost > 0 ? `$${weekCost.toFixed(4)}` : '$0.00'}
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-8 text-[color:var(--color-ink-soft)]">Last 30 days</td>
                <td className="py-2 pr-8 text-[color:var(--color-ink-soft)]">
                  {runsLastMonth.length}
                </td>
                <td className="py-2 font-medium text-[color:var(--color-ink)]">
                  {monthCost > 0 ? `$${monthCost.toFixed(4)}` : '$0.00'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Recent per-run costs */}
        {recentWithCost.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-medium text-[color:var(--color-ink-soft)] uppercase tracking-wide">
              Recent run costs
            </p>
            <table className="w-full font-[family-name:var(--font-ui)] text-[13px]">
              <thead>
                <tr className="border-b border-[color:var(--color-ink)]/10 text-left">
                  <th className="pb-1 pr-8 font-medium text-[color:var(--color-faint)] text-[11px]">
                    Run ID
                  </th>
                  <th className="pb-1 pr-8 font-medium text-[color:var(--color-faint)] text-[11px]">
                    Trigger
                  </th>
                  <th className="pb-1 font-medium text-[color:var(--color-faint)] text-[11px]">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentWithCost.map(run => (
                  <tr key={run._id} className="border-b border-[color:var(--color-ink)]/[.06]">
                    <td className="py-1.5 pr-8 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
                      {run.runId.slice(0, 16)}…
                    </td>
                    <td className="py-1.5 pr-8 text-[11px] text-[color:var(--color-ink-soft)]">
                      {run.triggerSource}
                    </td>
                    <td className="py-1.5 text-[11px] font-medium text-[color:var(--color-ink-soft)]">
                      ${parseCostJson(run.cost).total.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {runs.length === 0 && (
          <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-faint)]">
            No runs yet — cost data will appear after the first pipeline run.
          </p>
        )}
      </div>
    </details>
  )
}
