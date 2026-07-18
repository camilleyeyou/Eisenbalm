/**
 * Phase 40/34-retirement (ISS-02, D-07; finish-phase-34-retirement quick
 * 260718-00i Task 3) — legacy run-keyed URL redirect.
 *
 * `/run-monitor/runs/[runId]/review` no longer renders the legacy
 * publish/decision panel directly (ReviewDecisionPanel.tsx — deleted in this
 * same task, along with its stale `claimChecks.allSignedOff` gate that
 * disagreed with the server's `signOffs:activeByRunId` gate). This route is
 * now redirect-only, mirroring review-desk/[runId]/page.tsx and
 * voice-pass/[runId]/page.tsx verbatim: it resolves `runId -> issueNumber`
 * via a server-side Convex read, then hands off to `legacyRedirectTarget`
 * (surface `'approval'`) — the true replacement for this panel is the
 * Approval stage (mounts DecisionRail), NOT the galley review stage.
 * `legacyRedirectTarget` NEVER returns a run-keyed URL (that would
 * redirect-loop old bookmarked links).
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { legacyRedirectTarget } from '@/lib/issueRouteResolver'

export const dynamic = 'force-dynamic'

interface LegacyRunReviewRedirectProps {
  params: Promise<{ runId: string }>
}

export default async function LegacyRunReviewRedirect({
  params,
}: LegacyRunReviewRedirectProps) {
  const { runId } = await params
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const pRun = url ? await new ConvexHttpClient(url).query(api.pipelineRuns.byRunId, { runId }) : null
  redirect(legacyRedirectTarget('approval', pRun?.issueNumber ?? null))
}
