/**
 * Phase 51 (D-01) — the (editorial) route group shell. A SIBLING of
 * app/(dashboard)/, not a child. No persistent left-nav rail, no top-bar
 * chrome, no nav of any kind — "a page to read, not a workspace to
 * navigate" (DOOR-03). Phases 52 (`/`) and 54 (`/archive`) drop in as
 * siblings sharing this shell. app/(dashboard)/ and every route inside it
 * stays byte-unchanged.
 *
 * Provider stack (Pitfall 3, 51-RESEARCH): `useInspector()` THROWS outside
 * an <InspectorProvider>, and the (dashboard) instance is not an ancestor
 * of this group. A second, independent instance is mounted here so D-22's
 * "Inspect how this was made" works on /s/[section]. Inspector state
 * deliberately does not persist across a navigation between the two
 * groups — they are separate, unrelated surfaces (D-24).
 *
 * ORDERING IS LOAD-BEARING (fast 260723, replicated from
 * (dashboard)/layout.tsx): ConfirmProvider and CommandPaletteProvider must
 * sit OUTSIDE InspectorProvider — InspectorProvider renders the inspector
 * panel, which calls useConfirm.
 *
 * The first-run guided tour is a (dashboard) console concern only and is
 * deliberately not mounted here.
 */
import type { ReactNode } from 'react'
import { InspectorProvider } from '@/components/inspector/InspectorProvider'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { CommandPaletteProvider } from '@/components/CommandPalette'

export default function EditorialLayout({ children }: { children: ReactNode }) {
  return (
    <ConfirmProvider>
      <CommandPaletteProvider>
        <InspectorProvider>
          <div className="min-h-screen bg-[color:var(--background)]">{children}</div>
        </InspectorProvider>
      </CommandPaletteProvider>
    </ConfirmProvider>
  )
}
