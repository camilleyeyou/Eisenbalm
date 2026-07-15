'use client'
/**
 * Phase 41 Plan 41-05 (WSP-03, D-19) — ContextPanel.
 *
 * A SHARED collapsible shell — no shared disclosure primitive exists in this
 * app (41-CONTEXT.md D-19), so it is built once here. Per-stage content is
 * injected by the caller (Stage 1 lead/org detail, Stage 2 open QA items,
 * Stage 3 claim detail, Stage 4 voice findings, Stage 5 decision log /
 * readiness detail — Plan 41-06/41-09 mount those into `children`); this
 * component owns only the collapse/hide chrome and its persistence.
 *
 * A persistent "Hide panel" / "Show panel" toggle: when hidden, only a slim
 * "Show panel" affordance renders — never a blank/absent region. Hidden
 * state persists across mounts via `localStorage` (D-19 Claude's-discretion
 * mechanism), guarded for SSR/no-window: the initial render (server AND the
 * client's first hydration pass) always assumes "shown" so server/client
 * markup matches; a post-hydration `useEffect` reads the persisted value and
 * flips to hidden if that's what was last saved.
 */
import { useEffect, useState } from 'react'

/** The sole persistence key for this shell — Claude's-discretion (D-19). */
export const CONTEXT_PANEL_HIDDEN_STORAGE_KEY = 'dc.workspace.contextPanel.hidden'

interface ContextPanelProps {
  title: string
  children: React.ReactNode
}

function readPersistedHidden(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(CONTEXT_PANEL_HIDDEN_STORAGE_KEY) === 'true'
  } catch {
    // Private-browsing / storage-disabled — degrade to "shown", never crash.
    return false
  }
}

function persistHidden(hidden: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONTEXT_PANEL_HIDDEN_STORAGE_KEY, String(hidden))
  } catch {
    // Storage unavailable — the toggle still works for this session, it just
    // won't survive a reload. Never crash the panel over this.
  }
}

export default function ContextPanel({ title, children }: ContextPanelProps) {
  // Starts "shown" on every render pass (server + first client hydration) so
  // markup never mismatches; the persisted value is applied client-only,
  // after mount.
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (readPersistedHidden()) setHidden(true)
  }, [])

  function toggleHidden() {
    setHidden(prev => {
      const next = !prev
      persistHidden(next)
      return next
    })
  }

  if (hidden) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleHidden}
          className="min-h-[44px] rounded-[2px] border border-[color:var(--color-ink)]/[.15] px-3 font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]"
        >
          Show panel
        </button>
      </div>
    )
  }

  const hasContent = children !== null && children !== undefined && children !== false

  return (
    <aside
      aria-label={title}
      className="flex flex-col gap-3 rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-ink-soft)]">
          {title}
        </h2>
        <button
          type="button"
          onClick={toggleHidden}
          className="min-h-[44px] font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]"
        >
          Hide panel
        </button>
      </div>
      {hasContent ? (
        children
      ) : (
        // _PlaceholderScreen-style copy (D-21 convention) — never a blank body.
        <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">
          Nothing to show for this stage yet
        </p>
      )}
    </aside>
  )
}
