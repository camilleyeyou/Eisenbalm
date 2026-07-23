'use client'
/**
 * Phase 47 Plan 47-08 (BRF-01..06, D-01/D-14/D-15) — StoryBriefScreen: the
 * full Stage-1 composition shell, replacing the provisional `SignalDeskScreen`
 * mount at `issues/[issueNumber]/story` (its 131-line placeholder sibling
 * file was DELETED by this plan, not extended).
 *
 * Composition order (Annotations §Stage 1, L48-55): Leads (BRF-01/BRF-02,
 * `LeadCard`+`LeadActions`) -> Organization options grouped under the chosen
 * lead (BRF-03, `OrgOptionSlate`) -> Needs-your-decision (BRF-04,
 * `NeedsYourDecisionCard`, mounted ONLY while paused at Gate 1) -> the
 * editable Brief field table with per-field strengthen (BRF-05/BRF-06,
 * `BriefFieldTable` + `BriefFieldStrengthen`).
 *
 * Mount contract (D-01): takes a `runId` prop like `SignalDeskScreen` — the
 * issue-keyed `story/page.tsx` wrapper resolves the most-recent run
 * server-side (`api.pipelineRuns.byIssueNumber`) and passes it down so first
 * paint is never wrong. Client-side, `useWorkspaceState().runId` (the SAME
 * source, subscribed live) takes over once it resolves — this is what lets
 * "Restart discovery" (the Error state's recovery action, which creates a
 * NEW `pipelineRuns` row for this issue) surface without a page reload: the
 * provider's `pipelineRuns.byIssueNumber` subscription picks up the new run
 * automatically and `effectiveRunId` follows it.
 *
 * States (D-14):
 *   - Empty (no run at all yet): the CreatePanel Create path (`issues/
 *     _components/CreatePanel.tsx`, reused verbatim — its second "Start from
 *     my brief" slot is intentionally absent until Phase 48).
 *   - Loading (`run.status === 'running'` and no leads have landed yet):
 *     "Finding leads… (~40s)". The SAME copy also appears (non-blocking)
 *     above an already-streaming lead list while more leads may still land.
 *   - Error (`run.status === 'failed'`): the run's plain-language
 *     `errorMessage` + "Restart discovery" (re-triggers a run for this
 *     issue) + a Run Details link (`issueRunHref`).
 *   - After choose (D-15): once Gate 1 resolves, `isPausedAtGate1` goes
 *     false, `NeedsYourDecisionCard` unmounts, and (once `editor_gate_1`
 *     generates one) the Brief table appears — Draft's StageStrip status is
 *     driven by the EXISTING `deriveStageStates`/`WorkspaceOutline` wiring,
 *     nothing bespoke here.
 *
 * `isPausedAtGate1` mirrors `SignalDeskScreen`'s own predicate exactly
 * (`status === 'awaiting-review' && completedAt == null`, API_CONTRACTS
 * §37.4(c)) — the SAME condition `deriveStoryStage` (lib/derivedState.ts,
 * tightened this plan) now gates its 'needs-you' StageStrip state on, so the
 * tab badge and this card's visibility can never disagree.
 *
 * quick 260722-tv1: the empty/loading/main state roots dropped their outer
 * `p-6` — this stage canvas mounts inside the workspace frame, which already
 * pads it, so the sibling stage canvases carry none. The Error branch's root
 * is itself a bordered card (`border ... p-6`), not extra frame padding, so
 * its `p-6` is genuine internal card padding and stays.
 *
 * quick 260722-v01 (audit item 6): `LeadActions` and `BriefFieldStrengthen`
 * no longer mount their own `<DecisionLog>` (was up to ~11 duplicate
 * run-scoped logs on this page, one per lead/brief field). This screen now
 * mounts exactly ONE consolidated `<DecisionLog runId={effectiveRunId} />`
 * at the bottom of the main return, under a "Decision log" heading —
 * `effectiveRunId` is non-null in that code path (the Empty-state branch
 * above returns early on `effectiveRunId === null`).
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@convex/_generated/api'
import { useWorkspaceState } from '@/app/(dashboard)/issues/_components/WorkspaceStateProvider'
import CreatePanel from '@/app/(dashboard)/issues/_components/CreatePanel'
import { triggerRun } from '@/lib/pipelineControlClient'
import { issueRunHref } from '@/lib/issueRouteResolver'
import type { BriefField } from '@/lib/briefClient'
import { LeadCard, type StoryLead } from './LeadCard'
import { LeadActions } from './LeadActions'
import { OrgOptionSlate } from './OrgOptionSlate'
import { BriefOrgCard } from './BriefOrgCard'
import { NeedsYourDecisionCard, type VerificationRecordRow } from './NeedsYourDecisionCard'
import { BriefFieldTable } from './BriefFieldTable'
import { BriefFieldStrengthen } from './BriefFieldStrengthen'
import DecisionLog from '@/components/decision-log/DecisionLog'
import { SkeletonLine } from '@/components/ui/Skeleton'
import {
  type PitchLogRow,
  type AdvocateArgumentRow,
} from '../../signal-desk/_components/CandidateSlate'

export interface StoryBriefScreenProps {
  issueNumber: number
  /** Server-resolved most-recent run for this issue (`null` = none yet). */
  runId: string | null
}

