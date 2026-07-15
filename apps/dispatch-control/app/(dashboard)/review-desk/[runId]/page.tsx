/**
 * Phase 40 (ISS-02, D-07, Plan 40-06 Task 3) — legacy run-keyed URL redirect.
 *
 * `/review-desk/[runId]` no longer renders the galley editor directly (that
 * component moved to the co-located `ReviewDeskRunView.tsx` in Task 1, and
 * is now mounted at `/issues/[issueNumber]/review`, Task 2). This route is
 * now redirect-only: it resolves `runId -> issueNumber` via a server-side
 * Convex read, then hands off to `legacyRedirectTarget` — which NEVER
 * returns a run-keyed URL (that would redirect-loop old bookmarked links).
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { legacyRedirectTarget } from '@/lib/issueRouteResolver'

export const dynamic = 'force-dynamic'

interface LegacyReviewDeskRedirectProps {
  params: Promise<{ runId: string }>
}

export default async function LegacyReviewDeskRedirect({
  params,
}: LegacyReviewDeskRedirectProps) {
  const { runId } = await params
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const pRun = url ? await new ConvexHttpClient(url).query(api.pipelineRuns.byRunId, { runId }) : null
  redirect(legacyRedirectTarget('review', pRun?.issueNumber ?? null))
}
