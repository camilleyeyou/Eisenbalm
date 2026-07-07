'use client'
/**
 * Phase 25 (RUN-06) — Budget alert banner.
 *
 * Renders an amber informational banner when month-to-date spend has crossed
 * the configured alert threshold. Dismissible by the operator.
 *
 * Rendered ABOVE the RunControlBar on the Runs page (conditionally — renders
 * nothing when the threshold has not been crossed or no cap is set).
 *
 * role="alert" so screen readers announce the banner on appearance.
 */
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { AlertTriangle, X } from 'lucide-react'
import { api } from '@convex/_generated/api'

interface BudgetAlertBannerProps {
  workspace_id: string
}

export default function BudgetAlertBanner({ workspace_id }: BudgetAlertBannerProps) {
  const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id })
  const mtd = useQuery(api.runs.monthToDateCost, { workspace_id })
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || configRows === undefined || mtd === undefined) {
    return null
  }

  // Parse relevant config keys.
  const configMap: Record<string, unknown> = {}
  for (const row of configRows) {
    try {
      configMap[row.key] = JSON.parse(row.value)
    } catch {
      configMap[row.key] = row.value
    }
  }

  const monthlyCap = Number(configMap['monthly_cap_usd'] ?? 0)
  const alertThreshold = Number(configMap['alert_threshold_pct'] ?? 80)

  // Only render when a cap is set and the threshold has been crossed.
  if (monthlyCap <= 0) return null

  const pct = mtd.mtdUsd / monthlyCap
  if (pct * 100 < alertThreshold) return null

  const pctDisplay = Math.round(pct * 100)
  const mtdDisplay = mtd.mtdUsd.toFixed(2)
  const capDisplay = monthlyCap.toFixed(2)

  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          Month-to-date spend has reached {pctDisplay}% of your monthly cap ($
          {mtdDisplay} of ${capDisplay}). Add capacity or pause automation.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss budget alert"
        className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded text-amber-700 hover:text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
