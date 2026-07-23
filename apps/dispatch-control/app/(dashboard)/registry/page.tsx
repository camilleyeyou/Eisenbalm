/**
 * Charity Registry — Phase 26 (REG-01).
 *
 * Lists all charities with their state (candidate/featured/blocklisted),
 * featured stats, and controls to blocklist/unblocklist or add manually.
 *
 * Server Component: resolves workspace_id.
 * force-dynamic: Convex useQuery subscriptions require a live ConvexProvider.
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getCurrentWorkspace } from '@/lib/workspace'
import { WORKBENCH_NAV_LABELS } from '@/lib/nomenclature'
import AddCharityDialogTrigger from './_components/AddCharityDialogTrigger'
import CoverageStrip from './_components/CoverageStrip'
import RegistryTable from './_components/RegistryTable'

// quick 260723-4a6 (Task 1e): Server Component route — static title.
export const metadata: Metadata = { title: WORKBENCH_NAV_LABELS.registry }

export default async function RegistryPage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-neutral-900">
          {WORKBENCH_NAV_LABELS.registry}
        </h1>
        <AddCharityDialogTrigger workspace_id={workspace_id} />
      </div>

      {/* Phase 39 (MEM-01, D-01): the coverage-memory strip mounts at the
          top of the Registry, above the charities table. It self-fetches
          via an authenticated pipeline GET — no props needed (the endpoint
          fixes the single "eisenbalm" workspace server-side). */}
      <CoverageStrip />

      <RegistryTable workspace_id={workspace_id} />
    </div>
  )
}
