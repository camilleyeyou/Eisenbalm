'use client'
/**
 * Phase 27 — RCN-01/RCN-02: IssueRevenueTable.
 *
 * Per-issue reconciliation table: Issue # / Charity / Sales window / Orders /
 * Gross / Stripe fees / Net to charity / Payout status / Action. Figures are
 * computed from ACTUAL stripeOrders by finance:perIssueRevenue (never
 * model_pricing, D-08). Each issue is matched to its payout row by issueNumber
 * and renders <PayoutRow> in the last two cells (inline mark-sent, no modal).
 *
 * An "Unattributed orders" fallback row surfaces orders outside any issue
 * window. The Stripe fee column shows "—" until the fee resolves and never
 * blocks gross/net.
 *
 * Data sources:
 *   finance:publishedIssues   → the issue list (Convex-derived; no Sanity dep)
 *   finance:perIssueRevenue   → gross/fee/net per window + unattributed bucket
 *   payouts:listByWorkspace   → payout status across all issues
 *
 * quick 260722-v01 (audit item 5): client-capped to the latest 24 issue rows
 * with a "Show all" toggle (mirrors RunsTable.tsx's client-cap exemplar) —
 * the always-visible Unattributed row sits outside the cap.
 */
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { formatCents, type IssueRevenueRow } from './FinanceSummaryCard'
import PayoutRow, { type PayoutRowData } from './PayoutRow'

interface IssueRevenueTableProps {
  workspace_id: string
}

interface PerIssueRevenueResult {
  issues: IssueRevenueRow[]
  unattributed: {
    orderCount: number
    grossCents: number
    netCents: number
    feeCents: number | null
  }
}

function formatWindowDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function SkeletonTable() {
  return (
    <div className="rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card)] p-6">
      <div className="h-32 w-full rounded-none bg-[color:var(--color-card-alt)] animate-pulse" />
    </div>
  )
}

export default function IssueRevenueTable({ workspace_id }: IssueRevenueTableProps) {
  const issues = useQuery(api.finance.publishedIssues, { workspace_id })
  const revenue = useQuery(
    api.finance.perIssueRevenue,
    issues === undefined ? 'skip' : { issues },
  ) as PerIssueRevenueResult | undefined
  const payouts = useQuery(api.payouts.listByWorkspace, { workspace_id }) as
    | PayoutRowData[]
    | undefined
  // quick 260722-v01 (audit item 5) — called unconditionally, before the
  // loading guard below, so hook order never changes across renders.
  const [showAll, setShowAll] = useState(false)

  if (issues === undefined || revenue === undefined || payouts === undefined) {
    return <SkeletonTable />
  }

  // No issues published yet.
  if (issues.length === 0 && revenue.unattributed.orderCount === 0) {
    return (
      <div className="rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card)] p-8 text-center">
        <p className="text-sm text-[color:var(--color-faint)]">
          No published issues found. Reconciliation appears here once the first
          issue is published and orders are placed.
        </p>
      </div>
    )
  }

  const payoutByIssue = new Map<number, PayoutRowData>()
  for (const p of payouts) payoutByIssue.set(p.issueNumber, p)

  const hasUnattributed = revenue.unattributed.orderCount > 0
  // quick 260722-v01 (audit item 5) — cap at the latest 24 issue rows; the
  // Unattributed bucket below is rendered unconditionally, outside the cap.
  const visibleIssueRows = showAll ? revenue.issues : revenue.issues.slice(0, 24)

  return (
    <div className="overflow-x-auto rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card)]">
      {revenue.issues.length > 24 && !showAll && (
        <p className="border-b border-[color:var(--color-ink)]/15 bg-[color:var(--color-card-alt)] px-4 py-2 text-xs text-[color:var(--color-faint)]">
          Showing latest 24 of {revenue.issues.length}
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[color:var(--color-ink)]/15 bg-[color:var(--color-card-alt)] text-left">
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
              Issue #
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
              Charity
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
              Sales window
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
              Orders
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
              Gross
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
              Stripe fees
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
              Net to charity
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
              Payout status
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleIssueRows.map(row => (
            <tr key={row.issueNumber} className="border-t border-[color:var(--color-ink)]/10">
              <td className="px-4 py-3 text-sm text-[color:var(--color-ink)]">
                {row.issueNumber}
              </td>
              <td className="px-4 py-3 text-sm text-[color:var(--color-ink)]">
                {row.charityName}
              </td>
              <td className="px-4 py-3">
                {row.windowEnd === null ? (
                  <span className="text-xs text-[color:var(--color-faint)]">
                    {formatWindowDate(row.windowStart)} — ongoing
                  </span>
                ) : (
                  <span className="text-sm text-[color:var(--color-ink-soft)]">
                    {formatWindowDate(row.windowStart)} —{' '}
                    {formatWindowDate(row.windowEnd)}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-[color:var(--color-ink)]">
                {row.orderCount}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-[color:var(--color-ink)]">
                {formatCents(row.grossCents)}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-[color:var(--color-ink)]">
                {row.feeCents === null ? '—' : formatCents(row.feeCents)}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-[color:var(--color-ink)]">
                {formatCents(row.netCents)}
              </td>
              <PayoutRow payout={payoutByIssue.get(row.issueNumber) ?? null} />
            </tr>
          ))}

          {hasUnattributed && (
            <tr className="border-t border-[color:var(--color-ink)]/10 bg-[color:var(--color-card-alt)]">
              <td className="px-4 py-3" colSpan={3}>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[color:var(--color-ink)]">
                    Unattributed orders
                  </span>
                  <span className="text-xs text-[color:var(--color-faint)]">
                    Orders outside any issue window (pre-launch or between
                    issues).
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-[color:var(--color-ink)]">
                {revenue.unattributed.orderCount}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-[color:var(--color-ink)]">
                {formatCents(revenue.unattributed.grossCents)}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-[color:var(--color-ink)]">
                {revenue.unattributed.feeCents === null
                  ? '—'
                  : formatCents(revenue.unattributed.feeCents)}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-[color:var(--color-ink)]">
                {formatCents(revenue.unattributed.netCents)}
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-[color:var(--color-faint)]">—</span>
              </td>
              <td className="px-4 py-3" />
            </tr>
          )}
        </tbody>
      </table>
      {revenue.issues.length > 24 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full border-t border-[color:var(--color-ink)]/15 px-4 py-3 text-xs font-medium text-[color:var(--color-cobalt)] hover:bg-[color:var(--color-card-alt)]"
        >
          Show all ({revenue.issues.length})
        </button>
      )}
    </div>
  )
}