interface PipelineRunRow {
  status: string
  completedAt?: number
  errorMessage?: string
}

const BRIEF_FIELDS: { field: BriefField; label: string }[] = [
  { field: 'premise', label: 'Premise' },
  { field: 'currentPeg', label: 'Current peg' },
  { field: 'centralClaim', label: 'Central claim' },
  { field: 'readerEffect', label: 'Reader effect' },
  { field: 'knownRisks', label: 'Known risks' },
  { field: 'voiceIntention', label: 'Voice intention' },
]

const MICRO_LABEL =
  'font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]'

export function StoryBriefScreen({ issueNumber, runId }: StoryBriefScreenProps) {
  const { getToken } = useAuth()
  const router = useRouter()
  const ws = useWorkspaceState()

  // ws.runId is `null` both while its own query is loading AND once it has
  // genuinely resolved to "no run" — the server-resolved `runId` prop
  // disambiguates the former on first paint; once ws.runId resolves it takes
  // over (so a Restart-discovery-created run is picked up live, no reload).
  const effectiveRunId = ws.runId ?? runId

  const run = useQuery(
    api.pipelineRuns.byRunId,
    effectiveRunId ? { runId: effectiveRunId } : 'skip',
  ) as PipelineRunRow | null | undefined

  const advocateRows = useQuery(
    api.deliberationEvents.byRunIdAndType,
    effectiveRunId ? { runId: effectiveRunId, eventType: 'advocate-argument' } : 'skip',
  ) as AdvocateArgumentRow[] | undefined

  const [restarting, setRestarting] = useState(false)
  const [restartError, setRestartError] = useState<string | null>(null)

  async function handleRestart() {
    if (restarting) return
    setRestarting(true)
    setRestartError(null)
    try {
      const token = await getToken()
      await triggerRun({ issueNumber }, token)
      router.refresh()
    } catch (e) {
      setRestartError(e instanceof Error ? e.message : 'Restart failed.')
    } finally {
      setRestarting(false)
    }
  }

  // ── Empty (D-14): no run exists yet for this issue. ──────────────────────
  if (effectiveRunId === null) {
    return (
      <div className="flex flex-col gap-4" data-testid="story-brief-empty">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[color:var(--color-ink)]">
            Story &amp; Brief
          </h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-ink-soft)]">
            No run yet for this issue — start one to find leads.
          </p>
        </div>
        <CreatePanel nextIssueNumber={issueNumber} />
      </div>
    )
  }

  // ── Error (D-14): the run failed before/during discovery. ────────────────
  if (run?.status === 'failed') {
    return (
      <div
        className="flex flex-col gap-3 border border-[color:var(--color-vermilion)] bg-[color:var(--color-card)] p-6"
        data-testid="story-brief-error"
      >
        <h2 className={MICRO_LABEL}>Discovery failed</h2>
        <p className="text-[13px] leading-relaxed text-[color:var(--color-ink)]">
          {run.errorMessage || 'The pipeline run failed before it could find leads.'}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={restarting}
            onClick={handleRestart}
            className="min-h-[44px] bg-[color:var(--color-ink)] px-4 py-2 font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-masthead-text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {restarting ? 'Restarting…' : 'Restart discovery'}
          </button>
          <Link
            href={issueRunHref(issueNumber, effectiveRunId)}
            className="min-h-[44px] flex items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)]"
          >
            Run Details
          </Link>
        </div>
        {restartError && (
          <p role="alert" className="text-[12px] text-[color:var(--color-vermilion)]">
            {restartError}
          </p>
        )}
      </div>
    )
  }

  const rawStoryLeads = ws.storyLeads
  const hasLeads = (rawStoryLeads?.length ?? 0) > 0
  const isDiscovering =
    !hasLeads && (run === undefined || run?.status === 'running' || rawStoryLeads === undefined)

  // ── Loading (D-14): discovery in progress, no leads have landed yet. ─────
  if (isDiscovering) {
    return (
      <div className="flex flex-col gap-3" data-testid="story-brief-loading">
        <p className="text-[13px] text-[color:var(--color-ink-soft)]">Finding leads… (~40s)</p>
      </div>
    )
  }

  // Mirrors SignalDeskScreen's isPausedAtGate1 EXACTLY (API_CONTRACTS §37.4(c)).
  const isPausedAtGate1 = run?.status === 'awaiting-review' && run?.completedAt == null
  const stillDiscoveringMore = hasLeads && run?.status === 'running'

  // Phase 48 Plan 48-06 (ENT-01/ENT-03, RESEARCH Pattern 4) — a brief-started
  // run never populates story_leads/pitchLog (Signal Editor + Scout are
  // skipped, D-01/D-02). isPausedAtGate1 is already correctly always-false
  // for brief runs (editor_gate_1 is skipped too), so NeedsYourDecisionCard
  // needs no change here.
  const isBrief = ws.entryMode === 'brief'

  const storyLeadsTyped = (rawStoryLeads ?? []) as unknown as StoryLead[]
  const pitchRowsForNeeds = (ws.pitchRows ?? []) as PitchLogRow[]
  const verificationRecordsForNeeds = (ws.verificationRecords ?? []) as unknown as
    | VerificationRecordRow[]
    | undefined
  const brief = ws.brief

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[color:var(--color-ink)]">
          Story &amp; Brief
        </h1>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-ink-soft)]">
          Leads, the organization options they surface, the paused-for-you decision, and the
          Brief the writers draft from.
        </p>
      </div>

      <section aria-label="Story leads" className="flex flex-col gap-3">
        <h2 className={MICRO_LABEL}>Leads</h2>
        {stillDiscoveringMore && (
          <p className="text-[12px] italic text-[color:var(--color-ink-soft)]">
            Finding leads… (~40s)
          </p>
        )}
        {rawStoryLeads === undefined ? (
          <div className="flex flex-col gap-2">
            <SkeletonLine className="h-4 w-full" />
            <SkeletonLine className="h-4 w-2/3" />
          </div>
        ) : storyLeadsTyped.length === 0 ? (
          isBrief ? (
            <p
              data-testid="story-brief-mode-no-leads"
              className="text-[13px] italic text-[color:var(--color-ink-soft)]"
            >
              Started from a hand-authored brief — no story leads.
            </p>
          ) : (
            <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">No leads yet.</p>
          )
        ) : (
          <ul className="flex flex-col gap-4" data-testid="story-leads-list">
            {storyLeadsTyped.map(lead => (
              <li key={lead._id} className="flex flex-col">
                <LeadCard lead={lead} />
                <LeadActions runId={effectiveRunId} leadId={lead._id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {isBrief ? <BriefOrgCard /> : <OrgOptionSlate />}

      {isPausedAtGate1 && (
        <NeedsYourDecisionCard
          runId={effectiveRunId}
          pitchRows={pitchRowsForNeeds}
          advocateRows={advocateRows ?? []}
          verificationRecords={verificationRecordsForNeeds}
        />
      )}

      <section
        aria-label="Brief"
        className="flex flex-col gap-4 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4"
      >
        <h2 className={MICRO_LABEL}>Brief</h2>
        <BriefFieldTable runId={effectiveRunId} brief={brief} />
        {brief && (
          <div className="flex flex-col gap-4 border-t border-[color:var(--color-faint)] pt-4">
            {BRIEF_FIELDS.map(({ field, label }) => (
              <div key={field} className="flex flex-col gap-1.5">
                <span className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
                  Strengthen: {label}
                </span>
                <BriefFieldStrengthen runId={effectiveRunId} field={field} currentValue={brief[field]} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Decision log" className="flex flex-col gap-3">
        <h2 className={MICRO_LABEL}>Decision log</h2>
        <DecisionLog runId={effectiveRunId} />
      </section>
    </div>
  )
}
