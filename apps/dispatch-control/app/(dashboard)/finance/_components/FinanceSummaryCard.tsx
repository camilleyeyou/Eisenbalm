'use client'
/**
 * Phase 27 — RCN-01: FinanceSummaryCard (the primary visual anchor).
 *
 * Renders the latest issue's "This Issue" top-line: Gross sales / Stripe fees /
 * Net to charity, computed from ACTUAL stripeOrders (never model_pricing, D-08).
 * Prominence comes from semibold weight + whitespace — NOT a larger font size
 * (text-xl is the largest size in the dashboard type scale; no text-2xl).
 *
 * The fees cell shows "—" until the Stripe fee is resolved/cached (feeCents
 * null) and never blocks the gross/net figures.
 */

/** A single reconciled issue row from finance:perIssueRevenue. */
export interface IssueRevenueRow {
  issueNumber: number
  issueId?: string
  charitySlug: string
  charityName: string
  windowStart: number
  windowEnd: number | null
  orderCount: number
  grossCents: number
  netCents: number
  feeCents: number | null
}

interface FinanceSummaryCardProps {
  /** The current (latest) issue's reconciliation row, or null/undefined while loading. */
  row: IssueRevenueRow | null | undefined
  /** Currency code for formatting (defaults to USD). */
  currency?: string
}

/** Format integer cents as a localized currency string. */
export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function StatCell({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-xl font-semibold tabular-nums text-neutral-900">
        {value}
      </span>
    </div>
  )
}

export default function FinanceSummaryCard({
  row,
  currency = 'USD',
}: FinanceSummaryCardProps) {
  // Skeleton state — section loads independently (no full-page spinner).
  if (row === undefined) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <div className="mb-4 h-4 w-24 rounded bg-neutral-100 animate-pulse" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex flex-col gap-2">
              <div className="h-3 w-20 rounded bg-neutral-100 animate-pulse" />
              <div className="h-6 w-28 rounded bg-neutral-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold text-neutral-800">This Issue</h2>

      {row === null ? (
        <p className="text-sm text-neutral-500">
          No orders recorded for this issue window yet. Orders appear here as
          they are processed through Stripe.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <StatCell
            label="Gross sales"
            value={formatCents(row.grossCents, currency)}
          />
          <StatCell
            label="Stripe fees"
            value={
              row.feeCents === null ? '—' : formatCents(row.feeCents, currency)
            }
          />
          <StatCell
            label="Net to charity"
            value={formatCents(row.netCents, currency)}
          />
        </div>
      )}
    </div>
  )
}
