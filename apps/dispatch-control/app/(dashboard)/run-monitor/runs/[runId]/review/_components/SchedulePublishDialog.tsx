'use client'
/**
 * Phase 26 (RVW-03) — Schedule-for-later inline modal.
 *
 * Renders an inline panel (matching the existing PromptSaveDialog pattern —
 * shadcn Dialog is not installed; inline panels are the project convention).
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
      className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3 shadow-sm"
    >
      <h3
        id="schedule-dialog-heading"
        className="text-base font-semibold text-neutral-900"
      >
        Schedule for Later
      </h3>
      <p className="text-sm text-neutral-600">
        This issue will publish automatically at the scheduled time via the hourly
        tick.
      </p>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-neutral-700">Publish at</span>
        <input
          type="datetime-local"
          value={datetimeValue}
          onChange={e => setDatetimeValue(e.target.value)}
          min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
          disabled={loading}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50"
        />
      </label>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading || !datetimeValue}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 transition-colors"
        >
          {loading ? 'Scheduling…' : 'Confirm Schedule'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
