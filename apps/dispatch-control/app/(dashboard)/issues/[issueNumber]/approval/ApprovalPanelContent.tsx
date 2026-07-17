'use client'
/**
 * Phase 41 Plan 41-12 (WSP-03 gap closure, Task 3) — Stage 5 (Approval)
 * context panel publisher.
 *
 * Publishes a compact, READ-ONLY duplication of the Stage 5 rail's readiness
 * board (fact/voice sign-off state, claim coverage, blocker count, held)
 * into the frame's single persistent ContextPanel (Plan 41-11's slot) from
 * data the provider ALREADY subscribes to (`signOffs`, `claimRows`, `tasks`,
 * `held` — zero new Convex subscriptions). This intentionally duplicates
 * (never imports) that rail's readiness summary — the gap explicitly
 * permits extract-or-duplicate the read-only summary, and the full rail
 * component is the write-capable Stage 5 canvas itself, not something this
 * panel should reference.
 *
 * Honesty rule (never-blank): `signOffs === undefined` (not loaded yet)
 * renders a loading line; otherwise every readiness row ALWAYS renders
 * (never a blank line, never color alone) — a genuinely empty state
 * (nothing signed, no claims, no must-fix tasks) still shows explicit
 * "not signed" / "no claims yet" / "none" text, never the generic
 * ContextPanel placeholder.
 *
 * Phase 43 Plan 43-06 (TSK-06, D-08) — below the (unchanged) readiness
 * board, this panel also mounts the shared `DecisionLog` component scoped
 * to the current run ("the Approval context panel shows it" —
 * `Dispatch Control v3 - Annotations.md` §Decision & audit). `DecisionLog`
 * is appended ONLY inside `ApprovalPanelPublisher` — never inside
 * `buildApprovalPanelContent` itself, which stays a pure, Convex-free
 * builder so its existing direct-call tests (`StageContextPanels.test.tsx`)
 * keep rendering plain fixture data with no ConvexProvider needed.
 */
import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import DecisionLog from '@/components/decision-log/DecisionLog'
import {
  useWorkspaceState,
  type WorkspaceStateValue,
} from '../../_components/WorkspaceStateProvider'

interface ApprovalPanelInputs {
  signOffs: WorkspaceStateValue['signOffs']
  claimRows: WorkspaceStateValue['claimRows']
  tasks: WorkspaceStateValue['tasks']
  held: WorkspaceStateValue['held']
}

export function buildApprovalPanelContent({
  signOffs,
  claimRows,
  tasks,
  held,
}: ApprovalPanelInputs): ReactNode {
  if (signOffs === undefined) {
    return (
      <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">
        Loading readiness…
      </p>
    )
  }

  const rows = claimRows ?? []
  const done = rows.filter(row => row.status !== 'pending')
  const totalClaims = rows.length
  const mustFixCount = tasks.filter(t => t.sev === 'must-fix').length

  const factsSigned = signOffs['facts-cleared'] !== undefined
  const voiceSigned = signOffs['sounds-human'] !== undefined

  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[13px] text-[color:var(--color-ink)]">
      <dt className="text-[color:var(--color-ink-soft)]">Fact check</dt>
      <dd>
        {factsSigned
          ? 'signed'
          : totalClaims === 0
            ? 'no claims yet'
            : `checked ${done.length} of ${totalClaims}`}
      </dd>
      <dt className="text-[color:var(--color-ink-soft)]">Voice</dt>
      <dd>{voiceSigned ? 'signed' : 'not signed'}</dd>
      <dt className="text-[color:var(--color-ink-soft)]">Held</dt>
      <dd>{held ? 'Held — release to publish' : 'not held'}</dd>
      <dt className="text-[color:var(--color-ink-soft)]">Must fix items</dt>
      <dd>{mustFixCount > 0 ? `${mustFixCount} must-fix` : 'none'}</dd>
    </dl>
  )
}

export default function ApprovalPanelPublisher() {
  const ws = useWorkspaceState()
  const readiness = useMemo(
    () =>
      buildApprovalPanelContent({
        signOffs: ws.signOffs,
        claimRows: ws.claimRows,
        tasks: ws.tasks,
        held: ws.held,
      }),
    [ws.signOffs, ws.claimRows, ws.tasks, ws.held],
  )
  // Decision log — appended here (not inside buildApprovalPanelContent) so
  // the pure builder + its existing tests stay Convex-free; DecisionLog is
  // its own client component with its own useQuery subscription.
  const content = useMemo(
    () => (
      <div className="flex flex-col gap-4">
        {readiness}
        <div className="border-t border-[color:var(--color-ink)]/[.08] pt-4">
          <h3 className="mb-2 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-ink-soft)]">
            Decision log
          </h3>
          <DecisionLog
            runId={ws.runId ?? undefined}
            issueNumber={ws.issueNumber ?? undefined}
          />
        </div>
      </div>
    ),
    [readiness, ws.runId, ws.issueNumber],
  )
  const { setPanelContent } = ws
  useEffect(() => {
    setPanelContent(content)
    return () => setPanelContent(null)
  }, [content, setPanelContent])
  return null
}
