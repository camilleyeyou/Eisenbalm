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
 */
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
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <div className="h-32 w-full rounded bg-neutral-100 animate-pulse" />
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

  if (issues === undefined || revenue === undefined || payouts === undefined) {
    return <SkeletonTable />
  }

  // No issues published yet.
  if (issues.length === 0 && revenue.unattributed.orderCount === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
        <p className="text-sm text-neutral-500">
          No published issues found. Reconciliation appears here once the first
          issue is published and orders are placed.
        </p>
      </div>
    )
  }

  const payoutByIssue = new Map<number, PayoutRowData>()
  for (const p of payouts) payoutByIssue.set(p.issueNumber, p)

  const hasUnattributed = revenue.unattributed.orderCount > 0

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Issue #
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Charity
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Sales window
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Orders
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Gross
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Stripe fees
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Net to charity
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Payout status
            </th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {revenue.issues.map(row => (
            <tr key={row.issueNumber} className="border-t border-neutral-100">
              <td className="px-4 py-3 text-sm text-neutral-800">
                {row.issueNumber}
              </td>
              <td className="px-4 py-3 text-sm text-neutral-800">
                {row.charityName}
              </td>
              <td className="px-4 py-3">
                {row.windowEnd === null ? (
                  <span className="text-xs text-neutral-400">
                    {formatWindowDate(row.windowStart)} — ongoing
                  </span>
                ) : (
                  <span className="text-sm text-neutral-700">
                    {formatWindowDate(row.windowStart)} —{' '}
                    {formatWindowDate(row.windowEnd)}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-neutral-900">
                {row.orderCount}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-neutral-900">
                {formatCents(row.grossCents)}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-neutral-900">
                {row.feeCents === null ? '—' : formatCents(row.feeCents)}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-neutral-900">
                {formatCents(row.netCents)}
              </td>
              <PayoutRow payout={payoutByIssue.get(row.issueNumber) ?? null} />
            </tr>
          ))}

          {hasUnattributed && (
            <tr className="border-t border-neutral-100 bg-neutral-50">
              <td className="px-4 py-3" colSpan={3}>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-800">
                    Unattributed orders
                  </span>
                  <span className="text-xs text-neutral-400">
                    Orders outside any issue window (pre-launch or between
                    issues).
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-neutral-900">
                {revenue.unattributed.orderCount}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-neutral-900">
                {formatCents(revenue.unattributed.grossCents)}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-neutral-900">
                {revenue.unattributed.feeCents === null
                  ? '—'
                  : formatCents(revenue.unattributed.feeCents)}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-neutral-900">
                {formatCents(revenue.unattributed.netCents)}
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-neutral-400">—</span>
              </td>
              <td className="px-4 py-3" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
