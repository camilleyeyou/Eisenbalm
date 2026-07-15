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
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { parseIssueNumber, issueHref } from '@/lib/issueRouteResolver'
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
  if (!run) redirect(issueHref(n))

  return (
    <>
      <FactCheckPanelPublisher />
      <FactCheckScreen runId={run.runId} />
    </>
  )
}
