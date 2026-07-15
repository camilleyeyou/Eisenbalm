'use client'
/**
 * Phase 40 Plan 40-07 (§40-UI-SPEC Copywriting Contract, ISS-04) — the Hold
 * dialog: an inline panel (project convention — shadcn `Dialog` is
 * deliberately not used; matches `AddCharityDialog.tsx` /
 * `SchedulePublishDialog.tsx`).
 *
 * PRESENTATIONAL ONLY — no `useMutation`, no `api.` import, no Convex call.
 * The overview page (`/issues/[issueNumber]/page.tsx`) owns the
 * `issues:hold` mutation call and the separate "also stop the run" call.
 *
 * The client-side empty-reason check below is a UX affordance ONLY — the
 * AUTHORITATIVE required-reason rejection (and the audit_log write) live in
 * the Convex `issues:hold` mutation (Plan 40-02). This component never
 * writes audit_log and never talks to Convex.
 */
import { useState } from 'react'

export interface HoldDialogProps {
  issueNumber: number
  onHold: (args: { reason: string; stopRun: boolean }) => void
  onCancel: () => void
  busy?: boolean
}

export default function HoldDialog({ issueNumber, onHold, onCancel, busy }: HoldDialogProps) {
  const [reason, setReason] = useState('')
  const [stopRun, setStopRun] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    const trimmed = reason.trim()
    if (trimmed === '') {
      setError('A reason is required to hold this issue.')
      return
    }
    setError(null)
    onHold({ reason: trimmed, stopRun })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hold-dialog-heading"
      className="space-y-4 rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-5 shadow-sm"
    >
      <h2
        id="hold-dialog-heading"
        className="font-[family-name:var(--font-display)] text-[16px] font-semibold text-[color:var(--color-ink)]"
      >
        Hold this issue
      </h2>

      <label className="block space-y-1">
        <span className="font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
          Reason
        </span>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={`Why are you holding Issue ${issueNumber}?`}
          rows={3}
          disabled={busy}
          className="w-full rounded-[2px] border border-[color:var(--color-ink)]/[.15] bg-[color:var(--color-card)] px-3 py-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] disabled:opacity-50"
        />
      </label>

      <label className="flex min-h-[44px] items-center gap-2">
        <input
          type="checkbox"
          checked={stopRun}
          onChange={e => setStopRun(e.target.checked)}
          disabled={busy}
          className="h-4 w-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
        />
        <span className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)]">
          Also stop the run in progress
        </span>
      </label>

      {error && (
        <p
          role="alert"
          className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-vermilion)]"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          aria-busy={busy}
          className="flex min-h-[44px] items-center justify-center rounded-[2px] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
        >
          {busy ? 'Holding…' : 'Hold issue'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex min-h-[44px] items-center justify-center rounded-[2px] border border-[color:var(--color-ink)]/[.15] px-4 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
