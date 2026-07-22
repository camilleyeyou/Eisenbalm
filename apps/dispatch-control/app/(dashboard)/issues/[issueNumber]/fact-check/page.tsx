/**
 * Phase 42 (FCT-02/03/04/05/06, Plan 42-06 Task 3) — issue-keyed thin wrapper
 * mounting the real Stage 3 (Fact Check) screen.
 *
 * Same resolution shape as the story/review/voice wrappers: resolve
 * `issueNumber` -> the most recent `runId` for that issue server-side via
 * `api.pipelineRuns.byIssueNumber`, then mount the client `FactCheckScreen`
 * with the resolved `runId` so its coverage summary, filters, and claim
 * table all read the SAME run's `claim_checks` rows.
 *
 * `FactCheckPanelPublisher` stays mounted as the default context-panel
 * content when no claim is selected — `FactCheckScreen` overrides it with
 * the shared `ClaimProvenanceCard` on selection and restores it on
 * deselect/cleanup (D-19).
 *
 * Debug session issue-workspace-blink-loop (2026-07-22): the no-run redirect
 * below targets Story (`issueStoryHref`), not the bare `/issues/[n]` index —
 * redirecting to the index can bounce right back here via
 * `issue.lastVisitedStage`, producing an infinite redirect loop for any
 * issue whose `lastVisitedStage` is `'fact-check'` while it currently has no
 * run. Story always handles the no-run case without a further redirect.
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { parseIssueNumber, issueStoryHref } from '@/lib/issueRouteResolver'
import FactCheckScreen from './FactCheckScreen'
import FactCheckPanelPublisher from './FactCheckPanelContent'

export const dynamic = 'force-dynamic'

interface IssueFactCheckPageProps {
  params: Promise<{ issueNumber: string }>
}

export default async function IssueFactCheckPage({ params }: IssueFactCheckPageProps) {
  const { issueNumber: rawIssueNumber } = await params
  const n = parseIssueNumber(rawIssueNumber)
  if (n === null) redirect('/issues')

  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const run = url
    ? await new ConvexHttpClient(url).query(api.pipelineRuns.byIssueNumber, { issueNumber: n })
    : null
  if (!run) redirect(issueStoryHref(n))

  return (
    <>
      <FactCheckPanelPublisher />
      <FactCheckScreen runId={run.runId} />
    </>
  )
}
