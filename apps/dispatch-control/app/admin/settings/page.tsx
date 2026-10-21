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

import type { Metadata } from 'next'
import { getCurrentWorkspace } from '@/lib/workspace'
import AuditLogViewer from './_components/AuditLogViewer'
import NotificationSettings from './_components/NotificationSettings'

// quick 260723-4a6 (Task 1e): Server Component route — static title.
export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="space-y-8">
      {/* Existing settings content (Phase 28: roles, secrets management) */}
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-[color:var(--color-ink)]">Settings</h1>
        <p className="text-sm text-[color:var(--color-faint)]">
          Workspace settings, operator roles, and secrets management — coming in Phase 28.
        </p>
      </div>

      <hr className="border-[color:var(--color-ink)]/15" />

      {/* NTF-01/02: notification channel config (Slack / Email) */}
      <NotificationSettings workspace_id={workspace_id} />

      <hr className="border-[color:var(--color-ink)]/15" />

      {/* AUD-01: read-only audit log viewer */}
      <AuditLogViewer workspace_id={workspace_id} />
    </div>
  )
}
