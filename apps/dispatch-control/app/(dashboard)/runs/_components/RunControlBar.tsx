'use client'
/**
 * Phase 25 (RUN-01) — Runs page header bar.
 *
 * Layout: flex row justify-between. Left: page heading. Right: Trigger Run
 * button (two-step inline confirm, no modal).
 *
 * Trigger Run logic:
 *   - Reads api.runs.latest to detect a running run.
 *   - When running: button is disabled with a title tooltip.
 *   - When idle: click → "Confirm Run?" + "Cancel" text link → POST /pipeline/run.
 *   - While POST in flight: Loader2 spinner + aria-busy.
 *
 * Inline confirm pattern (D-12): NO modal. The button label swaps in-place.
 * autoFocus on confirm so keyboard users don't re-tab.
 */
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { useAuth } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'
import { api } from '@convex/_generated/api'
import { triggerRun } from '@/lib/pipelineControlClient'

interface RunControlBarProps {
  workspace_id: string
}

export default function RunControlBar({ workspace_id }: RunControlBarProps) {
  const { getToken } = useAuth()
  const latest = useQuery(api.runs.latest, { workspace_id })

  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRunning = latest?.status === 'running'

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      await triggerRun({}, token)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  function handleCancel() {
    setConfirming(false)
    setError(null)
  }

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold text-neutral-900">Runs</h1>

      <div className="flex items-center gap-3">
        {error && (
          <span className="text-xs text-red-600">{error}</span>
        )}

        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              autoFocus
              onClick={handleConfirm}
              disabled={loading}
              aria-busy={loading}
              className="min-h-[44px] rounded-md bg-neutral-900 px-4 text-sm text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span className="sr-only">Loading…</span>
                  Confirm Run?
                </span>
              ) : (
                'Confirm Run?'
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="min-h-[44px] px-1 text-sm text-neutral-600 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setConfirming(true)
            }}
            disabled={isRunning || loading}
            title={
              isRunning
                ? 'A run is already in progress. Wait for it to complete or cancel it first.'
                : undefined
            }
            className="min-h-[44px] rounded-md bg-neutral-900 px-4 text-sm text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
          >
            Trigger Run
          </button>
        )}
      </div>
    </div>
  )
}
