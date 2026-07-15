'use client'
/**
 * Phase 41 Plan 41-12 (WSP-03 gap closure, Task 1) — Stage 1 (Story) context
 * panel publisher.
 *
 * Publishes lead/org detail into the frame's single persistent ContextPanel
 * (Plan 41-11's slot) from data the provider ALREADY subscribes to
 * (`pitchRows` — zero new Convex subscriptions, per 41-CONTEXT D-19 + the
 * gap-closure "no new subscriptions" rule). `buildStoryPanelContent` is a
 * pure function (unit-tested in `__tests__/StageContextPanels.test.tsx`);
 * `StoryPanelPublisher` is the thin effect wrapper that feeds the slot and
 * cleans up to `null` on unmount so a tab switch never leaves stale content.
 *
 * Honesty rule (never-blank): `undefined` (not loaded yet) renders a loading
 * line; `[]` (loaded, no candidates) renders "No charity selected yet" — the
 * generic ContextPanel placeholder is never faked into looking populated.
 */
import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Doc } from '@convex/_generated/dataModel'
import { useWorkspaceState } from '../../_components/WorkspaceStateProvider'

const MICRO_LABEL =
  'font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]'

export function buildStoryPanelContent(
  pitchRows: Doc<'pitchLog'>[] | undefined,
): ReactNode {
  if (pitchRows === undefined) {
    return (
      <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">
        Loading lead detail…
      </p>
    )
  }

  if (pitchRows.length === 0) {
    return (
      <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">
        No charity selected yet
      </p>
    )
  }

  const winner = pitchRows.find(row => row.selected === true)
  const others = pitchRows.filter(row => row._id !== winner?._id)

  return (
    <div className="flex flex-col gap-3">
      {winner ? (
        <div className="border border-[color:var(--color-faint)] bg-white p-2">
          <p className="font-[family-name:var(--font-display,inherit)] text-[15px] font-semibold text-[color:var(--color-ink)]">
            {winner.charityName}
          </p>
          <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-soft)]">
            {winner.charityLocation}
            {winner.focusArea ? ` · ${winner.focusArea}` : ''}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-[color:var(--color-ink)]">
            {winner.scoutSummary}
          </p>
        </div>
      ) : (
        <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">
          No winner selected yet
        </p>
      )}
      {others.length > 0 && (
        <div>
          <h3 className={MICRO_LABEL}>Candidates</h3>
          <ul className="mt-1 flex flex-col gap-1">
            {others.map(row => (
              <li key={row._id} className="text-[13px] text-[color:var(--color-ink-soft)]">
                {row.charityName}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function StoryPanelPublisher() {
  const ws = useWorkspaceState()
  const content = useMemo(() => buildStoryPanelContent(ws.pitchRows), [ws.pitchRows])
  const { setPanelContent } = ws
  useEffect(() => {
    setPanelContent(content)
    return () => setPanelContent(null)
  }, [content, setPanelContent])
  return null
}
