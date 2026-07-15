'use client'
/**
 * Phase 41 Plan 41-12 (WSP-03 gap closure, Task 1) — Stage 2 (Draft) context
 * panel publisher.
 *
 * Publishes the open QA items list into the frame's single persistent
 * ContextPanel (Plan 41-11's slot) from data the provider ALREADY subscribes
 * to (`qaFindings` — zero new Convex subscriptions). Reuses the ONE shared
 * open-finding predicate (`isOpenFinding`, Pitfall 9) — do NOT re-derive
 * `accepted !== true` inline, it misses `resolution: 'dismissed'`.
 *
 * Honesty rule (never-blank): `undefined` (not loaded yet) renders a loading
 * line; zero open findings renders "No open QA items — this draft is
 * clean" — never the generic ContextPanel placeholder.
 */
import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { isOpenFinding } from '@/lib/galley/findingState'
import {
  useWorkspaceState,
  type WorkspaceStateValue,
} from '../../_components/WorkspaceStateProvider'

const MICRO_LABEL =
  'font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.09em]'

const SEVERITY_LABEL: Record<'info' | 'warning' | 'error', string> = {
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
}

const SEVERITY_CLASS: Record<'info' | 'warning' | 'error', string> = {
  info: 'text-[color:var(--color-ink-soft)]',
  warning: 'text-[color:var(--color-marigold-text,var(--color-ink))]',
  error: 'text-[color:var(--color-vermilion)]',
}

export function buildDraftPanelContent(
  qaFindings: WorkspaceStateValue['qaFindings'],
): ReactNode {
  if (qaFindings === undefined) {
    return <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">Loading…</p>
  }

  const openFindings = qaFindings.filter(isOpenFinding)

  if (openFindings.length === 0) {
    return (
      <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">
        No open QA items — this draft is clean
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {openFindings.map(row => (
        <li key={row._id} className="border border-[color:var(--color-faint)] bg-white p-2">
          <div className="flex items-center justify-between gap-2">
            <span className={`${MICRO_LABEL} text-[color:var(--color-ink-soft)]`}>
              {row.sectionName}
            </span>
            <span className={`${MICRO_LABEL} ${SEVERITY_CLASS[row.severity]}`}>
              {SEVERITY_LABEL[row.severity]}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-[color:var(--color-ink)]">
            {row.reason}
          </p>
        </li>
      ))}
    </ul>
  )
}

export default function DraftPanelPublisher() {
  const ws = useWorkspaceState()
  const content = useMemo(() => buildDraftPanelContent(ws.qaFindings), [ws.qaFindings])
  const { setPanelContent } = ws
  useEffect(() => {
    setPanelContent(content)
    return () => setPanelContent(null)
  }, [content, setPanelContent])
  return null
}
