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
 * ONE place it is mounted for the (dashboard) route group — so every route
 * under (dashboard)/, including /my-tasks (which is NOT under the Issue
 * Workspace frame), shares the same openInspector/closeInspector opener and
 * the same single panel. Do NOT add a second <InspectorProvider> anywhere
 * else within this route group; the sibling (editorial) group mounts its
 * own independent instance in app/(editorial)/layout.tsx (Phase 51, D-01).
 * This layout stays a Server Component; wrapping its children in the
 * 'use client' InspectorProvider is fine — the children remain
 * server-rendered.
 *
 * Quick 260721-qdx: `<OnboardingProvider>` is mounted here too, INSIDE
 * `<InspectorProvider>` — the ONE place it is ever mounted, so every
 * dashboard route shares the same onboarding state + tour opener. It is a
 * sibling of, and independent from, the Issue Workspace's
 * `WorkspaceStateProvider` (mounted separately, only under
 * `/issues/[issueNumber]`). `<OnboardingTour>` renders once here, alongside
 * the rest of the shell, so it can overlay any dashboard route.
 *
 * quick 260723-4a6 (Task 2): `<ConfirmProvider>` and `<CommandPaletteProvider>`
 * are mounted here too, siblings INSIDE `<OnboardingProvider>`, wrapping the
 * shell `<div>` — so both the Masthead (⌘K chip) and every route child (the
 * confirm sites) share the same single dialog/palette instance. This layout
 * stays a Server Component; both are 'use client' providers rendering
 * server-rendered children, same pattern as every other provider here.
 *
 * quick 260722-v01: mounts `<MobileNavDrawer />` (client) as the FIRST child,
 * before `<Masthead />` — the below-md hamburger + off-canvas nav (audit item
 * 1). This layout stays a Server Component; it may render this client child.
 * Also: `<main>` drops to `p-4 md:p-6` (audit item — mobile padding) and
 * becomes a `flex flex-col` column (with the banner wrapper `shrink-0`) so
 * flex-column descendants (e.g. the run-monitor shell) size to the space
 * remaining under the AutoPublishBanner instead of overflowing by its height
 * (audit item 4).
 */
import AppSidebar from '@/components/AppSidebar'
import Masthead from '@/components/Masthead'
import MobileNavDrawer from '@/components/MobileNavDrawer'
import AutoPublishBanner from './_components/AutoPublishBanner'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { InspectorProvider } from '@/components/inspector/InspectorProvider'
import { OnboardingProvider } from '@/components/onboarding/OnboardingProvider'
import OnboardingTour from '@/components/onboarding/OnboardingTour'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { CommandPaletteProvider } from '@/components/CommandPalette'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // fast 260723 (prod console fix): ConfirmProvider + CommandPaletteProvider
    // must sit OUTSIDE InspectorProvider — InspectorProvider renders the
    // inspector panel itself, and the panel's footer calls useConfirm();
    // with the old inside-ordering, opening the inspector crashed with
    // "useConfirm must be used within a ConfirmProvider" (tests wrapped
    // providers explicitly, masking the hierarchy).
    <ConfirmProvider>
      <CommandPaletteProvider>
        <InspectorProvider>
          <OnboardingProvider>
            <div className="flex h-screen flex-col overflow-hidden bg-[color:var(--color-rail)]">
              <MobileNavDrawer />
              <Masthead />
              <div className="flex flex-1 overflow-hidden">
                <AppSidebar />
                <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
                  {/* Persistent red banner when auto_publish is enabled — RVW-04 */}
                  <div className="mb-4 shrink-0 empty:mb-0">
                    <AutoPublishBanner workspace_id={DEFAULT_WORKSPACE_ID} />
                  </div>
                  {children}
                </main>
              </div>
            </div>
            <OnboardingTour />
          </OnboardingProvider>
        </InspectorProvider>
      </CommandPaletteProvider>
    </ConfirmProvider>
  )
}
