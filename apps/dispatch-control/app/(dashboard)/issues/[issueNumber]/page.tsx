/**
 * Phase 41 Plan 41-06 (D-03/D-04) — the bare `/issues/[n]` redirect.
 *
 * Phase 40's issue overview (status readout, the 5-segment stage strip,
 * task count, Open Review/Voice links, Hold/Reopen wiring, run history) has
 * been fully relocated: status + the stage tabs + task count now live in
 * the frame header (`../layout.tsx`), Hold/Reopen + run history now live in
 * `WorkspaceControls.tsx` (Pitfall 5 — no capability lost). This page is now
 * redirect-only, resolved server-side (no client subscription race on first
 * paint, same pattern as the `review`/`voice` wrappers).
 *
 * D-03: redirect into the frame at `lastVisitedStage` (from the `issues`
 * table) when it is set to one of the 5 known stage segments.
 * D-04: otherwise, the default landing stage is the earliest stage with
 * real work — Draft when a run exists AND a pitch is already selected,
 * Story otherwise (this also covers "no run at all").
 *
 * `parseIssueNumber` failure -> redirect('/issues') (unknown/garbage param).
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import {
  parseIssueNumber,
  issueStoryHref,
  issueDraftHref,
  issueFactCheckHref,
  issueVoiceHref,
  issueApprovalHref,
} from '@/lib/issueRouteResolver'

export const dynamic = 'force-dynamic'

interface IssueWorkspaceIndexPageProps {
  params: Promise<{ issueNumber: string }>
}

const VALID_STAGE_SEGMENTS = new Set(['story', 'draft', 'fact-check', 'voice', 'approval'])

function stageHrefFor(n: number, stage: string): string | null {
  switch (stage) {
    case 'story':
      return issueStoryHref(n)
    case 'draft':
      return issueDraftHref(n)
    case 'fact-check':
      return issueFactCheckHref(n)
    case 'voice':
      return issueVoiceHref(n)
    case 'approval':
      return issueApprovalHref(n)
    default:
      return null
  }
}

export default async function IssueWorkspaceIndexPage({ params }: IssueWorkspaceIndexPageProps) {
  const { issueNumber: rawIssueNumber } = await params
  const n = parseIssueNumber(rawIssueNumber)
  if (n === null) redirect('/issues')

  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const client = url ? new ConvexHttpClient(url) : null

  const issue = client
    ? await client.query(api.issues.byIssueNumber, { workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n })
    : null

  // D-03 — prefer the last-visited stage when it is a known, valid segment.
  const lastVisitedStage = issue?.lastVisitedStage
  if (typeof lastVisitedStage === 'string' && VALID_STAGE_SEGMENTS.has(lastVisitedStage)) {
    const href = stageHrefFor(n, lastVisitedStage)
    if (href) redirect(href)
  }

  // D-04 default — Draft if a run exists AND a pitch is already selected,
  // Story otherwise (no run at all also lands on Story).
  const run = client ? await client.query(api.pipelineRuns.byIssueNumber, { issueNumber: n }) : null
  const selectedPitch =
    client && run ? await client.query(api.pitchLog.selectedByRunId, { runId: run.runId }) : null

  if (run && selectedPitch) redirect(issueDraftHref(n))
  redirect(issueStoryHref(n))
}
