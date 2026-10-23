/**
 * Phase 51 (D-01) — the (editorial) route group shell, a SIBLING of
 * app/(dashboard)/. Phase 56: shared EditorShell (three-link nav). The
 * command palette is retired (it displayed run ids).
 *
 */
import type { ReactNode } from 'react'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import EditorShell from '@/components/editor/EditorShell'

export default function EditorialLayout({ children }: { children: ReactNode }) {
  return (
    <ConfirmProvider>
      <EditorShell>{children}</EditorShell>
    </ConfirmProvider>
  )
}
