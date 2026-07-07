'use client'
/**
 * Phase 27 — RCN-01 (D-13): ModelPricingCard.
 *
 * Read-only table of `model_pricing` rows, rendered as PROJECTION pricing —
 * used only for run budget estimates, NEVER for reconciliation (D-08). When any
 * row's `updatedAt` is older than 30 days, a marigold staleness badge appears
 * (role="alert" since it surfaces after load, mirroring BudgetAlertBanner).
 *
 * Data source: finance:listModelPricing (Convex query).
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

interface ModelPricingCardProps {
  workspace_id: string
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

interface ModelPricingRow {
  _id: string
  model: string
  inputPricePer1M: number
  outputPricePer1M: number
  updatedAt: number
}

function formatUsdPerThousand(pricePer1M: number): string {
  // model_pricing stores USD per 1M tokens; the column header shows $/1K.
  const perThousand = pricePer1M / 1000
  return `$${perThousand.toFixed(4)}`
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ModelPricingCard({ workspace_id }: ModelPricingCardProps) {
  const rows = useQuery(api.finance.listModelPricing, { workspace_id }) as
    | ModelPricingRow[]
    | undefined

  // Skeleton — loads independently of the rest of the page.
  if (rows === undefined) {
    return (
      <div className="rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card)] p-6">
        <div className="mb-2 h-4 w-36 rounded-none bg-[color:var(--color-card-alt)] animate-pulse" />
        <div className="mb-4 h-3 w-64 rounded-none bg-[color:var(--color-card-alt)] animate-pulse" />
        <div className="h-24 w-full rounded-none bg-[color:var(--color-card-alt)] animate-pulse" />
      </div>
    )
  }

  const now = Date.now()
  // The most-stale row drives the badge copy (largest age beyond 30 days).
  let stalestUpdatedAt: number | null = null
  for (const r of rows) {
    if (now - r.updatedAt > THIRTY_DAYS_MS) {
      if (stalestUpdatedAt === null || r.updatedAt < stalestUpdatedAt) {
        stalestUpdatedAt = r.updatedAt
      }
    }
  }
  const staleDays =
    stalestUpdatedAt === null
      ? 0
      : Math.floor((now - stalestUpdatedAt) / (24 * 60 * 60 * 1000))

  return (
    <div className="rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card)] p-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
          Projection Pricing
        </h2>
        <p className="mt-1 text-xs text-[color:var(--color-faint)]">
          Projection only — not actual cost. Used for run budget estimates.
        </p>
      </div>

      {stalestUpdatedAt !== null && (
        <div
          role="alert"
          className="mb-4 inline-flex items-center rounded-none border border-[color:var(--color-marigold)]/40 bg-[color:var(--color-marigold)]/10 px-3 py-1.5 text-xs text-[color:var(--color-marigold-text)]"
        >
          Prices may be outdated — last updated {staleDays} days ago
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-[color:var(--color-faint)]">
          No model pricing configured yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-none border border-[color:var(--color-ink)]/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-ink)]/10 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
                  Model
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
                  Input $/1K
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
                  Output $/1K
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[color:var(--color-faint)]">
                  Last updated
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r._id} className="border-t border-[color:var(--color-ink)]/10">
                  <td className="px-4 py-3 text-sm text-[color:var(--color-ink)]">
                    {r.model}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-[color:var(--color-ink)]">
                    {formatUsdPerThousand(r.inputPricePer1M)}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-[color:var(--color-ink)]">
                    {formatUsdPerThousand(r.outputPricePer1M)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[color:var(--color-faint)]">
                    {formatDate(r.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
