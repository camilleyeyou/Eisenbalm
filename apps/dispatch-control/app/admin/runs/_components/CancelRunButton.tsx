'use client'
/**
 * Phase 25 (RUN-04) — Cancel Run button for the Run detail page.
 *
 * Renders ONLY when the run status is "running". Does not render for terminal
 * states (cancelled, done, failed).
 *
 * Two-step inline confirm (D-12 pattern — no modal):
 *   1. Click "Cancel Run" → swap to "Confirm Cancel?" + "Keep Running" link.
 *   2. Confirm → POST /runs/{id}/cancel via cancelRun; run status badge updates
 *      via the existing Convex subscription (no manual refetch needed).
 *   3. Dismiss → revert to idle.
 *
 * autoFocus on "Confirm Cancel?" so keyboard users land on the confirm step
 * without needing to re-tab.
 *
 * quick 260722-v01 (audit item 9): mechanical class-token swap onto the
 * `var(--color-*)` / bracket-pixel system — no structural change.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'
import { cancelRun } from '@/lib/pipelineControlClient'

interface CancelRunButtonProps {
  runId: string
  status: string
}

export default function CancelRunButton({ runId, status }: CancelRunButtonProps) {
  const { getToken } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only render for running runs (RUN-04).
  if (status !== 'running') return null

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      await cancelRun(runId, token)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  function handleKeepRunning() {
    setConfirming(false)
    setError(null)
  }

  return (
    <div className="flex items-center gap-3">
      {error && (
        <span className="text-[11px] text-[color:var(--color-vermilion)]">{error}</span>
      )}

      {confirming ? (
        <>
          <button
            type="button"
            autoFocus
            onClick={handleConfirm}
            disabled={loading}
            aria-busy={loading}
            className="min-h-[44px] border border-[color:var(--color-vermilion)] bg-[color:var(--color-card)] px-4 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-vermilion)] hover:bg-[color:var(--color-vermilion)]/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span className="sr-only">Loading…</span>
                Confirm Cancel?
              </span>
            ) : (
              'Confirm Cancel?'
            )}
          </button>
          <button
            type="button"
            onClick={handleKeepRunning}
            disabled={loading}
            className="min-h-[44px] px-1 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
          >
            Keep Running
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null)
            setConfirming(true)
          }}
          className="min-h-[44px] border border-[color:var(--color-vermilion)] bg-[color:var(--color-card)] px-4 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-vermilion)] hover:bg-[color:var(--color-vermilion)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
        >
          Cancel Run
        </button>
      )}
    </div>
  )
}
