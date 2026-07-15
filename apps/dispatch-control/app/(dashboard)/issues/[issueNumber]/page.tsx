'use client'
/**
 * Phase 40 Plan 40-07 (§40.8, D-09, ISS-02/ISS-04) — the issue overview: the
 * issue-keyed editorial landing. Clicking the Issues-home in-progress card
 * lands here. Phase 41 replaces this page's CONTENTS (the Workspace frame)
 * at this SAME URL — the route itself does not move again.
 *
 * This page owns all querying + derivation (same assembly as the Issues
 * home, Plan 40-05) and renders:
 *   1. Header — Issue {n} + the derived issue-status readout (never a stale
 *      value — ISS-06: `deriveIssueStatus === 'unknown'` always renders
 *      "State unknown — refresh").
 *   2. The shared 5-segment `StageStrip` (reused, not rebuilt).
 *   3. Open-task count + estimated work remaining.
 *   4. Links into the re-keyed Review Desk / Voice Pass screens — NEVER
 *      disabled when held (D-15: held blocks publish, not editing).
 *   5. Run history, linking each run to `/issues/[n]/runs/[runId]` (D-08).
 *   6. The persistent Hold/Reopen control (ISS-04).
 *
 * WRITE BOUNDARY (EDT-05): `issues:hold` / `issues:reopen` enforce the
 * required-reason rule AND write `audit_log` themselves (Plan 40-02) — this
 * page never writes audit_log and never talks to Sanity directly.
 *
 * ISSUE-STATE vs RUN-STATE (D-14): the hold dialog's "also stop the run in
 * progress" checkbox does NOT touch `runs.cancelRequested` via the hold
 * mutation. It is a SEPARATE call. The underlying Convex mutation is
 * `runs:requestCancel` — but that mutation is single-lane
 * `requirePipelineSecret`-guarded (convex/runs.ts) with no operator/Clerk
 * lane, so the dashboard cannot call `api.runs.requestCancel` directly
 * (it has no pipeline secret, nor should it). The established, secure path
 * (Phase 25 RUN-04, `CancelRunButton.tsx`) is `cancelRun()` from
 * `lib/pipelineControlClient.ts`, which POSTs to the Clerk-JWT-guarded
 * pipeline endpoint `POST /runs/{runId}/cancel` — that endpoint calls
 * `runs:requestCancel` server-side with the pipeline secret. This page
 * follows that same established path rather than duplicating a
 * client-side secret it must never hold.
 */
