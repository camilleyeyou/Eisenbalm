/**
 * Quick 261022-cr6 (client bug 4) — plain-word run labels and the
 * "older runs" split for the Admin runs list. Pure.
 */

export function formatRunLabel(args: {
  issueNumber?: number | null
  charityName?: string | null
  startedAt: number
}): string {
  const date = new Date(args.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const { issueNumber, charityName } = args
  if (issueNumber == null) return `Started ${date}`
  return charityName ? `Issue ${issueNumber} — ${charityName} · ${date}` : `Issue ${issueNumber} · ${date}`
}

/** Runs older than `days` that never reached 'complete' (published) go to `older`. Order preserved. */
export function splitStaleRuns<T extends { startedAt: number; status: string }>(
  runs: T[],
  now: number,
  days = 14,
): { recent: T[]; older: T[] } {
  const cutoff = now - days * 24 * 60 * 60 * 1000
  const recent: T[] = []
  const older: T[] = []
  for (const r of runs) {
    if (r.startedAt < cutoff && r.status !== 'complete') older.push(r)
    else recent.push(r)
  }
  return { recent, older }
}
