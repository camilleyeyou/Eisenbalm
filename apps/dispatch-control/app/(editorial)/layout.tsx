/**
 * Phase 51 (D-01) — the (editorial) route group shell, a SIBLING of
 * app/(dashboard)/. Phase 56: shared EditorShell (three-link nav). The
 * command palette is retired (it displayed run ids).
 *
 * Provider stack (Pitfall 3, 51-RESEARCH): `useInspector()` THROWS outside an
 * <InspectorProvider>, so an independent instance is mounted here. Kept until
 * the old section page stops calling useInspector (plan 56-12 removes it if
 * unused).
 *
 * ORDERING IS LOAD-BEARING (fast 260723): ConfirmProvider must sit OUTSIDE
 * InspectorProvider — the inspector panel calls useConfirm.
 */
import type { ReactNode } from 'react'
import { InspectorProvider } from '@/components/inspector/InspectorProvider'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import EditorShell from '@/components/editor/EditorShell'

export default function EditorialLayout({ children }: { children: ReactNode }) {
  return (
    <ConfirmProvider>
      <InspectorProvider>
        <EditorShell>{children}</EditorShell>
      </InspectorProvider>
    </ConfirmProvider>
  )
}
