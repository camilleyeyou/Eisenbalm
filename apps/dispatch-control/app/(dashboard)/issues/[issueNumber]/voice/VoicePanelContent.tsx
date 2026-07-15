'use client'
/**
 * Phase 41 Plan 41-12 (WSP-03 gap closure, Task 2) — Stage 4 (Voice) context
 * panel publisher.
 *
 * Publishes open voice findings into the frame's single persistent
 * ContextPanel (Plan 41-11's slot) from data the provider ALREADY subscribes
 * to (`qaFindings` — zero new Convex subscriptions). Uses the EXACT SAME
 * `isOpenFinding` + `VOICE_AXES` filter `VoicePassRunView` uses for its tell
 * count (VOX-01), so the panel's list never disagrees with the header count
 * or the lit spans.
 *
 * Honesty rule (never-blank): `undefined` (not loaded yet) renders a loading
 * line; zero voice tells renders "No voice tells flagged".
 */
import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { isOpenFinding } from '@/lib/galley/findingState'
import { VOICE_AXES } from '@/lib/galley/axisPartition'
import {
  useWorkspaceState,
  type WorkspaceStateValue,
} from '../../_components/WorkspaceStateProvider'

const MICRO_LABEL =
  'font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]'

export function buildVoicePanelContent(
  qaFindings: WorkspaceStateValue['qaFindings'],
): ReactNode {
  if (qaFindings === undefined) {
    return <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">Loading…</p>
  }

  const voiceFindings = qaFindings.filter(
    row => isOpenFinding(row) && VOICE_AXES.has(row.axis ?? ''),
  )

  if (voiceFindings.length === 0) {
    return (
      <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">
        No voice tells flagged
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {voiceFindings.map(row => (
        <li key={row._id} className="border border-[color:var(--color-faint)] bg-white p-2">
          <div className="flex items-center justify-between gap-2">
            <span className={MICRO_LABEL}>{row.sectionName}</span>
            <span className={MICRO_LABEL}>{row.axis}</span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-[color:var(--color-ink)]">
            {row.reason}
          </p>
        </li>
      ))}
    </ul>
  )
}

export default function VoicePanelPublisher() {
  const ws = useWorkspaceState()
  const content = useMemo(() => buildVoicePanelContent(ws.qaFindings), [ws.qaFindings])
  const { setPanelContent } = ws
  useEffect(() => {
    setPanelContent(content)
    return () => setPanelContent(null)
  }, [content, setPanelContent])
  return null
}
