/**
 * quick 260730-ldn (Task 1b) — pure title/relative-week helpers shared by the
 * Masthead, The Run, its issue switcher, and the Archive. No React, no
 * Convex, no imports — mirrors the `formatElapsed`/`formatTaskAge` precedent
 * in `lib/derivedState.ts` (wall-clock value passed in, never read
 * internally).
 *
 * `issueTitleLabel(null | undefined)` collapses BOTH "loaded-and-absent"
 * (the run's Gate 1 never chose a subject) and "never loaded" to the same
 * honest string. Callers that must distinguish "still loading" from
 * "confirmed no subject" do that BEFORE calling this — by branching on
 * `title === undefined` themselves — and only call this once they know
 * which case they're in. `NO_TITLE_LABEL` is exported so those callers can
 * compare against it directly.
 */

export const NO_TITLE_LABEL = 'Not yet chosen'

export function issueTitleLabel(title: string | null | undefined): string {
  if (title == null) return NO_TITLE_LABEL
  if (title.trim() === '') return NO_TITLE_LABEL
  return title
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * `< 7d` -> 'This week', `< 14d` -> 'Last week', else '{n} weeks ago' with
 * `n = Math.floor(diffDays / 7)`. A future timestamp (negative diff) clamps
 * to 'This week' — it is still < 7 days away by this arithmetic, never a
 * negative-week string. Absent -> 'Unknown', never a fabricated date.
 */
export function relativeWeekLabel(ts: number | null | undefined, now: number): string {
  if (ts == null) return 'Unknown'
  const diffDays = (now - ts) / DAY_MS
  if (diffDays < 7) return 'This week'
  if (diffDays < 14) return 'Last week'
  const weeks = Math.floor(diffDays / 7)
  return `${weeks} weeks ago`
}

// ─── Phase 56: issue line ("Issue N · Thursday D Month YYYY") ─────────────

/** Andrew's zone; every editor-facing date is shown in it. */
export const EDITOR_TIME_ZONE = 'America/Los_Angeles'

export const NO_CHARITY_YET = 'Charity not chosen yet'

function zonedParts(ms: number): { weekday: string; day: string; month: string; year: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: EDITOR_TIME_ZONE,
  }).formatToParts(ms)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { weekday: get('weekday'), day: get('day'), month: get('month'), year: get('year') }
}

/** Builds the date from parts so ICU comma variance cannot leak in. */
export function formatLongDate(ms: number, withWeekday = true): string {
  const p = zonedParts(ms)
  const core = `${p.day} ${p.month} ${p.year}`
  return withWeekday ? `${p.weekday} ${core}` : core
}

/**
 * ASSUMPTION A1 (Open Question 1): the issue's Thursday is publishedAt, else
 * scheduledFor, else the first Thursday on or after runStartedAt (in the
 * editor's zone; a Thursday start counts as itself), else null.
 */
export function issueThursday(a: {
  publishedAt?: number | null
  scheduledFor?: number | null
  runStartedAt?: number | null
}): number | null {
  if (a.publishedAt != null) return a.publishedAt
  if (a.scheduledFor != null) return a.scheduledFor
  if (a.runStartedAt == null) return null
  const order = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dow = order.indexOf(zonedParts(a.runStartedAt).weekday)
  const ahead = (4 - dow + 7) % 7
  const base = a.runStartedAt + ahead * DAY_MS
  // A DST shift can move the local clock by 1h; pick the offset that lands on Thursday.
  for (const off of [0, -3600_000, 3600_000]) {
    if (zonedParts(base + off).weekday === 'Thursday') return base + off
  }
  return base
}

export function formatIssueLine(a: {
  issueNumber: number | null
  publishedAt?: number | null
  scheduledFor?: number | null
  runStartedAt?: number | null
  published?: boolean
}): string {
  if (a.issueNumber == null) return "This week's issue"
  const t = issueThursday(a)
  if (t == null) return `Issue ${a.issueNumber}`
  return `Issue ${a.issueNumber} · ${formatLongDate(t)}${a.published ? ' · Published' : ''}`
}
