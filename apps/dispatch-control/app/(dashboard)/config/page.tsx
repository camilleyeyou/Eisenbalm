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
import AutoPublishToggle from './_components/AutoPublishToggle'
import BudgetCapsPanel from './_components/BudgetCapsPanel'

export default async function ConfigPage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[color:var(--color-ink)]">Config</h1>

      {/* Panel 1 — Automation */}
      <AutomationPanel workspace_id={workspace_id} />

      {/* Panel 1b — Advanced subsection (auto_publish). Below AutomationPanel per UI-SPEC Screen 4.
          The border-t separator visually connects it to the automation section. */}
      <div className="rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card)] p-5">
        <div className="border-t border-[color:var(--color-ink)]/15 mt-4 pt-4">
          <p className="text-xs text-[color:var(--color-faint)] uppercase tracking-wide mb-4">Advanced</p>
          <AutoPublishToggle workspace_id={workspace_id} />
        </div>
      </div>

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
