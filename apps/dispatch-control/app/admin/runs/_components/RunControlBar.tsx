'use client'
/**
 * Phase 25 (RUN-01) — Runs page header bar.
 *
 * Layout: flex row justify-between. Left: heading. Right: Start a new issue
 * button (two-step inline confirm, no modal).
 *
 * Start logic:
 *   - Reads api.runs.latest to detect a running run.
 *   - When running: button is disabled with a title tooltip.
 *   - When idle: click → "Yes, start it" + "Cancel" text link → POST /pipeline/run.
 *   - While POST in flight: Loader2 spinner + aria-busy.
 *
 * Inline confirm pattern (D-12): NO modal. The button label swaps in-place.
 * autoFocus on confirm so keyboard users don't re-tab.
 *
 * quick 260722-v01 (audit item 9): mechanical class-token swap onto the
 * `var(--color-*)` / bracket-pixel system — no structural change.
 *
 * quick 260724-lp1: adds the uniform page-head kicker above the existing
 * "Runs" heading (markup-only) and squares off the two ink primary buttons
 * (rounded-md -> hard edge). No handler/behavior change.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { useAuth } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'
import { api } from '@convex/_generated/api'
import { triggerRun } from '@/lib/pipelineControlClient'
import { useToast } from '@/components/ui/Toast'

interface RunControlBarProps {
  workspace_id: string
}

export default function RunControlBar({ workspace_id }: RunControlBarProps) {
  const { getToken } = useAuth()
  const toast = useToast()
  const latest = useQuery(api.runs.latest, { workspace_id })

  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Quick 260724-x4b (LD-4b) — post-launch navigation. `triggerRun` only
  // returns `runId` (no issueNumber), so the started issue is resolved via
  // the SAME pipelineRuns.byRunId query Masthead/RunDetail already use.
  const [startedRunId, setStartedRunId] = useState<string | null>(null)
  const startedRun = useQuery(
    api.pipelineRuns.byRunId,
    startedRunId ? { runId: startedRunId } : 'skip',
  )
  const startedIssueNumber = startedRun?.issueNumber

  const isRunning = latest?.status === 'running'

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    toast.info('Starting a new issue…')
    try {
      const token = await getToken()
      const result = await triggerRun({}, token)
      setStartedRunId(result.runId)
      toast.done('Started a new issue.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      toast.problem('Could not start a new issue. Try again.')
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
    <div className="flex items-end justify-between">
      <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold leading-tight text-[color:var(--color-ink)]">
        Every issue
      </h2>

      <div className="flex items-center gap-3">
        {error && (
          <span className="text-[15px] text-[color:var(--color-vermilion)]">{error}</span>
        )}

        {/* Quick 260724-x4b (LD-4b) — post-launch navigation. Never a
            broken link: while the issueNumber is still resolving this
            renders a plain span, only becoming a Link once it's known. */}
        {startedRunId && (
          <span className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]">
            {startedIssueNumber != null ? (
              <>
                Issue started &middot;{' '}
                <Link
                  href="/"
                  className="ml-1 font-semibold text-[color:var(--color-cobalt)] hover:text-[color:var(--color-cobalt-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-cobalt)]"
                >
                  Open issue {startedIssueNumber} &rarr;
                </Link>
              </>
            ) : (
              'Issue started — finding its number…'
            )}
          </span>
        )}

        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              autoFocus
              onClick={handleConfirm}
              disabled={loading}
              aria-busy={loading}
              className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-masthead-text)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span className="sr-only">Loading…</span>
                  Yes, start it
                </span>
              ) : (
                'Yes, start it'
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="min-h-[44px] px-1 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
            >
              Not now
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
                ? 'An issue is already being written. Wait for it to finish or stop it first.'
                : undefined
            }
            className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-masthead-text)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
          >
            Start a new issue
          </button>
        )}
      </div>
    </div>
  )
}
