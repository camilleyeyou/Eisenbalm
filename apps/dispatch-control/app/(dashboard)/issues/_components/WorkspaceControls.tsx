'use client'
/**
 * Phase 41 Plan 41-06 (D-03, Pitfall 5) — WorkspaceControls.
 *
 * Relocates the old overview `page.tsx`'s (Phase 40 Plan 40-07) persistent
 * editorial concerns into the frame so NO capability is lost when that page
 * is gutted into a redirect (D-03):
 *   - Held-state row (Held · reason · who · when via `relativeTime`) +
 *     Reopen (`api.issues.reopen`, single click, no confirmation — D-17).
 *   - The Hold flow: "Hold issue" -> `HoldDialog` -> `api.issues.hold` +
 *     the SEPARATE `cancelRun` call on `stopRun` (D-14 — a cancel failure
 *     must never block the hold itself, tolerated the same way the old
 *     page tolerated it), with `holdBusy`/`holdError` surfaced (the
 *     `role="alert"` error stays).
 *   - The run-history inline list (`history.map` -> `issueRunHref` links) —
 *     kept as a full inline list, not summarized (41-RESEARCH Open Q1: the
 *     lowest-risk capability-preserving choice).
 *
 * Consumes `held`, `issue`, `history`, `runId` from `useWorkspaceState()`
 * rather than re-subscribing to the same Convex queries the frame's
 * provider already owns (41-RESEARCH Pitfall 3).
 *
 * Phase 43 Plan 43-06 (TSK-06, D-08) — adds a persistent "Decision log"
 * disclosure control alongside Hold issue / Run history (the Phase 41 frame
 * already lists "Decision log" as a persistent control the workspace owes).
 * Collapsed by default: `<DecisionLog>` (and its `useQuery` subscriptions)
 * only mounts once expanded, so `WorkspaceLayout.test.tsx`'s full-layout
 * render — whose mocked `api` object has no `auditLog`/`users` entries —
 * is unaffected.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useMutation } from 'convex/react'
import { useAuth } from '@clerk/nextjs'
import { PauseCircle, ScrollText, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { issueRunHref } from '@/lib/issueRouteResolver'
import { cancelRun } from '@/lib/pipelineControlClient'
import DecisionLog from '@/components/decision-log/DecisionLog'
import { HELP_COPY } from '@/components/help/helpCopy'
import { useWorkspaceState } from './WorkspaceStateProvider'
import HoldDialog from './HoldDialog'
import { relativeTime } from './HeldIssueRow'

interface WorkspaceControlsProps {
  issueNumber: number
}

export default function WorkspaceControls({ issueNumber: n }: WorkspaceControlsProps) {
  const { held, issue, history, runId } = useWorkspaceState()
  const { getToken } = useAuth()
  const holdMutation = useMutation(api.issues.hold)
  const reopenMutation = useMutation(api.issues.reopen)

  const [showHoldDialog, setShowHoldDialog] = useState(false)
  const [holdBusy, setHoldBusy] = useState(false)
  const [holdError, setHoldError] = useState<string | null>(null)
  const [showDecisionLog, setShowDecisionLog] = useState(false)

  async function handleHold({ reason, stopRun }: { reason: string; stopRun: boolean }) {
    setHoldBusy(true)
    setHoldError(null)
    try {
      await holdMutation({ workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n, reason })

      // D-14 — a SEPARATE call from hold; a cancel failure must not block
      // the hold itself (the issue is already held at this point).
      if (stopRun && runId) {
        try {
          const token = await getToken()
          await cancelRun(runId, token)
        } catch {
          // Tolerated — see file-header note. The issue stays held either way.
        }
      }

      setShowHoldDialog(false)
    } catch (e) {
      setHoldError(e instanceof Error ? e.message : String(e))
      // Keep the dialog open on failure so the operator can retry/adjust.
    } finally {
      setHoldBusy(false)
    }
  }

  async function handleReopen() {
    // D-17 — single click, no confirmation dialog.
    await reopenMutation({ workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n })
  }

  return (
    <div className="flex flex-col gap-6 rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-6">
      <div>
        {held ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)]">
              <span className="flex items-center gap-[4px] font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-vermilion)]">
                <PauseCircle size={13} aria-hidden="true" />
                Held
              </span>
              · {issue?.heldReason ?? '—'} · {issue?.heldBy ?? '—'} · {relativeTime(issue?.heldAt)}
            </span>
            <button
              type="button"
              onClick={handleReopen}
              className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
            >
              Reopen
            </button>
          </div>
        ) : showHoldDialog ? (
          <>
            <HoldDialog
              issueNumber={n}
              onHold={handleHold}
              onCancel={() => {
                setShowHoldDialog(false)
                setHoldError(null)
              }}
              busy={holdBusy}
            />
            {holdError && (
              <p
                role="alert"
                className="mt-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-vermilion)]"
              >
                {holdError}
              </p>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowHoldDialog(true)}
            className="flex min-h-[44px] items-center rounded-[2px] border border-[color:var(--color-ink)]/[.15] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
          >
            Hold issue
          </button>
        )}
        <p className="mt-0.5 text-[11px] text-[color:var(--color-ink-soft)]">
          {HELP_COPY.workspace.hold}
        </p>
      </div>

      <div className="flex flex-col gap-1 border-t border-[color:var(--color-ink)]/[.08] pt-4">
        <h2 className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-ink-soft)]">
          Run history
        </h2>
        {history === undefined ? (
          <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
            Loading…
          </p>
        ) : history.length === 0 ? (
          <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
            No runs yet.
          </p>
        ) : (
          history.map(r => (
            <Link
              key={r._id}
              href={issueRunHref(n, r.runId)}
              className="flex min-h-[44px] items-center gap-2 border-b border-[color:var(--color-ink)]/[.08] font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-cobalt)]"
            >
              Run {r.runId} · {new Date(r.startedAt).toLocaleString()}
            </Link>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-[color:var(--color-ink)]/[.08] pt-4">
        <button
          type="button"
          onClick={() => setShowDecisionLog(prev => !prev)}
          aria-expanded={showDecisionLog}
          className="flex min-h-[44px] items-center justify-between gap-2 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
        >
          <span className="flex items-center gap-1.5">
            <ScrollText size={13} aria-hidden="true" />
            Decision log
          </span>
          {showDecisionLog ? (
            <ChevronUp size={14} aria-hidden="true" />
          ) : (
            <ChevronDown size={14} aria-hidden="true" />
          )}
        </button>
        {showDecisionLog && (
          <DecisionLog runId={runId ?? undefined} issueNumber={n} />
        )}
      </div>
    </div>
  )
}
