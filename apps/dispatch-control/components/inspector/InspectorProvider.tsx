'use client'
/**
 * Phase 44 Plan 44-06 (INS-01, D-06, docs/API_CONTRACTS.md §44.6) — the
 * single inspector context/provider.
 *
 * Exposes `openInspector`/`closeInspector` via `useInspector()`. Mounted
 * exactly ONCE, at the `(dashboard)` root layout (Task 3), so every route
 * under `(dashboard)` — all five issue-workspace stages AND `/my-tasks`,
 * which is NOT under the issue-workspace frame (§44.6) — shares the same
 * opener and the same single panel instance. There is exactly ONE
 * `activeKey` in this context, so there can only ever be one mounted
 * `<InspectorContainer>`/panel, regardless of how many components call
 * `openInspector`.
 *
 * `openInspector` accepts either the string-encoded form (parsed via
 * `parseArtifactKey`, §44.1 — the form carried on `DerivedTask.insp`,
 * §43.5a) or the structured `InspectorArtifactKey` directly. A malformed
 * string (parse failure) is a no-op — never a crash, never a guessed key.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { parseArtifactKey, type InspectorArtifactKey } from '@/lib/inspectorArtifact'
import { InspectorContainer } from './InspectorContainer'

export interface InspectorContextValue {
  activeKey: InspectorArtifactKey | null
  openInspector: (key: string | InspectorArtifactKey) => void
  closeInspector: () => void
}

const InspectorContext = createContext<InspectorContextValue | null>(null)

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [activeKey, setActiveKey] = useState<InspectorArtifactKey | null>(null)

  const openInspector = useCallback((key: string | InspectorArtifactKey) => {
    if (typeof key === 'string') {
      const parsed = parseArtifactKey(key)
      // Malformed string — never crash, never guess. No-ops, leaving
      // whatever panel state was already active untouched.
      if (parsed !== null) setActiveKey(parsed)
      return
    }
    setActiveKey(key)
  }, [])

  const closeInspector = useCallback(() => setActiveKey(null), [])

  const value = useMemo<InspectorContextValue>(
    () => ({ activeKey, openInspector, closeInspector }),
    [activeKey, openInspector, closeInspector],
  )

  return (
    <InspectorContext.Provider value={value}>
      {children}
      {/* Exactly ONE container/panel instance — gated on the single
          `activeKey` held in this context, never per-caller. Every one of
          the six entry points calls the same `openInspector`; this is the
          only place a panel is ever rendered. */}
      {activeKey !== null && <InspectorContainer artifactKey={activeKey} onClose={closeInspector} />}
    </InspectorContext.Provider>
  )
}

/** Throws if used outside a `<InspectorProvider>` — no silent undefined reads. */
export function useInspector(): InspectorContextValue {
  const ctx = useContext(InspectorContext)
  if (ctx === null) {
    throw new Error('useInspector must be used within an InspectorProvider')
  }
  return ctx
}
