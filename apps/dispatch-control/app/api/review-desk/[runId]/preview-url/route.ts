/**
 * Phase 31 (D-02) — server-only signed preview-URL resolver.
 *
 * The [runId] Review Desk editor page is a Client Component (it owns
 * selectedSection state + calls getDraft() with a Clerk token), so it cannot
 * import lib/previewToken.ts directly — that module reads PREVIEW_SECRET and
 * uses node:crypto, which must never reach the browser bundle. This Route
 * Handler does the server-side slug resolution + HMAC signing (mirrors
 * run-monitor/runs/[runId]/review/page.tsx's slug-resolution chain) and
 * returns just the signed URL.
 *
 * Protected by the standing clerkMiddleware (all /api routes require auth).
 */
import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { buildPreviewUrl } from '@/lib/previewToken'
import { api } from '@convex/_generated/api'

export const dynamic = 'force-dynamic'

function getConvexHttpClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) return null
  return new ConvexHttpClient(url)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params
  const slugParam = req.nextUrl.searchParams.get('slug') ?? undefined

  let sanityIssueId: string | undefined
  const convex = getConvexHttpClient()
  if (convex) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pRun = await convex.query((api as any).pipelineRuns.byRunId, { runId })
      if (pRun?.sanityIssueId) sanityIssueId = pRun.sanityIssueId
    } catch {
      // Non-critical — fall through to the runId fallback below.
    }
  }

  const slug = slugParam ?? sanityIssueId ?? runId

  try {
    const previewUrl = buildPreviewUrl(runId, slug)
    return NextResponse.json({ previewUrl })
  } catch {
    return NextResponse.json({ previewUrl: null }, { status: 200 })
  }
}
