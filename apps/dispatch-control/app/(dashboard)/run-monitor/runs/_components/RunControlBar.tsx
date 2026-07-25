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
import { issueHref } from '@/lib/issueRouteResolver'

interface RunControlBarProps {
  workspace_id: string
}

export default function RunControlBar({ workspace_id }: RunControlBarProps) {
  const { getToken } = useAuth()
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
    try {
      const token = await getToken()
      const result = await triggerRun({}, token)
      setStartedRunId(result.runId)
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
    <div className="flex items-end justify-between">
      <div>
        <span className="font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[.14em] text-[color:var(--color-cobalt)]">
          System Workbench
        </span>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[32px] font-semibold leading-none text-[color:var(--color-ink)]">
          Runs
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {error && (
          <span className="text-[11px] text-[color:var(--color-vermilion)]">{error}</span>
        )}

        {/* Quick 260724-x4b (LD-4b) — post-launch navigation. Never a
            broken link: while the issueNumber is still resolving this
            renders a plain span, only becoming a Link once it's known. */}
        {startedRunId && (
          <span className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
            {startedIssueNumber != null ? (
              <>
                Run started &middot;{' '}
                <Link
                  href={issueHref(startedIssueNumber)}
                  className="ml-1 font-semibold text-[color:var(--color-cobalt)] hover:text-[color:var(--color-cobalt-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-cobalt)]"
                >
                  Open Issue {startedIssueNumber} &rarr;
                </Link>
              </>
            ) : (
              'Run started — resolving issue…'
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
              className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
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
              className="min-h-[44px] px-1 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
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
            className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
          >
            Trigger Run
          </button>
        )}
      </div>
    </div>
  )
}
