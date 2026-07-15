/**
 * Phase 40 (ISS-02, D-07, D-09, Plan 40-06 Task 2) — issue-keyed thin
 * wrapper around the already-shipped Voice Pass de-slop screen.
 *
 * Same resolution shape as the review wrapper (Task 2 sibling): resolve
 * `issueNumber` -> the most recent `runId` for that issue server-side, then
 * mount the named `VoicePassScreen` export directly with a plain `runId`
 * (no `params` Promise needed for this entry point — the default `page.tsx`
 * wrapper it used to have already un-wrapped `params` for us).
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { parseIssueNumber, issueHref } from '@/lib/issueRouteResolver'
import { VoicePassScreen } from '../../../voice-pass/[runId]/VoicePassRunView'

export const dynamic = 'force-dynamic'

interface IssueVoicePageProps {
  params: Promise<{ issueNumber: string }>
}

export default async function IssueVoicePage({ params }: IssueVoicePageProps) {
  const { issueNumber: rawIssueNumber } = await params
  const n = parseIssueNumber(rawIssueNumber)
  if (n === null) redirect('/issues')

  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const run = url
    ? await new ConvexHttpClient(url).query(api.pipelineRuns.byIssueNumber, { issueNumber: n })
    : null
  if (!run) redirect(issueHref(n))

  return <VoicePassScreen runId={run.runId} />
}
