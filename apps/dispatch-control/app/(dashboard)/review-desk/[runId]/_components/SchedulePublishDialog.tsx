'use client'
/**
 * Phase 26 (RVW-03) — Schedule-for-later inline modal.
 * Ported (finish-phase-34-retirement, quick 260718-00i Task 2) from the
 * legacy run-monitor/.../review/_components/SchedulePublishDialog.tsx onto
 * the Approval surface (co-located with DecisionRail) so the scheduling
 * capability survives the legacy panel's retirement (Task 3). Behavior is
 * unchanged: same scheduleIssue call, same schedule_in_past branch, same
 * copy — only the surface classes were swapped for the rail's CSS-variable
 * tokens so it matches the surrounding Editorial design system.
 *
 * Kept as a SEPARATE component from DecisionRail.tsx — never inlined —
 * because the publishNoTypedConfirm tripwire (__tests__/publishNoTypedConfirm.test.ts)
 * scans DecisionRail.tsx for a raw `<input>` element; this dialog's
 * `<input type="datetime-local">` must not land inside that file.
 *
 * UI-SPEC copy:
 *   - heading: "Schedule for Later"
 *   - label: "Publish at"
 *   - body: "This issue will publish automatically at the scheduled time via the hourly tick."
 *   - CTA: "Confirm Schedule"
 *   - past-date error: "Choose a time in the future."
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { scheduleIssue, ReviewApiError } from '@/lib/reviewClient'

interface SchedulePublishDialogProps {
  runId: string
  onScheduled: (scheduledAt: number) => void
  onCancel: () => void
}

export default function SchedulePublishDialog({
  runId,
  onScheduled,
  onCancel,
}: SchedulePublishDialogProps) {
  const { getToken } = useAuth()
  const [datetimeValue, setDatetimeValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!datetimeValue) {
      setError('Please choose a publish time.')
      return
    }

    const scheduledAt = new Date(datetimeValue).getTime()
    if (isNaN(scheduledAt) || scheduledAt <= Date.now()) {
      setError('Choose a time in the future.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      await scheduleIssue(token, runId, scheduledAt)
      onScheduled(scheduledAt)
    } catch (e) {
      if (e instanceof ReviewApiError && e.reason === 'schedule_in_past') {
        setError('Choose a time in the future.')
      } else if (e instanceof ReviewApiError) {
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : 'Failed to schedule.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-dialog-heading"
      className="flex flex-col gap-3 border border-[color:var(--color-faint)] bg-white p-4"
    >
      <h3
        id="schedule-dialog-heading"
        className="font-[family-name:var(--font-display,inherit)] text-[15px] font-semibold text-[color:var(--color-ink)]"
      >
        Schedule for Later
      </h3>
      <p className="text-[13px] text-[color:var(--color-ink-soft)]">
        This issue will publish automatically at the scheduled time via the hourly
        tick.
      </p>

      <label className="flex flex-col gap-1">
        <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
          Publish at
        </span>
        <input
          type="datetime-local"
          value={datetimeValue}
          onChange={e => setDatetimeValue(e.target.value)}
          min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
          disabled={loading}
          className="w-full border border-[color:var(--color-faint)] px-3 py-2 text-[13px] text-[color:var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)] disabled:opacity-50"
        />
      </label>

      {error && (
        <p role="alert" className="text-[12px] text-[color:var(--color-vermilion)]">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading || !datetimeValue}
          className="inline-flex min-h-[44px] items-center justify-center bg-[color:var(--color-ink)] px-4 py-2 font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-paper,#f4f2ec)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Scheduling…' : 'Confirm Schedule'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center justify-center border border-[color:var(--color-faint)] bg-white px-4 py-2 font-[family-name:var(--font-ui)] text-[12px] font-medium uppercase tracking-[.06em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
