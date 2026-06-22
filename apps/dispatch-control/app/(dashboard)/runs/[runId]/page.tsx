/**
 * force-dynamic: same reason as runs/page.tsx — Convex useQuery in RunDetail
 * requires a live ConvexProvider and must not be statically prerendered.
 */
export const dynamic = 'force-dynamic'

/**
 * Run Detail — Phase 23 OBS-02/OBS-04: Individual run inspection.
 *
 * Server Component: reads the runId route param and renders RunDetail.
 * RunDetail is a Client Component that subscribes to:
 *   api.runs.byRunId  → run header + cost
 *   api.agentRuns.byRunId → per-agent status + cost + error
 *
 * Read-only — no mutation controls.
 */
import RunDetail from '../_components/RunDetail'

interface RunDetailPageProps {
  params: Promise<{ runId: string }>
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = await params

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Run Detail</h1>
      <RunDetail runId={runId} />
    </div>
  )
}
