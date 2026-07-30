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
