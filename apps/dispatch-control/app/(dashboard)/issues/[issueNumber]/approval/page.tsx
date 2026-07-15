/**
 * Phase 41 (WSP-05/WSP-06, D-13, Plan 41-09 Task 1) — issue-keyed Stage 5
 * (Approval) server wrapper.
 *
 * Same resolution shape as the draft/voice/story wrappers: resolve
 * `issueNumber` -> the most recent `runId` for that issue server-side via
 * `api.pipelineRuns.byIssueNumber` (a server-side `ConvexHttpClient` call, so
 * the redirect/render decision never depends on a client-side subscription
 * racing the first paint). This wrapper does ONLY the runId resolution + the
 * no-run redirect — it does NOT read `held` (or any other issue field). The
 * frame's `WorkspaceStateProvider` (Plan 41-05) already subscribes to
 * `held` once for the whole Workspace; the client inner `ApprovalStage`
 * reads it from `useWorkspaceState()` instead of a second query
 * (41-RESEARCH Pitfall 3 — no duplicated subscriptions).
 *
 * - `parseIssueNumber` fails -> redirect to `/issues` (unknown/garbage param).
 * - No run yet for a real issue -> redirect to the issue overview
 *   (`/issues/[n]`) rather than showing a broken rail.
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { parseIssueNumber, issueHref } from '@/lib/issueRouteResolver'
import ApprovalStage from './ApprovalStage'

export const dynamic = 'force-dynamic'

interface IssueApprovalPageProps {
  params: Promise<{ issueNumber: string }>
}

export default async function IssueApprovalPage({ params }: IssueApprovalPageProps) {
  const { issueNumber: rawIssueNumber } = await params
  const n = parseIssueNumber(rawIssueNumber)
  if (n === null) redirect('/issues')

  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const run = url
    ? await new ConvexHttpClient(url).query(api.pipelineRuns.byIssueNumber, { issueNumber: n })
    : null
  if (!run) redirect(issueHref(n))

  return <ApprovalStage runId={run.runId} issueNumber={n} />
}
