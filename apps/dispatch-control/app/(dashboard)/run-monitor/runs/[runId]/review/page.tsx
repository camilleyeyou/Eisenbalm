/**
 * Phase 26 (RVW-02) — Preview-centric review screen.
 *
 * Server Component: resolves workspace_id + runId, fetches run metadata for
 * cost and the issue slug (used to build the signed preview URL server-side so
 * PREVIEW_SECRET never reaches the browser).
 *
 * Layout (UI-SPEC Screen 2 / D-10):
 *   ≥1280px: two-column — LEFT (~64%) preview iframe, RIGHT (~36% sticky):
 *              cost card → ClaimsChecklist → ReviewDecisionPanel
 *   <1280px: single column, decisions in a fixed bottom bar
 *
 * Slug resolution:
 *   1. `?slug=` search param (passed by reviewers who know the slug)
 *   2. `sanityIssueId` from pipelineRuns (Sanity _id, may serve as slug fallback)
 *   3. runId as last-resort placeholder (preview will show "unavailable" gracefully)
 *
 * TODO(D-slug): once `runs` or `pipelineRuns` carries an explicit `issueSlug`
 * field, replace the fallback chain with a direct read.
 */
export const dynamic = 'force-dynamic'

import { ConvexHttpClient } from 'convex/browser'
import { getCurrentWorkspace } from '@/lib/workspace'
import { buildPreviewUrl } from '@/lib/previewToken'
import { parseCostJson } from '@/lib/costRollup'
import { api } from '@convex/_generated/api'
import PreviewIframe from './_components/PreviewIframe'
import ClaimsChecklist from './_components/ClaimsChecklist'
import ReviewDecisionPanel from './_components/ReviewDecisionPanel'

// ── Server-side Convex client ─────────────────────────────────────────────────

function getConvexHttpClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) return null
  return new ConvexHttpClient(url)
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface ReviewPageProps {
  params: Promise<{ runId: string }>
  searchParams: Promise<{ slug?: string }>
}

export default async function ReviewPage({ params, searchParams }: ReviewPageProps) {
  const [{ runId }, { slug: slugParam }] = await Promise.all([params, searchParams])

  await getCurrentWorkspace()

  // Fetch run metadata server-side to get cost + Sanity issue ID.
  let costDisplay = '—'
  let sanityIssueId: string | undefined
  const convex = getConvexHttpClient()
  if (convex) {
    try {
      const run = await convex.query(api.runs.byRunId, { runId })
      if (run) {
        const cost = parseCostJson(run.cost).total
        if (cost > 0) costDisplay = `$${cost.toFixed(4)}`
      }
      // pipelineRuns has sanityIssueId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pRun = await convex.query((api as any).pipelineRuns.byRunId, { runId })
      if (pRun?.sanityIssueId) sanityIssueId = pRun.sanityIssueId
    } catch {
      // Non-critical — proceed with empty cost display
    }
  }

  // Slug resolution chain.
  // Priority: explicit ?slug= → sanityIssueId → runId
  const slug = slugParam ?? sanityIssueId ?? runId

  // Build signed preview URL server-side (PREVIEW_SECRET stays server-only).
  let previewUrl: string | null = null
  try {
    previewUrl = buildPreviewUrl(runId, slug)
  } catch {
    // PREVIEW_SECRET or NEXT_PUBLIC_WEB_PREVIEW_BASE not configured — preview unavailable
  }

  return (
    <div className="relative">
      {/* Page heading (responsive: hidden on narrow to save space) */}
      <h1 className="sr-only">Review Run {runId}</h1>

      {/* ── Two-column layout (≥1280px) ─────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:gap-0 xl:items-stretch">

        {/* LEFT COLUMN — Preview iframe */}
        <div
          className="xl:flex-[0_0_64%] xl:max-w-[64%] order-1"
          style={{ height: 'calc(100vh - 64px)' }}
        >
          {previewUrl ? (
            <PreviewIframe previewUrl={previewUrl} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-50 text-center px-8">
              <div>
                <p className="text-sm font-medium text-neutral-700">Preview unavailable.</p>
                <p className="mt-1 text-sm text-neutral-500">
                  PREVIEW_SECRET or NEXT_PUBLIC_WEB_PREVIEW_BASE is not configured.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Cost + Claims + Decisions (sticky on xl) */}
        <div className="order-2 xl:flex-[0_0_36%] xl:max-w-[36%] xl:sticky xl:top-0 xl:self-start xl:overflow-y-auto border-l border-neutral-200 bg-white">
          <div
            className="flex flex-col gap-5 p-5"
            style={{ maxHeight: 'calc(100vh - 64px)' }}
          >
            {/* Cost summary card */}
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs text-neutral-500 uppercase tracking-wide">
                Estimated run cost
              </p>
              <p className="mt-1 text-base font-semibold text-neutral-900">
                {costDisplay}
              </p>
              <p className="mt-0.5 text-xs text-neutral-400 font-mono truncate" title={runId}>
                {runId}
              </p>
            </div>

            {/* Claims checklist */}
            <ClaimsChecklist runId={runId} />

            {/* Decision panel */}
            <ReviewDecisionPanel runId={runId} />
          </div>
        </div>
      </div>

      {/* ── Narrow-viewport fixed bottom bar (<1280px) ───────────────────── */}
      {/* On narrow screens, decisions are collapsed into a bottom bar.
          The right column is still shown above (stacked), but on very narrow
          layouts the approve button floats for quick access. */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-neutral-200 bg-white px-4 py-2 flex items-center gap-2">
        <p className="text-xs text-neutral-500 flex-1">
          Sign off claims to enable approve.
        </p>
        {/* Placeholder for overflow; ReviewDecisionPanel handles the full flow
            in the stacked column above. */}
      </div>
    </div>
  )
}
