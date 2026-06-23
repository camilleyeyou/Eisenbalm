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

import { getCurrentWorkspace } from '@/lib/workspace'
import AddCharityDialogTrigger from './_components/AddCharityDialogTrigger'
import RegistryTable from './_components/RegistryTable'

export default async function RegistryPage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-neutral-900">Charity Registry</h1>
        <AddCharityDialogTrigger workspace_id={workspace_id} />
      </div>

      <RegistryTable workspace_id={workspace_id} />
    </div>
  )
}
