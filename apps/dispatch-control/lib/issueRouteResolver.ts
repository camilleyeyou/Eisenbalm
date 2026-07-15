/**
 * Phase 40 Plan 40-04 (§40.7, ISS-02) — issueNumber<->URL translation.
 *
 * Pure TS, no imports. Consumed by:
 *   - derivedState.ts (task primary hrefs)
 *   - the routing-inversion plan (40-06) for the legacy-redirect Server
 *     Components at the old run-keyed URLs
 *   - the issue card / header / overview for building links
 *
 * `legacyRedirectTarget` must NEVER return a run-keyed URL (`review-desk` /
 * `voice-pass`) — that would redirect-loop the old bookmarked links.
 */

/**
 * Strict parse: `/^[0-9]+$/` AND the numeric result must be `> 0`. Leading
 * zeros are accepted (`'07'` -> `7`) since Sanity's slug is `issue-{n}` and
 * operators say "Issue 07". Rejects `''`, `'abc'`, `'-1'`, `'1.5'`, `'07x'`,
 * `' 7 '`.
 */
export function parseIssueNumber(param: string): number | null {
  if (!/^[0-9]+$/.test(param)) return null
  const n = Number(param)
  if (!(n > 0)) return null
  return n
}

export function issueHref(issueNumber: number): string {
  return `/issues/${issueNumber}`
}

export function issueReviewHref(issueNumber: number): string {
  return `/issues/${issueNumber}/review`
}

export function issueVoiceHref(issueNumber: number): string {
  return `/issues/${issueNumber}/voice`
}

/**
 * Phase 41 stage-tab hrefs (D-05/D-06). `issueReviewHref` above is KEPT for
 * back-compat — `review/page.tsx` still imports it until Plan 41-06 guts it
 * into a redirect; removing it now would break the Wave 1-2 build.
 */
export function issueStoryHref(issueNumber: number): string {
  return `/issues/${issueNumber}/story`
}

export function issueDraftHref(issueNumber: number): string {
  return `/issues/${issueNumber}/draft`
}

export function issueFactCheckHref(issueNumber: number): string {
  return `/issues/${issueNumber}/fact-check`
}

export function issueApprovalHref(issueNumber: number): string {
  return `/issues/${issueNumber}/approval`
}

export function issueRunHref(issueNumber: number, runId: string): string {
  return `/issues/${issueNumber}/runs/${encodeURIComponent(runId)}`
}

/**
 * The old run-keyed URLs (`/review-desk/[runId]`, `/voice-pass/[runId]`)
 * redirect here once a Convex lookup resolves `runId -> issueNumber` (that
 * lookup happens at the call site — this function is pure). When the
 * issueNumber cannot be resolved (no issue row / unknown runId), fall back
 * to `/issues` — NEVER a run-keyed URL, which would redirect-loop.
 */
export function legacyRedirectTarget(
  surface: 'review' | 'voice',
  issueNumber: number | null | undefined,
): string {
  if (typeof issueNumber !== 'number') return '/issues'
  return surface === 'review' ? issueReviewHref(issueNumber) : issueVoiceHref(issueNumber)
}
