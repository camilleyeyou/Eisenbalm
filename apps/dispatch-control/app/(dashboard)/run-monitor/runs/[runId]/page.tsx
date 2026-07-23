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
 *
 * quick 260722-tv1: root gains `mx-auto w-full max-w-[1600px]` — matches the
 * workspace's 1600px measure so this detail view doesn't stretch
 * edge-to-edge on wide monitors.
 *
 * quick 260722-v01 (graph components token migration follow-up): heading
 * migrated onto the `var(--color-*)` / bracket-pixel system — no structural
 * change.
 */
import RunDetail from '../_components/RunDetail'

interface RunDetailPageProps {
  params: Promise<{ runId: string }>
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = await params

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-[20px] font-semibold text-[color:var(--color-ink)]">
        Run Detail
      </h1>
      <RunDetail runId={runId} />
    </div>
  )
}
