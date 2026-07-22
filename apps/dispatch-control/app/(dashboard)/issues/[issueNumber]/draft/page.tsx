/**
 * Phase 41 (WSP-04, WSP-07, D-06/D-07/D-13, Plan 41-08 Task 1) — issue-keyed
 * Stage 2 (Draft) mount, renamed from the Phase 40 `/review` wrapper (the
 * old URL now redirects here — see the sibling `review/page.tsx`).
 *
 * Same resolution shape as the story/fact-check wrappers (Plan 41-07):
 * resolve `issueNumber` -> the most recent `runId` for that issue
 * server-side via `api.pipelineRuns.byIssueNumber` (so the redirect/render
 * decision never depends on a client-side subscription racing the first
 * paint), then mount `ReviewDeskRunView` — the SAME Client Component
 * `/review-desk/[runId]` used to render — with BOTH the resolved `runId`
 * (via `params`) and `issueNumber`. The latter lets the galley's
 * unchecked-claim click-through build a Fact Check href without a second
 * resolution (D-12).
 *
 * - `parseIssueNumber` fails -> redirect to `/issues` (unknown/garbage param).
 * - No run yet for a real issue -> redirect to the Story stage
 *   (`/issues/[n]/story`, D-09) rather than showing a broken editor.
 *   Debug session issue-workspace-blink-loop (2026-07-22): this used to
 *   redirect to the bare `/issues/[n]` index instead. The index page (D-03)
 *   redirects INTO `issue.lastVisitedStage` whenever it's a valid stage
 *   segment, without checking a run exists — so an issue whose
 *   `lastVisitedStage` is `'draft'` (set on an earlier visit, e.g. before its
 *   run was deleted/reset) but which currently has NO run bounced infinitely
 *   between `/issues/[n]` and `/issues/[n]/draft`. Story is the one stage
 *   wrapper already designed to handle the no-run case gracefully (renders
 *   `StoryBriefScreen`'s Empty/CreatePanel state, no further redirect) —
 *   redirecting here breaks the cycle at its source. Mirrors the index
 *   page's own D-04 fallback: "no run at all also lands on Story."
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { parseIssueNumber, issueStoryHref } from '@/lib/issueRouteResolver'
import ReviewDeskRunView from '../../../review-desk/[runId]/ReviewDeskRunView'
import DraftPanelPublisher from './DraftPanelContent'

export const dynamic = 'force-dynamic'

interface IssueDraftPageProps {
  params: Promise<{ issueNumber: string }>
}

export default async function IssueDraftPage({ params }: IssueDraftPageProps) {
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
      <DraftPanelPublisher />
      <ReviewDeskRunView params={Promise.resolve({ runId: run.runId })} issueNumber={n} />
    </>
  )
}
