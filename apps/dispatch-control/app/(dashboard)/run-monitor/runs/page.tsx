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
 *
 * quick 260722-tv1: root gains `mx-auto w-full max-w-[1600px]` — matches the
 * workspace's 1600px measure so the run table/cards don't stretch
 * edge-to-edge on wide monitors.
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getCurrentWorkspace } from '@/lib/workspace'
import { WORKBENCH_NAV_LABELS } from '@/lib/nomenclature'
import BudgetAlertBanner from './_components/BudgetAlertBanner'
import RunControlBar from './_components/RunControlBar'
import CostRollup from './_components/CostRollup'
import RunsTable from './_components/RunsTable'
import ReviewQueue from './_components/ReviewQueue'

// quick 260723-4a6 (Task 1e): Server Component route — static title.
export const metadata: Metadata = { title: WORKBENCH_NAV_LABELS.run_monitor }

export default async function RunsPage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4">
      <BudgetAlertBanner workspace_id={workspace_id} />
      <RunControlBar workspace_id={workspace_id} />
      <CostRollup workspace_id={workspace_id} />
      {/* Phase 26 RVW-01/02: Awaiting-review queue above run history */}
      <ReviewQueue workspace_id={workspace_id} />
      <RunsTable workspace_id={workspace_id} />
    </div>
  )
}
