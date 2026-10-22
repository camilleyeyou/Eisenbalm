/**
 * issueNumber parsing and admin run URLs.
 *
 * Quick 261021-j83: the console's issue-keyed stage routes
 * (`/issues/[n]/story|draft|review|fact-check|voice|approval`) are gone; the
 * editor area is `/`, `/s/[section]` and `/archive`, and run internals live
 * at `/admin/runs/[runId]`. The strict parser, the admin run href and (quick
 * 261022-cr6) the open-an-issue / edit-a-section hrefs remain. Earlier issues
 * open through an explicit `?run=<runId>` on `/s/[section]`.
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

/** The Admin run-detail page for a run. */
export function adminRunHref(runId: string): string {
  return `/admin/runs/${encodeURIComponent(runId)}`
}

/** Opens an issue's draft: '/' for the current run, else the section editor pinned to that run. */
export function issueOpenHref(runId: string, currentRunId: string | null | undefined): string {
  if (runId === currentRunId) return '/'
  return `/s/originStory?run=${encodeURIComponent(runId)}`
}

/** Edit link for one section of a run. */
export function sectionEditHref(
  sectionId: string,
  runId: string,
  currentRunId?: string | null,
): string {
  if (runId === currentRunId) return `/s/${sectionId}`
  return `/s/${sectionId}?run=${encodeURIComponent(runId)}`
}
