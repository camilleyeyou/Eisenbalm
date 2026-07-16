/**
 * Phase 47 Plan 47-08 (BRF-01..06, D-01) — issue-keyed wrapper mounting the
 * full Story & Brief stage (`StoryBriefScreen`), replacing the provisional
 * `SignalDeskScreen` + its 131-line context-panel-publisher placeholder
 * sibling file Phase 41 mounted here (DELETED this plan, not extended).
 *
 * Same resolution shape as the other stage wrappers (Plan 41-07): resolve
 * `issueNumber` -> the most recent `runId` for that issue server-side via
 * `api.pipelineRuns.byIssueNumber`. UNLIKE the other stage wrappers, this one
 * does NOT redirect away when no run exists yet — Stage 1 is the FIRST stage
 * (D-04, `issues/[issueNumber]/page.tsx`: "no run at all also lands on
 * Story"), so `StoryBriefScreen` itself renders the Annotations §Stage 1
 * Empty state (the CreatePanel Create path) for that case.
 */
import { ConvexHttpClient } from 'convex/browser'
import { redirect } from 'next/navigation'
import { api } from '@convex/_generated/api'
import { parseIssueNumber } from '@/lib/issueRouteResolver'
import { StoryBriefScreen } from '../../../story-brief/_components/StoryBriefScreen'

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

  return <StoryBriefScreen issueNumber={n} runId={run?.runId ?? null} />
}
