/**
 * Phase 41 (WSP-07, D-11, Plan 41-07 Task 2) — issue-keyed thin wrapper
 * mounting the Stage 3 (Fact Check) placeholder.
 *
 * Same resolution shape as the story/review/voice wrappers: resolve
 * `issueNumber` -> the most recent `runId` for that issue server-side via
 * `api.pipelineRuns.byIssueNumber`, then mount the client
 * `FactCheckPlaceholder` with the resolved `runId` so its coverage summary
 * reads the SAME run's `claim_checks` rows.
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { parseIssueNumber, issueHref } from '@/lib/issueRouteResolver'
import FactCheckPlaceholder from './FactCheckPlaceholder'
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
  if (!run) redirect(issueHref(n))

  return (
    <>
      <FactCheckPanelPublisher />
      <FactCheckPlaceholder runId={run.runId} />
    </>
  )
}
