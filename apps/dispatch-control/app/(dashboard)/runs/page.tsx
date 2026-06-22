/**
 * Runs — Phase 23 OBS-02/OBS-04: Run history + cost roll-up.
 *
 * Server Component: resolves workspace_id and renders:
 *   1. CostRollup — weekly/monthly aggregate spend (collapsible)
 *   2. RunsTable  — full run history, newest-first, each row links to /runs/{runId}
 *
 * Both components are Client Components that subscribe to Convex queries.
 * Read-only — no mutation controls.
 *
 * force-dynamic: Convex useQuery subscriptions require a live ConvexProvider
 * context — static prerendering (no Convex URL in CI) would throw without this.
 */
export const dynamic = 'force-dynamic'

import { getCurrentWorkspace } from '@/lib/workspace'
import CostRollup from './_components/CostRollup'
import RunsTable from './_components/RunsTable'

export default async function RunsPage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Runs</h1>
      <CostRollup workspace_id={workspace_id} />
      <RunsTable workspace_id={workspace_id} />
    </div>
  )
}
