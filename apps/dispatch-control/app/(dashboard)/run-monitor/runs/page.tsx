/**
 * Runs — Phase 23 OBS-02/OBS-04 + Phase 25 RUN-01/RUN-06.
 *
 * Server Component: resolves workspace_id and renders:
 *   1. BudgetAlertBanner — amber warning when MTD spend crosses alert threshold
 *   2. RunControlBar     — page heading + Trigger Run button (two-step inline confirm)
 *   3. CostRollup        — weekly/monthly aggregate spend (collapsible)
 *   4. RunsTable         — full run history, newest-first, each row links to /run-monitor/runs/{runId}
 *
 * force-dynamic: Convex useQuery subscriptions require a live ConvexProvider
 * context — static prerendering (no Convex URL in CI) would throw without this.
 */
export const dynamic = 'force-dynamic'

import { getCurrentWorkspace } from '@/lib/workspace'
import BudgetAlertBanner from './_components/BudgetAlertBanner'
import RunControlBar from './_components/RunControlBar'
import CostRollup from './_components/CostRollup'
import RunsTable from './_components/RunsTable'
import ReviewQueue from './_components/ReviewQueue'

export default async function RunsPage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="space-y-4">
      <BudgetAlertBanner workspace_id={workspace_id} />
      <RunControlBar workspace_id={workspace_id} />
      <CostRollup workspace_id={workspace_id} />
      {/* Phase 26 RVW-01/02: Awaiting-review queue above run history */}
      <ReviewQueue workspace_id={workspace_id} />
      <RunsTable workspace_id={workspace_id} />
    </div>
  )
}
