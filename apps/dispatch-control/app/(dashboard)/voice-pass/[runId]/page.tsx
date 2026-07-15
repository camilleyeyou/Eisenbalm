/**
 * Phase 40 (ISS-02, D-07, Plan 40-06 Task 3) — legacy run-keyed URL redirect.
 *
 * Mirrors review-desk/[runId]/page.tsx's redirect exactly (Task 3 sibling):
 * `/voice-pass/[runId]` no longer renders the de-slop screen directly (that
 * component moved to the co-located `VoicePassRunView.tsx` in Task 1, and
 * is now mounted at `/issues/[issueNumber]/voice`, Task 2). Resolves
 * `runId -> issueNumber` server-side, then hands off to
 * `legacyRedirectTarget('voice', ...)` — never a run-keyed URL.
 */
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { legacyRedirectTarget } from '@/lib/issueRouteResolver'

export const dynamic = 'force-dynamic'

interface LegacyVoicePassRedirectProps {
  params: Promise<{ runId: string }>
}

export default async function LegacyVoicePassRedirect({
  params,
}: LegacyVoicePassRedirectProps) {
  const { runId } = await params
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const pRun = url ? await new ConvexHttpClient(url).query(api.pipelineRuns.byRunId, { runId }) : null
  redirect(legacyRedirectTarget('voice', pRun?.issueNumber ?? null))
}
