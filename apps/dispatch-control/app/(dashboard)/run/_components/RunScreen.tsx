'use client'
/**
 * quick 260730-ldn (Task 4) — The Run: the work-first front door. Replaces
 * the task-inbox Desk (quick 260730-i4j), whose selection defect this task
 * exists to fix — see `lib/currentRun.ts` for the root-cause writeup.
 *
 * Built to mockup 14 (populated) and mockup 15 (states) — read both before
 * changing markup; they are the contract.
 *
 * Two exports, the `DeskScreen.tsx` structure this replaces:
 *   - `RunBody` — pure, props only, no Convex, no fetch. Unit-tested directly
 *     (`__tests__/RunScreen.test.tsx`).
 *   - `RunScreen` (default) — the thin Convex/data wrapper.
 *
 * The run IS the page: land on the nine sections the agents produced, real
 * headlines, ready to edit — never a task inbox for an issue that has
 * nothing in it, and never an invented issue. Four honest states:
 * loading / no-run / running / failed / (resting) run — see `RunSurfaceKind`.
 *
 * Publish path — NOT forked here. The three gates below are readouts + links
 * into the existing stages. `recordSignOff`/`publishIssue` stay exclusively
 * in `DecisionRail.tsx` (mounted by `/issues/[n]/approval`), behind its
 * unchanged client gate, role gate, preview interstitial, and the server
 * `_require_editor` dependency. No mutation, no fetch, no sign-off button
 * lives anywhere in this file.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { useCurrentRun } from '@/lib/useCurrentRun'
import { issueTitleLabel, relativeWeekLabel, NO_TITLE_LABEL } from '@/lib/issueTitle'
import {
  deriveRunSectionFindings,
  deriveRunSections,
  type RunSectionRow,
  type RunSectionState,
} from '@/lib/runSections'
import { getDraft, ContentPatchError, type DraftResponse } from '@/lib/contentPatchClient'
import {
  issueDraftHref,
  issueFactCheckHref,
  issueVoiceHref,
  issueApprovalHref,
  issueRunHref,
} from '@/lib/issueRouteResolver'
import { formatElapsed, type IssueStatus } from '@/lib/derivedState'
import { DEFAULT_CADENCE, readConfigValue, formatScheduledForLabel, type Cadence } from '@/lib/scheduleLabel'
import { isOpenFinding } from '@/lib/galley/findingState'
import { VOICE_AXES, FACTUAL_AXES } from '@/lib/galley/axisPartition'
import DocumentTitle from '@/components/ui/DocumentTitle'

// ── Types ────────────────────────────────────────────────────────────────

export type RunSurfaceKind = 'loading' | 'no-run' | 'failed' | 'run'

export interface RunSwitcherRow {
  issueNumber: number
  title: string | null
  hasDrafts: boolean
  isCurrent: boolean
  meta: string
}

export interface RunGateInputs {
  /** false while signOffs / claimRows / qaFindings have not all loaded. */
  loaded: boolean
  factsSignedBy: string | null
  factsSignedAt: number | null
  voiceSignedBy: string | null
  voiceSignedAt: number | null
  claimsUnchecked: number
  claimsTotal: number
  voiceOpenCount: number
  mustFixTotal: number
  held: boolean
}

export interface RunBodyProps {
  surfaceKind: RunSurfaceKind
  runStatus: string | null | undefined
  scheduledForLabel: string
  issueNumber: number | null
  runId: string | null
  /** undefined === still loading; null === loaded-and-absent. */
  title: string | null | undefined
  statusChip: { label: string; color: string }
  elapsedLabel: string
  runCostUsd: number | undefined
  capUsd: number
  claimsChecked: number
  claimsTotal: number
  sections: RunSectionRow[]
  draftError: string | null
  switcher: RunSwitcherRow[]
  gates: RunGateInputs
  onRefresh?: () => void
}

// ── Section-row state chip vocabulary — label + colour, never colour alone ──

const SECTION_STATE_META: Record<RunSectionState, { label: (row: RunSectionRow) => string; color: string }> = {
  clean: { label: () => 'Clean', color: 'var(--color-green)' },
  'must-fix': { label: row => `${row.mustFix} must fix`, color: 'var(--color-vermilion)' },
  voice: { label: row => `${row.voice} voice`, color: 'var(--color-marigold-text)' },
  pending: { label: () => 'Pending', color: 'var(--color-faint)' },
  unknown: { label: () => 'Unavailable', color: 'var(--color-faint)' },
}

