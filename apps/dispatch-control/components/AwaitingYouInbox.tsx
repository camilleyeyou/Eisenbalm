'use client'
/**
 * Cross-screen "Awaiting-you" inbox (CHR-04, Plan 30-06).
 *
 * A masthead dropdown answering "what needs me right now" — aggregated,
 * blockers-first, from EXISTING Convex queries only (D-09: pure client-side
 * derivation, zero new backend, no new Convex table/mutation).
 *
 * Categories (in blockers-first render order):
 *   1. Unresolved error-severity qaCorrections on the current draft run
 *   2. Open claim-check sign-offs on the current draft run
 *   3. Awaiting-review runs (includes Gate-1 interrupts — SAME status
 *      literal, no distinguishing field exists; routed identically to the
 *      existing ReviewQueue.tsx precedent per RESEARCH Pitfall 2. A
 *      dedicated Gate-1 adjudication UI is a scoped-out Phase 37 (Signal
 *      Desk) follow-up — see 30-06-SUMMARY.md)
 *   4. The current-cycle failed run (D-10: latest run only, not history)
 *
 * "Current draft" = the first awaiting-review run's runId (there should
 * only ever be ~1 in flight at a time).
 */
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'

interface AwaitingYouInboxProps {
  open: boolean
  onClose: () => void
}

interface InboxItem {
  key: string
  label: string
  href: string
  dotColor: string
}

export default function AwaitingYouInbox({ open, onClose }: AwaitingYouInboxProps) {
  const runs = useQuery(api.runs.listForWorkspace, { workspace_id: DEFAULT_WORKSPACE_ID })
  const latest = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })

  const awaitingReview = runs?.filter(r => r.status === 'awaiting-review') ?? []

  // D-10: current-cycle failed run only — do not surface older failed runs
  // from listForWorkspace; history lives in Run Monitor, not the inbox.
  const failedItem = latest?.status === 'failed' ? latest : null

  // Blockers are scoped to the current draft: the run awaiting review (there
  // should only ever be ~1 in flight). No current draft → skip both queries.
  const currentDraftRunId = awaitingReview[0]?.runId

  const qaFindings = useQuery(
    api.qaCorrections.byRunId,
    currentDraftRunId ? { runId: currentDraftRunId } : 'skip',
  )
  const unresolvedErrors = qaFindings?.filter(f => f.severity === 'error' && !f.accepted) ?? []

  const claimStatus = useQuery(
    api.claimChecks.allSignedOff,
    currentDraftRunId ? { runId: currentDraftRunId } : 'skip',
  )
  const openSignOffs = Boolean(claimStatus && !claimStatus.allSignedOff && claimStatus.total > 0)

  if (!open) return null

  const reviewHref = (runId: string) => `/run-monitor/runs/${encodeURIComponent(runId)}/review`

  const items: InboxItem[] = []

  // 1. Unresolved error-severity QA findings — highest-priority blocker.
  for (const finding of unresolvedErrors) {
    items.push({
      key: `qa-${finding._id}`,
      label: `QA blocker — ${finding.sectionName}`,
      href: currentDraftRunId ? reviewHref(currentDraftRunId) : '#',
      dotColor: 'var(--color-vermilion)',
    })
  }

  // 2. Open claim-check sign-offs.
  if (openSignOffs && claimStatus && currentDraftRunId) {
    items.push({
      key: `signoff-${currentDraftRunId}`,
      label: `Claim sign-offs open (${claimStatus.signedOff}/${claimStatus.total})`,
      href: reviewHref(currentDraftRunId),
      dotColor: 'var(--color-marigold)',
    })
  }

  // 3. Awaiting-review runs (includes Gate-1 interrupts — see file header).
  for (const run of awaitingReview) {
    items.push({
      key: `review-${run.runId}`,
      label: `Awaiting review — Run ${run.runId}`,
      href: reviewHref(run.runId),
      dotColor: 'var(--color-cobalt)',
    })
  }

  // 4. Current-cycle failed run.
  if (failedItem) {
    items.push({
      key: `failed-${failedItem.runId}`,
      label: `Run failed — Run ${failedItem.runId}`,
      href: `/run-monitor/runs/${encodeURIComponent(failedItem.runId)}`,
      dotColor: 'var(--color-vermilion)',
    })
  }

  return (
    <div
      role="dialog"
      aria-label="Awaiting you"
      className="absolute top-[52px] right-0 z-50 w-[360px] border border-[color:var(--color-ink)]/[.16] border-t-[3px] border-t-[color:var(--color-vermilion)] bg-[color:var(--color-card)] shadow-[0_24px_50px_-20px_rgba(20,16,10,.5)]"
    >
      <div className="border-b border-[color:var(--color-ink)]/[.1] px-4 py-3">
        <h2 className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-ink)]">
          Awaiting you
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[color:var(--color-ink-soft)]">
          Nothing needs you right now.
        </p>
      ) : (
        <ul role="list">
          {items.map(item => (
            <li
              key={item.key}
              className="border-b border-[color:var(--color-ink)]/[.06] last:border-b-0"
            >
              <Link
                href={item.href}
                onClick={onClose}
                className="flex min-h-[44px] items-center gap-2.5 px-4 py-3 text-sm text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.dotColor }}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
