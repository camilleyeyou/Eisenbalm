'use client'
/**
 * Phase 25 (RUN-02/RUN-03) — Automation panel.
 *
 * Focal point of /config. The kill-switch toggle is the primary visual.
 *
 * Kill switch:
 *   - role="switch" aria-checked={scheduleEnabled}
 *   - ON: bg-neutral-900 text-white
 *   - OFF: bg-red-500 text-white (the ONLY red background in non-destructive context)
 *   - Always-visible badge beside the toggle: "Automation ON" or "Automation OFF"
 *
 * Schedule editor (visible only when scheduleEnabled === true):
 *   - Day-of-week select (Mon–Sun)
 *   - Hour + minute UTC selects
 *   - NextRunDisplay: local tz + UTC (D-11)
 *   - "Save Schedule" secondary button
 *
 * Toggle writes schedule_enabled to Convex pipelineConfig:upsert.
 * Schedule save writes schedule_cadence (JSON: {dayOfWeek, hourUtc, minuteUtc}).
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { Loader2 } from 'lucide-react'
import { api } from '@convex/_generated/api'
import NextRunDisplay from './NextRunDisplay'

interface AutomationPanelProps {
  workspace_id: string
}

const DAY_OPTIONS = [
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
  { label: 'Sunday', value: 0 },
]

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

export default function AutomationPanel({ workspace_id }: AutomationPanelProps) {
  const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id })
  const upsert = useMutation(api.pipelineConfig.upsert)

  const [toggleLoading, setToggleLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Parse config from Convex rows
  const configMap: Record<string, unknown> = {}
  for (const row of configRows ?? []) {
    try {
      configMap[row.key] = JSON.parse(row.value)
    } catch {
      configMap[row.key] = row.value
    }
  }

  const scheduleEnabled = Boolean(configMap['schedule_enabled'] ?? false)

  // Parse cadence: {dayOfWeek: number, hourUtc: number, minuteUtc: number}
  type Cadence = { dayOfWeek: number; hourUtc: number; minuteUtc: number }
  const rawCadence = configMap['schedule_cadence']
  const cadence: Cadence =
    rawCadence && typeof rawCadence === 'object'
      ? (rawCadence as Cadence)
      : { dayOfWeek: 4, hourUtc: 14, minuteUtc: 0 } // default: Thu 14:00 UTC

  const nextRunAt = Number(configMap['schedule_next_run_at'] ?? 0)

  // Local schedule editor state
  const [day, setDay] = useState(cadence.dayOfWeek)
  const [hour, setHour] = useState(cadence.hourUtc)
  const [minute, setMinute] = useState(cadence.minuteUtc)

  // Sync local state when configRows load
  useEffect(() => {
    setDay(cadence.dayOfWeek)
    setHour(cadence.hourUtc)
    setMinute(cadence.minuteUtc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configRows])

  async function handleToggle() {
    setToggleLoading(true)
    try {
      await upsert({
        workspace_id,
        key: 'schedule_enabled',
        value: JSON.stringify(!scheduleEnabled),
      })
    } catch (e) {
      // Log but don't surface — toggle failure is visible via the badge state
      console.error('AutomationPanel toggle error:', e)
    } finally {
      setToggleLoading(false)
    }
  }

  async function handleSaveSchedule() {
    setSaveLoading(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const newCadence: Cadence = { dayOfWeek: day, hourUtc: hour, minuteUtc: minute }
      await upsert({
        workspace_id,
        key: 'schedule_cadence',
        value: JSON.stringify(newCadence),
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaveLoading(false)
    }
  }

  if (configRows === undefined) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">Automation</h2>
        <p className="mt-2 text-sm text-neutral-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-5">
      <h2 className="text-base font-semibold text-neutral-900">Automation</h2>

      {/* Kill switch row */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-neutral-700">Scheduled runs</span>

        <button
          type="button"
          role="switch"
          aria-checked={scheduleEnabled}
          aria-label={`Toggle scheduled runs ${scheduleEnabled ? 'off' : 'on'}`}
          onClick={handleToggle}
          disabled={toggleLoading}
          className={`min-h-[44px] min-w-[80px] rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 ${
            scheduleEnabled
              ? 'bg-neutral-900 text-white hover:bg-neutral-800'
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          {toggleLoading ? (
            <span className="flex items-center justify-center gap-1.5">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading…</span>
            </span>
          ) : (
            scheduleEnabled ? 'ON' : 'OFF'
          )}
        </button>

        {/* Always-visible status badge */}
        {scheduleEnabled ? (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-600">
            Automation ON
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-red-200 px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-700">
            Automation OFF
          </span>
        )}
      </div>

      {/* Schedule editor — visible only when automation is enabled */}
      {scheduleEnabled && (
        <div className="space-y-4 border-t border-neutral-100 pt-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Schedule</p>

          <div className="flex flex-wrap items-end gap-4">
            {/* Day of week */}
            <div className="space-y-1">
              <label
                htmlFor="schedule-day"
                className="text-sm text-neutral-700"
              >
                Day
              </label>
              <select
                id="schedule-day"
                value={day}
                onChange={e => setDay(Number(e.target.value))}
                className="rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
              >
                {DAY_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Hour (UTC) */}
            <div className="space-y-1">
              <label
                htmlFor="schedule-hour"
                className="text-sm text-neutral-700"
              >
                Hour (UTC)
              </label>
              <select
                id="schedule-hour"
                value={hour}
                onChange={e => setHour(Number(e.target.value))}
                className="rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
              >
                {HOURS.map(h => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>

            {/* Minute (UTC) */}
            <div className="space-y-1">
              <label
                htmlFor="schedule-minute"
                className="text-sm text-neutral-700"
              >
                Minute
              </label>
              <select
                id="schedule-minute"
                value={minute}
                onChange={e => setMinute(Number(e.target.value))}
                className="rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
              >
                {MINUTES.map(m => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Next run preview */}
          <NextRunDisplay
            cadence={JSON.stringify({ dayOfWeek: day, hourUtc: hour, minuteUtc: minute })}
            nextRunAt={nextRunAt}
          />

          {/* Save Schedule button */}
          <button
            type="button"
            onClick={handleSaveSchedule}
            disabled={saveLoading}
            aria-busy={saveLoading}
            className="min-h-[44px] rounded-md border border-neutral-300 bg-white px-4 text-sm text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
          >
            {saveLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span className="sr-only">Loading…</span>
                Save Schedule
              </span>
            ) : saveSuccess ? (
              'Saved'
            ) : (
              'Save Schedule'
            )}
          </button>

          {saveError && (
            <p className="text-xs text-red-600">{saveError}</p>
          )}
        </div>
      )}
    </div>
  )
}
