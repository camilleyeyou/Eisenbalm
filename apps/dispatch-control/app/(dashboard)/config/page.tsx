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

import type { Metadata } from 'next'
import { getCurrentWorkspace } from '@/lib/workspace'
import AutomationPanel from './_components/AutomationPanel'
import BudgetCapsPanel from './_components/BudgetCapsPanel'

// quick 260723-4a6 (Task 1e): Server Component route — static title.
export const metadata: Metadata = { title: 'Configuration' }

export default async function ConfigPage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[color:var(--color-ink)]">Config</h1>

      {/* Panel 1 — Automation */}
      <AutomationPanel workspace_id={workspace_id} />

      {/* Hidden per quick 261021-ind (auto-publish returns later): the
          Panel 1b AutoPublishToggle is not mounted; the component and the
          auto_publish config key remain. */}

      {/* Panel 2 — Budget Caps */}
      <BudgetCapsPanel workspace_id={workspace_id} />

      {/* Panel 3 — Danger Zone */}
      <div className="rounded-none border border-[color:var(--color-vermilion)]/40 bg-[color:var(--color-card)] p-5">
        <h2 className="text-base font-semibold text-[color:var(--color-vermilion)]">Danger Zone</h2>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          To force-cancel a running run, go to Runs and click Cancel on the active run.
        </p>
      </div>
    </div>
  )
}
