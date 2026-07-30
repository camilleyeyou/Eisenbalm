/**
 * quick 260730-i4j (Task 1b) — extracted, NOT rewritten, from
 * `app/(dashboard)/issues/page.tsx`. The Desk (`/desk`) needs the exact same
 * "next scheduled slot" label the Issues home already computes; duplicating
 * this logic there would violate the "do NOT reimplement — single source of
 * truth from lib/derivedState.ts-adjacent pure helpers" constraint (see the
 * plan's Task 1 note). `issues/page.tsx` now imports these instead of
 * defining them — its rendered output is byte-identical.
 */

export type ConfigRow = { key: string; value: string }

export function readConfigValue<T>(rows: ConfigRow[] | undefined, key: string): T | undefined {
  const row = rows?.find(r => r.key === key)
  if (!row) return undefined
  try {
    return JSON.parse(row.value) as T
  } catch {
    return undefined
  }
}

export type Cadence = { dayOfWeek: number; hourUtc: number; minuteUtc: number }

// Same default AutomationPanel.tsx falls back to when no schedule_cadence
// row exists yet (Thu 14:00 UTC) — reused here for parity, not reinvented.
export const DEFAULT_CADENCE: Cadence = { dayOfWeek: 4, hourUtc: 14, minuteUtc: 0 }

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** `{weekday} {HH:MM}` — prefers the concrete `schedule_next_run_at` Unix-ms
 * timestamp when set; falls back to the recurring cadence otherwise. Both
 * read the SAME `pipelineConfig` keys AutomationPanel.tsx already parses. */
export function formatScheduledForLabel(nextRunAt: number | undefined, cadence: Cadence): string {
  if (nextRunAt) {
    const d = new Date(nextRunAt)
    return `${DAY_NAMES[d.getUTCDay()] ?? 'Unknown'} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  }
  return `${DAY_NAMES[cadence.dayOfWeek] ?? 'Unknown'} ${pad2(cadence.hourUtc)}:${pad2(cadence.minuteUtc)}`
}
