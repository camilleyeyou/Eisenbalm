/**
 * Dashboard route-group shell layout.
 * Renders: <Masthead /> (persistent 52px ink chrome, CHR-02) above a row of
 * <AppSidebar /> (persistent left nav) + <main> (content area). All routes
 * under (dashboard)/ are automatically wrapped in this shell. Clerk
 * middleware (middleware.ts) ensures every route here requires auth.
 *
 * Plan 30-04: column shell (masthead on top, sidebar+main row below) so the
 * masthead spans full width above the sidebar+content row.
 *
 * Phase 26 (RVW-04): AutoPublishBanner injected at the top of <main> so it
 * appears on every dashboard page when auto_publish is enabled.
 *
 * Phase 44 Plan 44-06 (INS-01, D-06, docs/API_CONTRACTS.md §44.6): the
 * shell is wrapped in the single <InspectorProvider> instance here — the
 * ONE place it is ever mounted app-wide — so every route under
 * (dashboard)/, including /my-tasks (which is NOT under the Issue
 * Workspace frame), shares the same openInspector/closeInspector opener and
 * the same single panel. Do NOT add a second <InspectorProvider> anywhere
 * else. This layout stays a Server Component; wrapping its children in the
 * 'use client' InspectorProvider is fine — the children remain
 * server-rendered.
 */
import AppSidebar from '@/components/AppSidebar'
import Masthead from '@/components/Masthead'
import AutoPublishBanner from './_components/AutoPublishBanner'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { InspectorProvider } from '@/components/inspector/InspectorProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <InspectorProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-[color:var(--color-rail)]">
        <Masthead />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-y-auto p-6">
            {/* Persistent red banner when auto_publish is enabled — RVW-04 */}
            <div className="mb-4 empty:mb-0">
              <AutoPublishBanner workspace_id={DEFAULT_WORKSPACE_ID} />
            </div>
            {children}
          </main>
        </div>
      </div>
    </InspectorProvider>
  )
}
