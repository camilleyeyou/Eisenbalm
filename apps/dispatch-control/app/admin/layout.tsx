/**
 * The /admin ("Behind the scenes") shell. Phase 56: the shared EditorShell
 * (masthead + three-link nav) replaces the old slim top bar; no Admin link,
 * user menu or command palette.
 *
 * Provider order is load-bearing (fast 260723): ConfirmProvider must sit
 * OUTSIDE InspectorProvider — the inspector panel's footer calls useConfirm().
 * This layout stays a Server Component (EditorShell is the client boundary).
 */
import { InspectorProvider } from '@/components/inspector/InspectorProvider'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import EditorShell from '@/components/editor/EditorShell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <InspectorProvider>
        <EditorShell>{children}</EditorShell>
      </InspectorProvider>
    </ConfirmProvider>
  )
}
