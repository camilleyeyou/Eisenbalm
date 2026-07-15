'use client'
/**
 * Phase 41 Plan 41-12 (WSP-03 gap closure, Task 2) — Stage 3 (Fact Check)
 * context panel publisher.
 *
 * Publishes claim detail into the frame's single persistent ContextPanel
 * (Plan 41-11's slot) from data the provider ALREADY subscribes to
 * (`claimRows` — zero new Convex subscriptions). Mirrors
 * `FactCheckPlaceholder.tsx`'s never-blank coverage ladder and status
 * vocabulary (Pending/Checked/Skipped) — read-only, no Check/Skip write
 * actions belong here.
 *
 * Honesty rule (never-blank): `undefined` (not loaded yet) renders a loading
 * line; zero claims renders "No claims extracted yet" — the empty case never
 * asserts a fake done/checked-off state the data doesn't back.
 */
import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  useWorkspaceState,
  type WorkspaceStateValue,
} from '../../_components/WorkspaceStateProvider'

const MICRO_LABEL =
  'font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]'

function statusLabel(status: string): string {
  if (status === 'checked') return 'Checked'
  if (status === 'skipped') return 'Skipped'
  return 'Pending'
}

export function buildFactCheckPanelContent(
  claimRows: WorkspaceStateValue['claimRows'],
): ReactNode {
  if (claimRows === undefined) {
    return <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">Loading…</p>
  }

  if (claimRows.length === 0) {
    return (
      <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">
        No claims extracted yet
      </p>
    )
  }

  const done = claimRows.filter(row => row.status !== 'pending')
  const openCount = claimRows.length - done.length

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-[color:var(--color-ink)]">
        checked {done.length} of {claimRows.length}
        <span className="text-[color:var(--color-ink-soft)]"> · {openCount} unchecked</span>
      </p>
      <ul className="flex flex-col gap-1.5">
        {claimRows.map(row => (
          <li key={row._id} className="border border-[color:var(--color-faint)] bg-white p-2">
            <p className="text-[13px] leading-snug text-[color:var(--color-ink)]">
              {row.claimText ?? '(no claim text)'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={MICRO_LABEL}>{statusLabel(row.status)}</span>
              {row.sourceUrl && (
                <a
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] font-medium text-[color:var(--color-marigold-text)] underline"
                >
                  Open source
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function FactCheckPanelPublisher() {
  const ws = useWorkspaceState()
  const content = useMemo(() => buildFactCheckPanelContent(ws.claimRows), [ws.claimRows])
  const { setPanelContent } = ws
  useEffect(() => {
    setPanelContent(content)
    return () => setPanelContent(null)
  }, [content, setPanelContent])
  return null
}