import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from 'convex/react'
import { useAuth } from '@clerk/nextjs'
import { AlertTriangle, BadgeCheck, CheckCircle2, FileEdit, PauseCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import {
  deriveIssueStatus,
  deriveStageStates,
  deriveTasks,
  estimateWorkMinutes,
  type DerivationInputs,
  type IssueStatus,
} from '@/lib/derivedState'
import { parseIssueNumber, issueReviewHref, issueVoiceHref, issueRunHref } from '@/lib/issueRouteResolver'
import { cancelRun } from '@/lib/pipelineControlClient'
import StageStrip from '../_components/StageStrip'
import HoldDialog from '../_components/HoldDialog'
import { relativeTime } from '../_components/HeldIssueRow'

const STATUS_META: Record<
  Exclude<IssueStatus, 'unknown'>,
  { label: string; Icon: LucideIcon; color: string }
> = {
  draft: { label: 'Draft', Icon: FileEdit, color: 'var(--color-ink-soft)' },
  'needs-review': {
    label: 'Needs review',
    Icon: AlertTriangle,
    color: 'var(--color-marigold-text)',
  },
  ready: { label: 'Ready to publish', Icon: CheckCircle2, color: 'var(--color-green)' },
  published: { label: 'Published', Icon: BadgeCheck, color: 'var(--color-green)' },
  held: { label: 'Held', Icon: PauseCircle, color: 'var(--color-vermilion)' },
}

function StatusReadout({ status }: { status: IssueStatus }) {
  if (status === 'unknown') {
    return (
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex min-h-[44px] items-center gap-[6px] font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-vermilion)] underline underline-offset-2"
      >
        <AlertTriangle size={16} aria-hidden="true" />
        State unknown — refresh
      </button>
    )
  }
  const meta = STATUS_META[status]
  const StatusIcon = meta.Icon
  return (
    <span
      className="flex items-center gap-[6px] font-[family-name:var(--font-ui)] text-[13px] font-semibold"
      style={{ color: meta.color }}
    >
      <StatusIcon size={16} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

export default function IssueOverviewPage() {
  const params = useParams()
  const n = parseIssueNumber(String(params.issueNumber))

  const { getToken } = useAuth()
  const holdMutation = useMutation(api.issues.hold)
  const reopenMutation = useMutation(api.issues.reopen)

  const [showHoldDialog, setShowHoldDialog] = useState(false)
  const [holdBusy, setHoldBusy] = useState(false)
  const [holdError, setHoldError] = useState<string | null>(null)

  // Queries below are 'skip'-guarded on `n === null`, satisfying the rules
  // of hooks (hooks are always called; the query itself is what's skipped).
  const issue = useQuery(
    api.issues.byIssueNumber,
    n !== null ? { workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n } : 'skip',
  )
  const run = useQuery(api.pipelineRuns.byIssueNumber, n !== null ? { issueNumber: n } : 'skip')
  const history = useQuery(api.pipelineRuns.listByIssueNumber, n !== null ? { issueNumber: n } : 'skip')

  const runLookupResolved = n === null || run !== undefined
  const runId: string | null = run?.runId ?? null

  const signOffsRaw = useQuery(api.signOffs.activeByRunId, runId ? { runId } : 'skip')
  const claimRowsRaw = useQuery(api.claimChecks.listByRunId, runId ? { runId } : 'skip')
  const qaFindings = useQuery(api.qaCorrections.byRunId, runId ? { runId } : 'skip')
  const pitchRows = useQuery(api.pitchLog.byRunId, runId ? { runId } : 'skip')
  const runRow = useQuery(api.runs.byRunId, runId ? { runId } : 'skip')

  // Same normalization as the Issues home (Plan 40-05): once the run lookup
  // has genuinely resolved to "no run", `signOffs` becomes loaded-and-empty
  // `{}` rather than staying the raw `undefined` a skipped query produces —
  // otherwise a brand-new issue with no run yet would show
  // "State unknown — refresh" forever instead of "Draft".
  const signOffs = !runLookupResolved ? undefined : runId === null ? {} : signOffsRaw

  const claimRows = claimRowsRaw?.map(row => ({
    _id: row._id,
    status: row.status,
    sourceUrl: row.sourceUrl,
    sectionName: row.sectionName,
    claimText: row.text,
  }))

  const derivationInputs: DerivationInputs = {
    issueNumber: n,
    runId,
    issue: issue === undefined ? undefined : issue === null ? null : { held: issue.held, published: issue.published },
    signOffs,
    claimRows,
    qaFindings,
    pitchRows,
    runStatus: runRow?.status,
  }

  const status = deriveIssueStatus(derivationInputs)
  const stages = deriveStageStates(derivationInputs)
  const tasks = deriveTasks(derivationInputs)
  const workMinutes = estimateWorkMinutes(tasks)

  async function handleHold({ reason, stopRun }: { reason: string; stopRun: boolean }) {
    if (n === null) return
    setHoldBusy(true)
    setHoldError(null)
    try {
      await holdMutation({ workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n, reason })

      // D-14 — a SEPARATE call from hold; a cancel failure must not block
      // the hold itself (the issue is already held at this point).
      if (stopRun && run?.runId) {
        try {
          const token = await getToken()
          await cancelRun(run.runId, token)
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
    if (n === null) return
    // D-17 — single click, no confirmation dialog.
    await reopenMutation({ workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n })
  }

  if (n === null) {
    return (
      <div className="min-h-screen bg-[color:var(--color-rail)] px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[900px] flex-col gap-3">
          <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
            That isn&rsquo;t a valid issue number.
          </p>
          <Link
            href="/issues"
            className="flex min-h-[44px] w-fit items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)]"
          >
            ← Back to Issues
          </Link>
        </div>
      </div>
    )
  }

  if (issue === undefined) {
    return (
      <div className="min-h-screen bg-[color:var(--color-rail)] px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-[900px] animate-pulse rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-6">
          <div className="h-6 w-40 rounded-[2px] bg-[color:var(--color-card-alt)]" />
        </div>
      </div>
    )
  }

  const held = issue?.held ?? false

  return (
    <div className="min-h-screen bg-[color:var(--color-rail)] px-6 py-8 lg:px-8">
      <div className="mx-auto flex max-w-[900px] flex-col gap-8">
        <Link
          href="/issues"
          className="flex min-h-[44px] w-fit items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)]"
        >
          ← Back to Issues
        </Link>

        <div className="rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-[family-name:var(--font-display)] text-[22px] font-semibold text-[color:var(--color-ink)]">
              Issue {n}
            </h1>
            <StatusReadout status={status} />
          </div>

          <div className="mt-4">
            <StageStrip stages={stages} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-6">
            <span className="font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--color-ink)]">
              {tasks.length} open · ~{workMinutes} min
            </span>
            <Link
              href={issueReviewHref(n)}
              className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)]"
            >
              Open Review
            </Link>
            <Link
              href={issueVoiceHref(n)}
              className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)]"
            >
              Open Voice
            </Link>
          </div>

          <div className="mt-6 border-t border-[color:var(--color-ink)]/[.08] pt-4">
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
          </div>
        </div>

        <div className="flex flex-col gap-1">
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
      </div>
    </div>
  )
}
