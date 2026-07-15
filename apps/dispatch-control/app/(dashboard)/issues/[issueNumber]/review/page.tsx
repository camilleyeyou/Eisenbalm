/**
 * Phase 40 (ISS-02, D-07, D-09, Plan 40-06 Task 2) — issue-keyed thin
 * wrapper around the already-shipped Review Desk galley.
 *
 * Resolves `issueNumber` (route param) -> the most recent `runId` for that
 * issue via `api.pipelineRuns.byIssueNumber` (server-side Convex read, so
 * the redirect/render decision never depends on a client-side subscription
 * racing the first paint), then mounts `ReviewDeskRunView` — the SAME
 * Client Component `/review-desk/[runId]` used to render — unmodified.
 *
 * - `parseIssueNumber` fails -> redirect to `/issues` (unknown/garbage param).
 * - No run yet for a real issue -> redirect to the issue overview
 *   (`/issues/[n]`, D-09) rather than showing a broken editor.
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { parseIssueNumber, issueHref } from '@/lib/issueRouteResolver'
import ReviewDeskRunView from '../../../review-desk/[runId]/ReviewDeskRunView'

export const dynamic = 'force-dynamic'

interface IssueReviewPageProps {
  params: Promise<{ issueNumber: string }>
}

export default async function IssueReviewPage({ params }: IssueReviewPageProps) {
  const { issueNumber: rawIssueNumber } = await params
  const n = parseIssueNumber(rawIssueNumber)
  if (n === null) redirect('/issues')

  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const run = url
    ? await new ConvexHttpClient(url).query(api.pipelineRuns.byIssueNumber, { issueNumber: n })
    : null
  if (!run) redirect(issueHref(n))

  return <ReviewDeskRunView params={Promise.resolve({ runId: run.runId })} />
}