function SectionRow({ row, issueNumber }: { row: RunSectionRow; issueNumber: number | null }) {
  const meta = SECTION_STATE_META[row.state]
  const isInteractive =
    issueNumber !== null && (row.state === 'clean' || row.state === 'must-fix' || row.state === 'voice')

  const inner = (
    <>
      <span className="w-[118px] shrink-0 font-[family-name:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[.11em] text-[color:var(--color-cobalt)]">
        {row.label}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={
            isInteractive
              ? 'block font-[family-name:var(--font-display)] text-[20px] font-semibold leading-[1.2] text-[color:var(--color-ink)]'
              : 'block font-[family-name:var(--font-display)] text-[17px] font-normal italic leading-[1.2] text-[color:var(--color-faint)]'
          }
        >
          {row.headline ?? row.label}
        </span>
        {row.excerpt && (
          <span className="mt-1 block truncate font-[family-name:var(--font-body)] text-[12.5px] italic text-[color:var(--color-ink-soft)]">
            {row.excerpt}
          </span>
        )}
        <span className="mt-2 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.04em] text-[color:var(--color-faint)]">
          {row.meta}
        </span>
      </span>
      <span
        className="flex w-[150px] shrink-0 items-center justify-end gap-[6px] font-[family-name:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[.09em]"
        style={{ color: meta.color }}
      >
        <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
        {meta.label(row)}
      </span>
    </>
  )

  const rowClass =
    'flex items-start gap-[18px] border border-t-0 border-[color:var(--color-border)] bg-[color:var(--color-card)] px-[18px] py-4'

  if (isInteractive) {
    return (
      <Link
        href={`${issueDraftHref(issueNumber as number)}?story=${row.id}&tab=draft`}
        className={rowClass}
        data-testid={`section-row-${row.id}`}
      >
        {inner}
      </Link>
    )
  }
  return (
    <div className={`${rowClass} bg-[color:var(--color-card-alt)]`} data-testid={`section-row-${row.id}`}>
      {inner}
    </div>
  )
}

// ── Switcher ─────────────────────────────────────────────────────────────

function SwitcherPanel({ rows }: { rows: RunSwitcherRow[] }) {
  return (
    <details className="mt-4 border border-[color:var(--color-ink)] bg-[color:var(--color-card)]">
      <summary className="cursor-pointer px-4 py-2 font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[.12em] text-[color:var(--color-faint)]">
        Switch issue
      </summary>
      <div>
        {rows.map(row => {
          const label = issueTitleLabel(row.title)
          const isLink = row.hasDrafts && !row.isCurrent
          const content = (
            <>
              <span className="w-[62px] shrink-0 font-[family-name:var(--font-mono)] text-[10.5px] text-[color:var(--color-faint)]">
                {row.issueNumber}
              </span>
              <span
                className={
                  row.hasDrafts
                    ? 'flex-1 font-[family-name:var(--font-display)] text-[16px] font-semibold'
                    : 'flex-1 font-[family-name:var(--font-display)] text-[16px] font-normal italic text-[color:var(--color-faint)]'
                }
              >
                {label}
              </span>
              <span className="shrink-0 font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[.07em] text-[color:var(--color-faint)]">
                {row.meta}
              </span>
            </>
          )
          const rowClass =
            'flex items-baseline gap-[14px] border-t border-[color:var(--color-border)] px-[15px] py-[11px]'
          if (isLink) {
            return (
              <Link
                key={row.issueNumber}
                href={issueDraftHref(row.issueNumber)}
                className={rowClass}
                data-testid={`switcher-row-${row.issueNumber}`}
              >
                {content}
              </Link>
            )
          }
          return (
            <span
              key={row.issueNumber}
              aria-current={row.isCurrent ? 'true' : undefined}
              className={rowClass}
              data-testid={`switcher-row-${row.issueNumber}`}
            >
              {content}
            </span>
          )
        })}
      </div>
    </details>
  )
}

// ── Gates ────────────────────────────────────────────────────────────────

