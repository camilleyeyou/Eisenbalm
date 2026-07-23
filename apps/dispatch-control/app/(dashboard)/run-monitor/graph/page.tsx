/**
 * force-dynamic: Convex useQuery subscriptions (in PipelineGraph) require a
 * live ConvexProvider context — static prerendering throws without this.
 */
export const dynamic = 'force-dynamic'

/**
 * Phase 23 — Graph page (Server Component).
 *
 * Resolves the workspace_id server-side and passes it to the Client Component
 * canvas. All Convex subscriptions (useQuery) live in PipelineGraph — this
 * page stays a Server Component per Pitfall 3 (ReactFlowProvider must be in
 * a Client Component).
 *
 * The page shell + height: The dashboard layout sets h-screen overflow-hidden;
 * this page fills the remaining content area with flex-1. We set h-full on
 * the graph container so React Flow's canvas fills the viewport.
 *
 * quick 260722-tv1: root drops the vertical half of `-m-6` (kept `-mx-6`) —
 * `-my-6` pulled this page's own header under the run-monitor tab bar and
 * added ~24px of overscroll past the tab bar's sticky top offset.
 *
 * quick 260722-v01 (audit item 9): header typography/color migrated onto the
 * `var(--color-*)` / bracket-pixel system — no structural change.
 */
import { getCurrentWorkspace } from '@/lib/workspace'
import { PipelineGraph } from './_components/PipelineGraph'

export default async function GraphPage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="flex flex-col h-full -mx-6">
      {/* Page header — outside the graph canvas so it doesn't overlap nodes */}
      <div className="px-6 pt-6 pb-3 shrink-0">
        <h1 className="font-[family-name:var(--font-display)] text-[20px] font-semibold text-[color:var(--color-ink)]">
          Pipeline Graph
        </h1>
        <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)] mt-0.5">
          Live agent DAG — click a node to inspect I/O and cost.
        </p>
      </div>

      {/* React Flow canvas — fills remaining height */}
      <div className="flex-1 min-h-0">
        <PipelineGraph workspace_id={workspace_id} />
      </div>
    </div>
  )
}
