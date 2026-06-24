/**
 * Settings — workspace-level operator settings.
 *
 * Phase 28: multi-tenancy, RBAC, and operator role management land here.
 * Phase 23 (AUD-01): audit-log viewer added below existing settings content.
 *
 * force-dynamic: AuditLogViewer uses Convex useQuery and requires a live
 * ConvexProvider — static prerendering would throw without this.
 */
export const dynamic = 'force-dynamic'

import { getCurrentWorkspace } from '@/lib/workspace'
import AuditLogViewer from './_components/AuditLogViewer'
import NotificationSettings from './_components/NotificationSettings'

export default async function SettingsPage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="space-y-8">
      {/* Existing settings content (Phase 28: roles, secrets management) */}
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-neutral-900">Settings</h1>
        <p className="text-sm text-neutral-500">
          Workspace settings, operator roles, and secrets management — coming in Phase 28.
        </p>
      </div>

      <hr className="border-neutral-200" />

      {/* NTF-01/02: notification channel config (Slack / Email) */}
      <NotificationSettings workspace_id={workspace_id} />

      <hr className="border-neutral-200" />

      {/* AUD-01: read-only audit log viewer */}
      <AuditLogViewer workspace_id={workspace_id} />
    </div>
  )
}