function relativeTime(ms: number | null): string {
  if (ms === null) return '—'
  const diffMs = Date.now() - ms
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function publishBlockReason(gates: RunGateInputs, factsSigned: boolean, voiceSigned: boolean): string {
  if (gates.held) return 'This issue is held.'
  if (!factsSigned && !voiceSigned) return 'Both sign-offs are still outstanding.'
  if (!factsSigned) return 'Facts sign-off is still outstanding.'
  if (!voiceSigned) return 'Voice sign-off is still outstanding.'
  return `${gates.mustFixTotal} must-fix finding${gates.mustFixTotal === 1 ? '' : 's'} remain${gates.mustFixTotal === 1 ? 's' : ''}.`
}

function GatesPanel({ gates, issueNumber }: { gates: RunGateInputs; issueNumber: number }) {
  const factsSigned = gates.factsSignedBy !== null
  const voiceSigned = gates.voiceSignedBy !== null
  const canPublish = factsSigned && voiceSigned && gates.mustFixTotal === 0 && !gates.held

  return (
    <div className="mt-8 border border-[color:var(--color-ink)] bg-[color:var(--color-card)]">
      <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-card-alt)] px-[18px] py-[13px]">
        <h2 className="font-[family-name:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[.13em] text-[color:var(--color-ink)]">
          Before it can publish
        </h2>
      </div>

      <div className="flex items-center gap-[14px] border-b border-[color:var(--color-border)] px-[18px] py-[14px]">
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-[color:var(--color-ink)]">Clear the facts</span>
          {!gates.loaded ? (
            <span className="mt-1 block font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-ink-soft)]">
              Checking…
            </span>
          ) : factsSigned ? (
            <span className="mt-1 block font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-green)]">
              Cleared by {gates.factsSignedBy} · {relativeTime(gates.factsSignedAt)}
            </span>
          ) : (
            <span className="mt-1 block font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-ink-soft)]">
              {gates.claimsUnchecked} of {gates.claimsTotal} claims still unchecked. This gate stays closed
              until they are signed off.
            </span>
          )}
        </span>
        {gates.loaded && !factsSigned && (
          <Link
            href={issueFactCheckHref(issueNumber)}
            className="whitespace-nowrap font-[family-name:var(--font-ui)] text-[12.5px] font-semibold text-[color:var(--color-cobalt)]"
          >
            Check claims →
          </Link>
        )}
      </div>

      <div className="flex items-center gap-[14px] border-b border-[color:var(--color-border)] px-[18px] py-[14px]">
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-[color:var(--color-ink)]">Sounds human</span>
          {!gates.loaded ? (
            <span className="mt-1 block font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-ink-soft)]">
              Checking…
            </span>
          ) : voiceSigned ? (
            <span className="mt-1 block font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-green)]">
              Cleared by {gates.voiceSignedBy} · {relativeTime(gates.voiceSignedAt)}
            </span>
          ) : (
            <span className="mt-1 block font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-ink-soft)]">
              {gates.voiceOpenCount > 0
                ? `${gates.voiceOpenCount} voice finding${gates.voiceOpenCount === 1 ? '' : 's'} open.`
                : 'Voice sign-off outstanding.'}
            </span>
          )}
        </span>
        {gates.loaded && !voiceSigned && (
          <Link
            href={issueVoiceHref(issueNumber)}
            className="whitespace-nowrap font-[family-name:var(--font-ui)] text-[12.5px] font-semibold text-[color:var(--color-cobalt)]"
          >
            Voice pass →
          </Link>
        )}
      </div>

      <div className="flex items-center gap-[14px] px-[18px] py-[14px]">
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-[color:var(--color-ink)]">Approve &amp; publish</span>
          {!gates.loaded ? (
            <span className="mt-1 block font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-ink-soft)]">
              Checking…
            </span>
          ) : !canPublish ? (
            <span className="mt-1 block font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-ink-soft)]">
              {publishBlockReason(gates, factsSigned, voiceSigned)}
            </span>
          ) : (
            <span className="mt-1 block font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-ink-soft)]">
              Opens when both gates above are signed and no must-fix findings remain.
            </span>
          )}
        </span>
        {gates.loaded && canPublish ? (
          <Link
            href={issueApprovalHref(issueNumber)}
            className="whitespace-nowrap font-[family-name:var(--font-ui)] text-[12.5px] font-semibold text-[color:var(--color-ink)]"
          >
            Approve &amp; publish →
          </Link>
        ) : gates.loaded ? (
          <span className="whitespace-nowrap border border-[color:var(--color-border)] bg-[color:var(--color-card-alt)] px-[15px] py-[9px] font-[family-name:var(--font-ui)] text-[12.5px] font-semibold text-[color:var(--color-faint)]">
            Locked
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ── RunBody (pure — no Convex, unit-testable directly) ──────────────────────

export function RunBody(props: RunBodyProps) {
  const {
    surfaceKind,
    runStatus,
    scheduledForLabel,
    issueNumber,
    runId,
    title,
    statusChip,
    elapsedLabel,
    runCostUsd,
    capUsd,
    claimsChecked,
    claimsTotal,
    sections,
    draftError,
    switcher,
    gates,
    onRefresh,
  } = props

  if (surfaceKind === 'loading') {
    return (
      <div className="mx-auto max-w-[1080px] px-6 py-10">
        <DocumentTitle title="The Run" />
        <p className="animate-pulse font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
          Loading the run…
        </p>
      </div>
    )
  }

  if (surfaceKind === 'no-run') {
    return (
      <div className="mx-auto max-w-[1080px] px-6 py-10">
        <DocumentTitle title="The Run" />
        <div className="border border-[color:var(--color-ink)] bg-[color:var(--color-card)] p-8 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-[22px] font-semibold text-[color:var(--color-ink)]">
            Nothing is running.
          </h1>
          <p className="mt-2 font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-ink-soft)]">
            The next discovery is scheduled {scheduledForLabel}.
          </p>
          <div className="mt-4 flex justify-center">
            <Link
              href="/issues"
              className="inline-flex min-h-[44px] items-center bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)]"
            >
              Start a run →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isActivelyRunning = surfaceKind === 'run' && runStatus === 'running'
  const isFailed = surfaceKind === 'failed'
  const writtenCount = sections.filter(s => s.generated).length
  const pendingCount = sections.length - writtenCount
  const needsYouCount = sections.filter(s => s.state === 'must-fix' || s.state === 'voice').length

  return (
    <div className="mx-auto max-w-[1080px] px-6 pb-16 pt-6">
      <DocumentTitle title="The Run" />

      {/* Identity line */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[.11em] text-[color:var(--color-faint)]">
          {issueNumber != null ? `Issue ${issueNumber}` : 'Issue —'}
        </span>
        <span
          className="shrink-0 border px-[9px] py-[4px] font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[.09em]"
          style={{ color: statusChip.color, borderColor: statusChip.color }}
        >
          {statusChip.label}
        </span>
        <div className="ml-auto flex gap-[18px] font-[family-name:var(--font-mono)] text-[11.5px] text-[color:var(--color-ink-soft)]">
          <span>{elapsedLabel}</span>
          <span>
            {runCostUsd === undefined
              ? 'cost unknown — refresh'
              : `$${runCostUsd.toFixed(2)} / $${capUsd.toFixed(2)}`}
          </span>
          <span>
            Claims {claimsChecked}/{claimsTotal}
          </span>
        </div>
      </div>

      {title !== undefined && (
        <h1 className="mt-2 border-b-2 border-[color:var(--color-ink)] pb-[13px] font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.08] text-[color:var(--color-ink)]">
          {title === null ? NO_TITLE_LABEL : title}
        </h1>
      )}

      <p className="mt-[10px] font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-ink-soft)]">
        {isActivelyRunning
          ? `Sections appear here as each agent finishes. ${writtenCount} of 9 written.`
          : needsYouCount > 0
            ? `${writtenCount} of 9 sections written. ${needsYouCount} need you.`
            : `${writtenCount} of 9 sections written. Nothing here needs you.`}
        {runId !== null && issueNumber !== null && (
          <>
            {' '}
            <Link
              href={issueRunHref(issueNumber, runId)}
              className="font-[family-name:var(--font-ui)] text-[12.5px] font-semibold not-italic text-[color:var(--color-cobalt)]"
            >
              Run details →
            </Link>
          </>
        )}
      </p>

      {switcher.length > 0 && <SwitcherPanel rows={switcher} />}

      <div className="mt-[30px] flex items-baseline gap-[10px]">
        <h2 className="font-[family-name:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[.13em] text-[color:var(--color-ink)]">
          The work
        </h2>
        <span className="ml-auto font-[family-name:var(--font-mono)] text-[10.5px] text-[color:var(--color-faint)]">
          {writtenCount} written · {pendingCount} pending
        </span>
      </div>

      {draftError !== null && (
        <div
          role="alert"
          className="mt-2 border border-[color:var(--color-vermilion)]/40 bg-[color:var(--color-card)] p-3 font-[family-name:var(--font-ui)] text-[12.5px] text-[color:var(--color-vermilion)]"
        >
          {draftError}
        </div>
      )}

      <div className="mt-1 flex flex-col">
        {sections.map(row => (
          <SectionRow key={row.id} row={row} issueNumber={issueNumber} />
        ))}
      </div>

      {isFailed && (
        <div className="mt-[26px] border border-[color:var(--color-vermilion)]/40 bg-[color:var(--color-card)] p-5">
          <p className="font-[family-name:var(--font-display)] text-[16px] font-semibold text-[color:var(--color-ink)]">
            This run failed.
          </p>
          <p className="mt-1 font-[family-name:var(--font-body)] text-[12.5px] italic text-[color:var(--color-ink-soft)]">
            Two sections survived and are kept. Re-running starts from the failed agent.
          </p>
          <div className="mt-3 flex gap-3">
            {runId !== null && (
              <Link
                href={`/run-monitor/runs/${encodeURIComponent(runId)}`}
                className="font-[family-name:var(--font-ui)] text-[12.5px] font-semibold text-[color:var(--color-cobalt)]"
              >
                Re-run →
              </Link>
            )}
            {runId !== null && issueNumber !== null && (
              <Link
                href={issueRunHref(issueNumber, runId)}
                className="font-[family-name:var(--font-ui)] text-[12.5px] font-semibold text-[color:var(--color-cobalt)]"
              >
                Run details →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* No mutation, no fetch, no sign-off button lives here — the gates are
          readouts and links into the existing stages only. Publish stays
          exclusively behind DecisionRail at /issues/[n]/approval. */}
      {!isActivelyRunning && !isFailed && issueNumber !== null && (
        <GatesPanel gates={gates} issueNumber={issueNumber} />
      )}

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="mt-6 font-[family-name:var(--font-ui)] text-[11.5px] text-[color:var(--color-faint)] underline underline-offset-2"
        >
          Refresh
        </button>
      )}
    </div>
  )
}

// ── RunScreen (default — the data-fetching wrapper) ─────────────────────────

function switcherStatusWord(row: {
  published: boolean
  held: boolean
  runStatus: string | null
  hasDrafts: boolean
}): string {
  if (row.published) return 'published'
  if (row.held) return 'held'
  if (!row.hasDrafts) return 'no drafts'
  if (row.runStatus === 'failed') return 'failed'
  if (row.runStatus === 'running') return 'running'
  if (row.runStatus === 'awaiting-review') return 'needs review'
  return 'in progress'
}

// Keyed by the literal IssueStatus union (not a generic string index
// signature) so every access below is a definite property lookup, never
// `T | undefined`, under the repo's `noUncheckedIndexedAccess` tsconfig.
const STATUS_CHIP_META: Record<IssueStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'var(--color-ink-soft)' },
  'needs-review': { label: 'Needs review', color: 'var(--color-marigold-text)' },
  ready: { label: 'Ready to publish', color: 'var(--color-green)' },
  published: { label: 'Published', color: 'var(--color-green)' },
  held: { label: 'Held', color: 'var(--color-vermilion)' },
  failed: { label: 'Run failed', color: 'var(--color-vermilion)' },
  unknown: { label: 'State unknown', color: 'var(--color-vermilion)' },
}

export default function RunScreen() {
  const { getToken } = useAuth()
  const run = useCurrentRun()
  const issuesList = useQuery(api.issues.listWithTitles, { workspace_id: DEFAULT_WORKSPACE_ID })

  const [draft, setDraft] = useState<DraftResponse | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)

  useEffect(() => {
    if (run.runId === null) {
      setDraft(null)
      setDraftError(null)
      return
    }
    let cancelled = false
    async function load() {
      setDraftError(null)
      try {
        const token = await getToken()
        const result = await getDraft(run.runId as string, token)
        if (!cancelled) setDraft(result)
      } catch (e) {
        if (!cancelled) {
          setDraft(null)
          setDraftError(
            e instanceof ContentPatchError
              ? e.message
              : e instanceof Error
                ? e.message
                : 'Failed to load the draft.',
          )
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // getToken is intentionally excluded from this dependency array (quick
    // 260721-ohu precedent, ReviewDeskRunView.reloadDraft) to avoid a refetch
    // loop when its reference churns; depend on run.runId only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.runId])

  const counts = deriveRunSectionFindings(run.qaFindings)
  const sections = deriveRunSections(draft, counts)

  // ── Surface state ──────────────────────────────────────────────────────
  const cadence = readConfigValue<Cadence>(run.configRows, 'schedule_cadence') ?? DEFAULT_CADENCE
  const scheduleNextRunAt = readConfigValue<number>(run.configRows, 'schedule_next_run_at')
  const scheduledForLabel = formatScheduledForLabel(scheduleNextRunAt, cadence)

  let surfaceKind: RunSurfaceKind
  if (run.state.kind === 'loading') {
    surfaceKind = 'loading'
  } else if (run.state.kind === 'none') {
    surfaceKind = 'no-run'
  } else if (run.issueStatus === 'failed' || run.derivationInputs.runStatus === 'failed') {
    surfaceKind = 'failed'
  } else {
    surfaceKind = 'run'
  }

  const statusChip =
    surfaceKind === 'failed'
      ? STATUS_CHIP_META.failed
      : run.derivationInputs.runStatus === 'running'
        ? { label: 'Running', color: 'var(--color-cobalt)' }
        : (STATUS_CHIP_META[run.issueStatus] ?? STATUS_CHIP_META.unknown)

  // ── Gates ──────────────────────────────────────────────────────────────
  const gatesLoaded = run.signOffs !== undefined && run.claimRows !== undefined && run.qaFindings !== undefined
  const factsSignOff = run.signOffs?.['facts-cleared']
  const voiceSignOff = run.signOffs?.['sounds-human']
  const claimsTotal = run.claimSummary?.total ?? 0
  const claimsChecked = run.claimSummary?.signedOff ?? 0
  const claimsUnchecked = Math.max(0, claimsTotal - claimsChecked)
  const voiceOpenCount = (run.qaFindings ?? []).filter(
    row => isOpenFinding(row) && VOICE_AXES.has(row.axis ?? ''),
  ).length
  const mustFixTotal = (run.qaFindings ?? []).filter(
    row => isOpenFinding(row) && (row.axis === undefined || FACTUAL_AXES.has(row.axis)) && row.severity === 'error',
  ).length
  const held = run.derivationInputs.issue ? run.derivationInputs.issue.held : false

  const gates: RunGateInputs = {
    loaded: gatesLoaded,
    factsSignedBy: factsSignOff?.actorId ?? null,
    factsSignedAt: factsSignOff?.signedAt ?? null,
    voiceSignedBy: voiceSignOff?.actorId ?? null,
    voiceSignedAt: voiceSignOff?.signedAt ?? null,
    claimsUnchecked,
    claimsTotal,
    voiceOpenCount,
    mustFixTotal,
    held,
  }

  // ── Switcher ───────────────────────────────────────────────────────────
  const now = Date.now()
  const switcher: RunSwitcherRow[] = (issuesList ?? []).map(issue => ({
    issueNumber: issue.issueNumber,
    title: issue.title,
    hasDrafts: issue.hasDrafts,
    isCurrent: issue.issueNumber === run.issueNumber,
    meta: `${relativeWeekLabel(issue.runStartedAt ?? issue.publishedAt ?? issue.createdAt, now)} · ${switcherStatusWord(issue)}`,
  }))

  return (
    <RunBody
      surfaceKind={surfaceKind}
      runStatus={run.derivationInputs.runStatus}
      scheduledForLabel={scheduledForLabel}
      issueNumber={run.issueNumber}
      runId={run.runId}
      title={run.title}
      statusChip={statusChip}
      elapsedLabel={formatElapsed(run.runRow?.startedAt, now, run.runRow?.completedAt ?? undefined)}
      runCostUsd={run.runCostUsd}
      capUsd={run.capUsd}
      claimsChecked={claimsChecked}
      claimsTotal={claimsTotal}
      sections={sections}
      draftError={draftError}
      switcher={switcher}
      gates={gates}
      // Convex queries are already live-subscribed — there is no client-side
      // "retry" lever for a stuck/failed input; a full reload re-establishes
      // the websocket connection (documented last resort, DeskScreen/
      // IssueCard precedent).
      onRefresh={() => window.location.reload()}
    />
  )
}
