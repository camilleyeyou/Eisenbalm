'use client'
/**
 * D-09 section-end unresolved card (Phase 32 GLY-02; Phase 33 D-11 actions).
 *
 * A finding whose `quotedSpan` failed to anchor onto the draft's blocks (no
 * match, or an ambiguous match per D-12) is never silently dropped. It
 * surfaces here at the end of its section with the full reason text and the
 * original quoted span, so nothing is lost — "never silently dropped or
 * mis-rendered."
 *
 * Phase 33 (D-11): the card gains Dismiss (one-line reason required) and
 * Edit inline — but NO Accept: an orphaned anchor means the fix cannot be
 * applied automatically (D-07), so the operator either edits by hand or
 * dismisses with a reason. Actions render only when the action context props
 * are provided; without them the card stays purely presentational.
 *
 * Unlike AnnotationMark's in-paragraph popover, this card renders as a
 * sibling of the section's paragraphs, so normal block elements are fine.
 *
 * Phase 44 (INS-01, Plan 44-07 Task 1): an optional `onInspect?` prop adds
 * an "Inspect how this was made" action alongside Dismiss/Edit inline,
 * following the identical `onEditSection?`/`sectionId` conditional-render
 * convention — the render gate is `Boolean(onInspect && sectionId)`.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { dismissFinding } from '@/lib/findingsClient'
import type { UnresolvedFinding } from '@/lib/galley/spanResolver'

interface UnresolvedFindingCardProps {
  finding: UnresolvedFinding
  /** Phase 33 (D-11) action context, threaded from GallerySection. */
  runId?: string
  sectionId?: string
  onEditSection?: (sectionId: string, findingId?: string) => void
  /** Phase 44 (INS-01) — opens the shared inspector on this finding's section. */
  onInspect?: (sectionId: string) => void
}

export default function UnresolvedFindingCard({
  finding,
  runId,
  sectionId,
  onEditSection,
  onInspect,
}: UnresolvedFindingCardProps) {
  const { getToken } = useAuth()

  const [dismissing, setDismissing] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDismiss = Boolean(runId)
  const canEdit = Boolean(onEditSection && sectionId)
  const canInspect = Boolean(onInspect && sectionId)

  /** Dismiss with a required reason (D-11). The card disappears reactively
   * via the Convex subscription once the resolution lands — no refetch. */
  async function handleDismissSubmit() {
    const trimmed = reason.trim()
    if (!runId || !trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await dismissFinding(runId, finding.findingId, { reason: trimmed }, await getToken())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dismiss failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="galley-unresolved" data-severity={finding.severity}>
      <div className="galley-unresolved__label">Unresolved &middot; {finding.severity}</div>
      <p>{finding.reason}</p>
      {finding.quotedSpan && (
        <p className="galley-unresolved__quote">
          &ldquo;<span>{finding.quotedSpan}</span>&rdquo;
        </p>
      )}
      {finding.suggestedFix && <p>Suggested: {finding.suggestedFix}</p>}

      {(canDismiss || canEdit || canInspect) && (
        <div className="galley-unresolved__actions mt-2 flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onEditSection?.(sectionId!, finding.findingId)}
              className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
            >
              Edit inline
            </button>
          )}
          {canInspect && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onInspect?.(sectionId!)}
              className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
            >
              Inspect how this was made
            </button>
          )}
          {canDismiss && !dismissing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setDismissing(true)}
              className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
            >
              Dismiss
            </button>
          )}
          {canDismiss && dismissing && (
            <span className="flex w-full flex-col gap-2">
              <input
                aria-label="Dismissal reason"
                placeholder="Why dismiss this finding?"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="min-h-[44px] w-full rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 text-xs text-[color:var(--color-ink)]"
              />
              <button
                type="button"
                disabled={busy || reason.trim() === ''}
                onClick={() => void handleDismissSubmit()}
                className="min-h-[44px] self-start rounded-[2px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.04em] text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm dismiss
              </button>
            </span>
          )}
          {error && (
            <span role="alert" className="text-xs text-[color:var(--color-vermilion)]">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
