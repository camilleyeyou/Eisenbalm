/**
 * Phase 41 (WSP-01, D-09/D-10, Plan 41-07 Task 1) — issue-keyed thin wrapper
 * mounting the Signal Desk as Stage 1 (Story).
 *
 * Same resolution shape as the review/voice wrappers (Phase 40, Plan 40-06
 * Task 2/3): resolve `issueNumber` -> the most recent `runId` for that issue
 * server-side via `api.pipelineRuns.byIssueNumber`, then mount
 * `SignalDeskScreen` with BOTH `workspace_id` and the 41-04 additive `runId`
 * prop so it scopes to THIS issue's run — not `runs.latest` (Pitfall 2: the
 * runId prop must never be dropped, or the tab silently shows the wrong run).
 *
 * Do NOT rebuild SignalDeskScreen here — its internal "Signal Desk" header is
 * an ACCEPTED provisional-mount carryover this phase; the full Story redesign
 * is Phase 47. The frame (layout.tsx) already supplies the Story tab + the
 * outline presence (D-10).
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { parseIssueNumber, issueHref } from '@/lib/issueRouteResolver'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { SignalDeskScreen } from '../../../signal-desk/_components/SignalDeskScreen'
import StoryPanelPublisher from './StoryPanelContent'

export const dynamic = 'force-dynamic'

interface IssueStoryPageProps {
  params: Promise<{ issueNumber: string }>
}

export default async function IssueStoryPage({ params }: IssueStoryPageProps) {
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
      <StoryPanelPublisher />
      <SignalDeskScreen workspace_id={DEFAULT_WORKSPACE_ID} runId={run.runId} />
    </>
  )
}
