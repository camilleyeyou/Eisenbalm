/**
 * Config — Phase 25 (RUN-02/RUN-03/RUN-06).
 *
 * Three panels:
 *   1. Automation — kill-switch toggle + schedule editor + NextRunDisplay (D-11)
 *   2. Budget Caps — per-run cap, monthly cap, alert threshold + projection
 *   3. Danger Zone — copy-only, border-red-200, text-red-700 heading
 *
 * Server Component: resolves workspace_id, renders three client panels below.
 * force-dynamic: Convex useQuery subscriptions require a live ConvexProvider
 * context — static prerendering would throw without this.
 */
export const dynamic = 'force-dynamic'

import { getCurrentWorkspace } from '@/lib/workspace'
import AutomationPanel from './_components/AutomationPanel'
import BudgetCapsPanel from './_components/BudgetCapsPanel'

export default async function ConfigPage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Config</h1>

      {/* Panel 1 — Automation */}
      <AutomationPanel workspace_id={workspace_id} />

      {/* Panel 2 — Budget Caps */}
      <BudgetCapsPanel workspace_id={workspace_id} />

      {/* Panel 3 — Danger Zone */}
      <div className="rounded-lg border border-red-200 bg-white p-5">
        <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
        <p className="mt-2 text-sm text-neutral-600">
          To force-cancel a running run, go to Runs and click Cancel on the active run.
        </p>
      </div>
    </div>
  )
}
