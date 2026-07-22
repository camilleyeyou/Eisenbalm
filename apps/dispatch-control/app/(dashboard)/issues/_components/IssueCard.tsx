'use client'
/**
 * Phase 40 Plan 40-05 (§40-UI-SPEC, ISS-01/ISS-06) — the in-progress
 * `IssueCard`: the Issues-home focal point.
 *
 * PRESENTATIONAL — takes already-derived values as props (the page owns all
 * querying + `lib/derivedState.ts` derivation and passes the results in).
 *
 * ISS-06 is structural here, not a special case: `state.kind === 'error'`
 * OR `status === 'unknown'` renders ONLY the error body — no status label,
 * no stage clean/ready text can ever leak through. A stale value can never
 * survive because the branch that would render one is unreachable in that
 * condition.
 */
import { AlertTriangle, BadgeCheck, CheckCircle2, FileEdit, PauseCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { IssueStatus, StageState, StageStateResult } from '@/lib/derivedState'
import { issueHref } from '@/lib/issueRouteResolver'
import HelpTip from '@/components/ui/HelpTip'
import { HELP_COPY } from '@/components/help/helpCopy'
import StageStrip, { STAGE_STATE_LABELS } from './StageStrip'

interface IssueCardState {
  kind: 'loading' | 'error' | 'ok'
}

export interface IssueCardProps {
  issueNumber: number
  status: IssueStatus
  stages: StageStateResult[]
  openTaskCount: number
  claimCoverage: { checked: number; total: number }
  voiceState: StageState
  workMinutes: number
  runCostDisplay: string
  state?: IssueCardState
  onRefresh?: () => void
}

const STATUS_META: Record<
  Exclude<IssueStatus, 'unknown'>,
  { label: string; Icon: LucideIcon; color: string }
> = {
  draft: { label: 'Draft', Icon: FileEdit, color: 'var(--color-ink-soft)' },
  'needs-review': {
    label: 'Needs review',
    Icon: AlertTriangle,
    color: 'var(--color-marigold-text)',
  },
  ready: { label: 'Ready to publish', Icon: CheckCircle2, color: 'var(--color-green)' },
  published: { label: 'Published', Icon: BadgeCheck, color: 'var(--color-green)' },
  held: { label: 'Held', Icon: PauseCircle, color: 'var(--color-vermilion)' },
  // quick 260718-51o (FAILED-RUN-TERMINAL-STATE) — non-actionable: the card
  // body's only affordance stays the "Open issue" link to issueHref, never
  // Approval — a failed issue no longer advertises "Needs review".
  failed: { label: 'Run failed', Icon: AlertTriangle, color: 'var(--color-vermilion)' },
}

function Readout({
  label,
  value,
  mono,
  help,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  help?: string
}) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="flex items-center gap-1 font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
        {label}
        {help && <HelpTip text={help} label={`Explain ${label.toLowerCase()}`} />}
      </span>
      <span
        className={
          mono
            ? 'font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--color-ink)]'
            : 'font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)]'
        }
      >
        {value}
      </span>
    </div>
  )
}

export default function IssueCard({
  issueNumber,
  status,
  stages,
  openTaskCount,
  claimCoverage,
  voiceState,
  workMinutes,
  runCostDisplay,
  state,
  onRefresh,
}: IssueCardProps) {
  const kind = state?.kind ?? 'ok'

  // ISS-06 — structural: neither a prior status label nor stage clean/ready
  // text can ever render in this branch. A stale value is unreachable.
  if (kind === 'error' || status === 'unknown') {
    return (
      <div className="w-full rounded-[2px] border border-[color:var(--color-vermilion)]/40 bg-[color:var(--color-card)] p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle
            size={18}
            className="shrink-0 text-[color:var(--color-vermilion)]"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={onRefresh}
            className="min-h-[44px] font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-vermilion)] underline underline-offset-2"
          >
            State unknown — refresh
          </button>
        </div>
      </div>
    )
  }

  if (kind === 'loading') {
    return (
      <div className="w-full animate-pulse rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-6">
        <div className="h-6 w-40 rounded-[2px] bg-[color:var(--color-card-alt)]" />
        <div className="mt-4">
          <StageStrip stages={stages} />
        </div>
      </div>
    )
  }

  // ok
  const statusMeta = STATUS_META[status as Exclude<IssueStatus, 'unknown'>]
  const StatusIcon = statusMeta.Icon
  const voiceLabel = STAGE_STATE_LABELS[voiceState]

  return (
    <div className="w-full rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-semibold text-[color:var(--color-ink)]">
          Issue {issueNumber}
        </h1>
        <span
          className="flex items-center gap-[6px] font-[family-name:var(--font-ui)] text-[13px] font-semibold"
          style={{ color: statusMeta.color }}
        >
          <StatusIcon size={16} aria-hidden="true" />
          {statusMeta.label}
          <HelpTip text={HELP_COPY.issuesHome.statusChip} label="Explain issue status" />
        </span>
      </div>

      <div className="mt-4">
        <StageStrip stages={stages} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Readout label="Open tasks" value={`${openTaskCount} open`} mono />
        <Readout
          label="Claim coverage"
          value={`${claimCoverage.checked} of ${claimCoverage.total} claims checked`}
          mono
          help={HELP_COPY.issuesHome.claimCoverage}
        />
        <Readout label="Voice" value={voiceLabel} />
        <Readout label="Est. work remaining" value={`~${workMinutes} min`} mono />
        <Readout label="Run cost" value={runCostDisplay} mono />
        <div className="flex flex-col justify-end">
          <a
            href={issueHref(issueNumber)}
            className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)]"
          >
            Open issue
          </a>
        </div>
      </div>
    </div>
  )
}
