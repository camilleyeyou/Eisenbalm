'use client'
/**
 * Phase 25 (RUN-06) — Budget Caps configuration panel.
 *
 * Three configurable caps (all written to pipelineConfig:upsert):
 *   - per_run_cap_usd: per-run hard cap
 *   - monthly_cap_usd: monthly cap
 *   - alert_threshold_pct: soft-warn threshold (50–100%)
 *
 * Read-only projection (below inputs):
 *   - "Projected next run cost: $X.XXXX" (4-decimal trailing average)
 *   - "Month-to-date: $X.XX of $Y.YY cap" with a progress bar
 *   - "No completed runs yet — projection unavailable." when no history
 *
 * Progress bar track: 1c ink-on-15%-opacity track
 * Fill: marigold when MTD/cap >= threshold, else ink-soft
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { Loader2 } from 'lucide-react'
import { api } from '@convex/_generated/api'

interface BudgetCapsPanelProps {
  workspace_id: string
}

export default function BudgetCapsPanel({ workspace_id }: BudgetCapsPanelProps) {
  const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id })
  const mtd = useQuery(api.runs.monthToDateCost, { workspace_id })
  const upsert = useMutation(api.pipelineConfig.upsert)

  const [perRunCap, setPerRunCap] = useState('')
  const [monthlyCap, setMonthlyCap] = useState('')
  const [alertThreshold, setAlertThreshold] = useState('')

  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Parse config from Convex rows
  const configMap: Record<string, unknown> = {}
  for (const row of configRows ?? []) {
    try {
      configMap[row.key] = JSON.parse(row.value)
    } catch {
      configMap[row.key] = row.value
    }
  }

  // Sync local input state from configRows on load
  useEffect(() => {
    if (configRows === undefined) return
    setPerRunCap(String(configMap['per_run_cap_usd'] ?? '10.00'))
    setMonthlyCap(String(configMap['monthly_cap_usd'] ?? '200.00'))
    setAlertThreshold(String(configMap['alert_threshold_pct'] ?? '80'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configRows])

  const monthlyCapNum = Number(monthlyCap) || 0
  const alertThresholdNum = Number(alertThreshold) || 80

  async function handleSaveCaps() {
    setSaveLoading(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await Promise.all([
        upsert({ workspace_id, key: 'per_run_cap_usd', value: JSON.stringify(Number(perRunCap)) }),
        upsert({ workspace_id, key: 'monthly_cap_usd', value: JSON.stringify(Number(monthlyCap)) }),
        upsert({ workspace_id, key: 'alert_threshold_pct', value: JSON.stringify(Number(alertThreshold)) }),
      ])
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaveLoading(false)
    }
  }

  // Compute projection from trailing average
  const trailingCosts = mtd?.trailingCosts ?? []
  const projectedCost =
    trailingCosts.length > 0
      ? trailingCosts.reduce((a, b) => a + b, 0) / trailingCosts.length
      : null

  const mtdUsd = mtd?.mtdUsd ?? 0

  // Progress bar fill level (capped at 100%)
  const fillPct =
    monthlyCapNum > 0 ? Math.min((mtdUsd / monthlyCapNum) * 100, 100) : 0
  const overThreshold = monthlyCapNum > 0 && (mtdUsd / monthlyCapNum) * 100 >= alertThresholdNum

  if (configRows === undefined) {
    return (
      <div className="rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card)] p-5">
        <h2 className="text-base font-semibold text-[color:var(--color-ink)]">Budget Caps</h2>
        <p className="mt-2 text-sm text-[color:var(--color-faint)]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card)] p-5 space-y-5">
      <h2 className="text-base font-semibold text-[color:var(--color-ink)]">Budget Caps</h2>

      <div className="space-y-4">
        {/* Per-run cap */}
        <div className="space-y-1">
          <label
            htmlFor="per-run-cap"
            className="text-sm text-[color:var(--color-ink-soft)]"
          >
            Per-run cap (USD)
          </label>
          <input
            id="per-run-cap"
            type="number"
            min={0}
            step={0.01}
            value={perRunCap}
            onChange={e => setPerRunCap(e.target.value)}
            placeholder="e.g. 10.00"
            className="block w-full max-w-xs rounded-none border border-[color:var(--color-ink)]/15 px-3 py-1.5 text-sm text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-1"
          />
        </div>

        {/* Monthly cap */}
        <div className="space-y-1">
          <label
            htmlFor="monthly-cap"
            className="text-sm text-[color:var(--color-ink-soft)]"
          >
            Monthly cap (USD)
          </label>
          <input
            id="monthly-cap"
            type="number"
            min={0}
            step={0.01}
            value={monthlyCap}
            onChange={e => setMonthlyCap(e.target.value)}
            placeholder="e.g. 200.00"
            className="block w-full max-w-xs rounded-none border border-[color:var(--color-ink)]/15 px-3 py-1.5 text-sm text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-1"
          />
        </div>

        {/* Alert threshold */}
        <div className="space-y-1">
          <label
            htmlFor="alert-threshold"
            className="text-sm text-[color:var(--color-ink-soft)]"
          >
            Alert threshold (%)
          </label>
          <input
            id="alert-threshold"
            type="number"
            min={50}
            max={100}
            value={alertThreshold}
            onChange={e => setAlertThreshold(e.target.value)}
            className="block w-full max-w-xs rounded-none border border-[color:var(--color-ink)]/15 px-3 py-1.5 text-sm text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-1"
          />
          <p className="text-xs text-[color:var(--color-faint)]">
            Alert fires when month-to-date spend reaches this % of monthly cap
          </p>
        </div>

        {/* Save Caps button */}
        <button
          type="button"
          onClick={handleSaveCaps}
          disabled={saveLoading}
          aria-busy={saveLoading}
          className="min-h-[44px] rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card)] px-4 text-sm text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-1"
        >
          {saveLoading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading…</span>
              Save Caps
            </span>
          ) : saveSuccess ? (
            'Saved'
          ) : (
            'Save Caps'
          )}
        </button>

        {saveError && (
          <p className="text-xs text-[color:var(--color-vermilion)]">{saveError}</p>
        )}
      </div>

      {/* Read-only projection */}
      <div className="border-t border-[color:var(--color-ink)]/10 pt-4 space-y-3">
        {projectedCost !== null ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            Projected next run cost: ${projectedCost.toFixed(4)}
          </p>
        ) : (
          <p className="text-sm text-[color:var(--color-faint)]">
            No completed runs yet — projection unavailable.
          </p>
        )}

        {monthlyCapNum > 0 && (
          <div className="space-y-1">
            <p className="text-sm text-[color:var(--color-ink-soft)]">
              Month-to-date: ${mtdUsd.toFixed(2)} of ${monthlyCapNum.toFixed(2)} cap
            </p>
            <div className="h-1.5 w-full rounded-full bg-[color:var(--color-ink)]/10">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  overThreshold ? 'bg-[color:var(--color-marigold)]' : 'bg-[color:var(--color-ink-soft)]'
                }`}
                style={{ width: `${fillPct}%` }}
                role="progressbar"
                aria-valuenow={Math.round(fillPct)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
