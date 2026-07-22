/**
 * Phase 40 (ISS-02, D-07, D-09, Plan 40-06 Task 2) — issue-keyed thin
 * wrapper around the already-shipped Voice Pass de-slop screen.
 *
 * Same resolution shape as the review wrapper (Task 2 sibling): resolve
 * `issueNumber` -> the most recent `runId` for that issue server-side, then
 * mount the named `VoicePassScreen` export directly with a plain `runId`
 * (no `params` Promise needed for this entry point — the default `page.tsx`
 * wrapper it used to have already un-wrapped `params` for us).
 *
 * Debug session issue-workspace-blink-loop (2026-07-22): the no-run redirect
 * below targets Story (`issueStoryHref`), not the bare `/issues/[n]` index —
 * redirecting to the index can bounce right back here via
 * `issue.lastVisitedStage`, producing an infinite redirect loop for any
 * issue whose `lastVisitedStage` is `'voice'` while it currently has no run.
 * Story always handles the no-run case without a further redirect.
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { parseIssueNumber, issueStoryHref } from '@/lib/issueRouteResolver'
import { VoicePassScreen } from '../../../voice-pass/[runId]/VoicePassRunView'
import VoicePanelPublisher from './VoicePanelContent'

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
  if (!run) redirect(issueStoryHref(n))

  return (
    <>
      <VoicePanelPublisher />
      <VoicePassScreen runId={run.runId} />
    </>
  )
}
