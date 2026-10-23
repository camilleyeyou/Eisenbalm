/**
 * Runs — Phase 23 OBS-02/OBS-04 + Phase 25 RUN-01/RUN-06.
 *
 * Server Component: resolves workspace_id and renders:
 *   1. BudgetAlertBanner — amber warning when MTD spend crosses alert threshold
 *   2. RunControlBar     — Start a new issue button (two-step inline confirm)
 *   3. CostRollup        — weekly/monthly aggregate spend (collapsible)
 *   4. RunsTable         — full run history, newest-first, each row links to /admin/runs/{runId}
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
import BudgetAlertBanner from './_components/BudgetAlertBanner'
import RunControlBar from './_components/RunControlBar'
import CostRollup from './_components/CostRollup'
import RunsTable from './_components/RunsTable'
import ReviewQueue from './_components/ReviewQueue'

// quick 260723-4a6 (Task 1e): Server Component route — static title.
export const metadata: Metadata = { title: 'Past issues, step by step' }

export default async function RunsPage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-[32px] font-semibold leading-[1.15] text-[color:var(--color-ink)]">
          Past issues, step by step
        </h1>
        <p className="mt-2 font-[family-name:var(--font-body)] text-[17px] leading-[1.55] text-[color:var(--color-ink-soft)]">
          How each issue was made. Open one to see every step.
        </p>
      </header>
      <BudgetAlertBanner workspace_id={workspace_id} />
      <RunControlBar workspace_id={workspace_id} />
      <CostRollup workspace_id={workspace_id} />
      {/* Phase 26 RVW-01/02: Awaiting-review queue above run history */}
      <ReviewQueue workspace_id={workspace_id} />
      <RunsTable workspace_id={workspace_id} />
    </div>
  )
}
