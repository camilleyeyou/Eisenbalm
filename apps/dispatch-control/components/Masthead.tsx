'use client'
/**
 * Persistent 52px ink masthead (CHR-02, Plan 30-04).
 * Rebuilt Phase 40 Plan 40-08 (ISS-05 / D-24..D-27, 40-UI-SPEC State & Icon
 * Contract) — the single blended "pipeline-state" chip is split into FOUR
 * separate, never-blended, label+icon readouts. Each is its own node; none
 * of the four share a container.
 *
 *   1. Issue status  — `deriveIssueStatus` (lib/derivedState.ts, D-18). When
 *      unresolved/failed it renders `AlertTriangle` + "State unknown —
 *      refresh" (ISS-06) — structurally never a stale value.
 *   2. System activity — relabels the OLD blended chip: `runs.latest.status`
 *      mapped to Idle / Running / Paused for you / Failed / Complete.
 *      `Loader2` (spin) is RESERVED to this readout's "Running" state.
 *   3. My Tasks — `deriveTasks(...).length` (D-21, COUNT ONLY — Phase 43
 *      builds the screen). Replaces `AwaitingYouTrigger`; clicking it still
 *      opens the existing `AwaitingYouInbox` dropdown (D-25) — no
 *      capability lost, no dead button.
 *   4. Cost vs budget — UNCHANGED wiring: `runs.monthToDateCost` +
 *      `pipelineConfig` `monthly_cap_usd`.
 *
 * Issue status resolves the SAME way the `/issues` home does, but scoped to
 * the latest run (reusing the masthead's EXISTING wiring, not the full
 * issues-list scan `/issues/page.tsx` performs — see 40-08 plan interfaces):
 *   `runs.latest` → its `issueNumber` (`pipelineRuns.byRunId`, already wired)
 *   → `issues.byIssueNumber` for `held`/`published`, plus
 *   `signOffs.activeByRunId` / `claimChecks.listByRunId` /
 *   `qaCorrections.byRunId` / `pitchLog.byRunId` for the current runId — the
 *   exact `DerivationInputs` shape `deriveIssueStatus`/`deriveTasks` expect.
 *
 * Also carries the D-26 rename: the OFF/normal case reads "Human approval
 * required" (quiet reassurance). The ON case keeps its existing loud
 * vermilion treatment exactly as before — `AutoPublishBanner` (elsewhere in
 * the layout) is untouched.
 *
 * quick 260722-v01: header gained `pl-[52px] md:pl-[22px]` so the fixed
 * below-md hamburger (`MobileNavDrawer.tsx`, mounted in the dashboard layout,
 * NOT here) doesn't overlap the wordmark. No other change — this file is
 * still not aware of the drawer.
 *
 * quick 260722-v01 follow-up (mobile header clipping): the single 52px row
 * used to overflow on phones and the shell's `overflow-hidden` CLIPPED the
 * right-side items (My Tasks + UserButton) off-screen. Now: wordmark and the
 * right cluster are `shrink-0` bookends, and the middle readouts (issue no. /
 * status / activity / cost / auto-publish) live in a `min-w-0 flex-1
 * overflow-x-auto` strip — horizontally swipeable on narrow screens
 * (scrollbar hidden), identical to before on md+ where everything fits. The
 * wordmark drops to 13px below md. No readout is ever hidden, only scrolled.
 */
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { UserButton } from '@clerk/nextjs'
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  FileEdit,
  ListChecks,
  Loader2,
  PauseCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import {
  deriveIssueStatus,
  deriveTasks,
  type DerivationInputs,
  type IssueStatus,
} from '@/lib/derivedState'
import AwaitingYouInbox from './AwaitingYouInbox'
import ScrollHintRow from './ui/ScrollHintRow'
import { useCommandPalette } from './CommandPalette'

type ConfigRow = { key: string; value: string }

function readConfigValue<T>(rows: ConfigRow[] | undefined, key: string): T | undefined {
  const row = rows?.find(r => r.key === key)
  if (!row) return undefined
  try {
    return JSON.parse(row.value) as T
  } catch {
    return undefined
  }
}

// ── Readout 1: Issue status (D-18, State & Icon Contract §1) ────────────────

const ISSUE_STATUS_META: Record<
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
  // quick 260718-51o (FAILED-RUN-TERMINAL-STATE) — non-actionable. Note: the
  // separate SystemActivity readout below ALREADY renders 'Failed' from run
  // status; this is the distinct issue-status record, which also needs the key.
  failed: { label: 'Run failed', Icon: AlertTriangle, color: 'var(--color-vermilion)' },
}

function IssueStatusReadout({ status }: { status: IssueStatus }) {
  // ISS-06 — structural: never a stale/prior label can leak through here.
  if (status === 'unknown') {
    return (
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex min-h-[44px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[2px] px-[9px] py-[3px] font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-vermilion)]"
      >
        <AlertTriangle size={13} aria-hidden="true" />
        State unknown — refresh
      </button>
    )
  }
  const meta = ISSUE_STATUS_META[status]
  const Icon = meta.Icon
  return (
    <span
      className="flex shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[2px] px-[9px] py-[3px] font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.06em]"
      style={{ color: meta.color }}
    >
      <Icon size={13} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

// ── Readout 2: System activity (runs.latest.status, State & Icon Contract §2) ─

type SystemActivity = 'idle' | 'running' | 'paused-for-you' | 'failed' | 'complete'

const SYSTEM_ACTIVITY_META: Record<
  SystemActivity,
  { label: string; Icon: LucideIcon; color: string; spin?: boolean }
> = {
  idle: { label: 'Idle', Icon: Circle, color: 'var(--color-faint)' },
  running: { label: 'Running', Icon: Loader2, color: 'var(--color-cobalt)', spin: true },
  'paused-for-you': {
    label: 'Paused for you',
    Icon: PauseCircle,
    color: 'var(--color-marigold-text)',
  },
  failed: { label: 'Failed', Icon: AlertTriangle, color: 'var(--color-vermilion)' },
  complete: { label: 'Complete', Icon: CheckCircle2, color: 'var(--color-green)' },
}

// `runs.status` literals: 'running' | 'awaiting-review' | 'complete' | 'failed'
// (schema.ts). 'awaiting-review' === "paused at Andrew gate" — maps to the
// UI-SPEC's "Paused for you". No `latest` row (fresh workspace) → Idle.
function systemActivityFromRunStatus(status: string | undefined | null): SystemActivity {
  if (status === 'running') return 'running'
  if (status === 'awaiting-review') return 'paused-for-you'
  if (status === 'failed') return 'failed'
  if (status === 'complete') return 'complete'
  return 'idle'
}

function SystemActivityReadout({ activity }: { activity: SystemActivity }) {
  const meta = SYSTEM_ACTIVITY_META[activity]
  const Icon = meta.Icon
  return (
    <span
      className="flex shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[2px] px-[9px] py-[3px] font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.06em]"
      style={{ color: meta.color }}
    >
      <Icon size={13} aria-hidden="true" className={meta.spin ? 'animate-spin' : undefined} />
      {meta.label}
    </span>
  )
}

// ── Readout 3: My Tasks (D-21/D-25, State & Icon Contract §3) ───────────────
// Replaces the old `AwaitingYouTrigger` — COUNT ONLY (Phase 43 builds the
// screen). Clicking it still opens the existing `AwaitingYouInbox` dropdown.

export function MyTasksTrigger({
  count,
  onClick,
}: {
  count: number
  onClick?: () => void
}) {
  const color = count > 0 ? 'var(--color-vermilion)' : 'var(--color-ink-soft)'
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[2px] px-[12px] py-[5px] font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.04em]"
      style={{ color }}
    >
      <ListChecks size={14} aria-hidden="true" />
      My Tasks · {count}
    </button>
  )
}

export default function Masthead() {
  const [inboxOpen, setInboxOpen] = useState(false)
  const { open: openCommandPalette } = useCommandPalette()
  const latest = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })
  const pipelineRun = useQuery(
    api.pipelineRuns.byRunId,
    latest ? { runId: latest.runId } : 'skip',
  )
  const mtd = useQuery(api.runs.monthToDateCost, { workspace_id: DEFAULT_WORKSPACE_ID })
  const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id: DEFAULT_WORKSPACE_ID })

  const cap = readConfigValue<number>(configRows, 'monthly_cap_usd')
  const autoPublish = readConfigValue<boolean>(configRows, 'auto_publish')

  const issueNumber = pipelineRun?.issueNumber
  const runId: string | null = latest?.runId ?? null

  // ── Issue-status derivation inputs (D-18, same shape /issues/page.tsx assembles) ──
  const issueRow = useQuery(
    api.issues.byIssueNumber,
    issueNumber != null ? { workspace_id: DEFAULT_WORKSPACE_ID, issueNumber } : 'skip',
  )
  const signOffs = useQuery(api.signOffs.activeByRunId, runId ? { runId } : 'skip')
  const claimRowsRaw = useQuery(api.claimChecks.listByRunId, runId ? { runId } : 'skip')
  const qaFindings = useQuery(api.qaCorrections.byRunId, runId ? { runId } : 'skip')
  const pitchRows = useQuery(api.pitchLog.byRunId, runId ? { runId } : 'skip')

  const claimRows = claimRowsRaw?.map(row => ({
    _id: row._id,
    status: row.status,
    sourceUrl: row.sourceUrl,
    sectionName: row.sectionName,
    claimText: row.text,
  }))

  const derivationInputs: DerivationInputs = {
    issueNumber: issueNumber ?? null,
    runId,
    issue: issueRow === undefined ? undefined : issueRow ? { held: issueRow.held, published: issueRow.published } : null,
    signOffs,
    claimRows,
    qaFindings,
    pitchRows,
    runStatus: latest?.status,
  }

  const issueStatus = deriveIssueStatus(derivationInputs)
  const taskCount = deriveTasks(derivationInputs).length
  const systemActivity = systemActivityFromRunStatus(latest?.status)

  return (
    <header className="flex h-[52px] items-center gap-3 bg-[color:var(--color-ink)] pl-[52px] pr-3 text-[color:var(--color-masthead-text)] md:gap-4 md:pl-[22px] md:pr-[22px]">
      {/* Wordmark — shrink-0 bookend; compacts below md so the hamburger +
          wordmark + right cluster all fit a phone width. */}
      <span className="shrink-0 whitespace-nowrap font-[family-name:var(--font-ui)] text-[13px] font-bold tracking-[.03em] md:text-[15.5px]">
        DISPATCH<span className="text-[color:var(--color-vermilion)]">/</span>CONTROL
      </span>

      {/* quick 260722-v01 follow-up: the middle readouts live in a min-w-0
          flex-1 strip that scrolls horizontally on narrow screens (scrollbar
          hidden) instead of pushing the right cluster off-screen into the
          shell's overflow-hidden clip. On md+ everything fits and this
          renders identically to the old flat row. */}
      <ScrollHintRow
        wrapperClassName="min-w-0 flex-1"
        fadeColor="var(--color-ink)"
        chevronClassName="text-[color:var(--color-masthead-text)]"
        className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-4"
      >
        {/* Issue number — contextual identifier, not one of the four ISS-05 readouts */}
        <span className="shrink-0 whitespace-nowrap font-[family-name:var(--font-mono)] text-[color:var(--color-masthead-muted)]">
          {issueNumber != null ? `Issue ${issueNumber}` : 'Issue —'}
        </span>

        {/* Readout 1: Issue status (D-18) — separate node, never shares a
            container with System activity below. */}
        <IssueStatusReadout status={issueStatus} />

        {/* Readout 2: System activity (relabel of the old blended chip) —
            visibly distinct from Issue status; `Loader2` spin is exclusive
            to this readout's "Running" state. */}
        <SystemActivityReadout activity={systemActivity} />

        {/* Readout 4: Cost vs budget — unchanged query wiring. */}
        {mtd !== undefined && cap !== undefined && (
          <span className="flex shrink-0 items-center gap-[6px] whitespace-nowrap font-[family-name:var(--font-mono)]">
            <CircleDollarSign
              size={13}
              aria-hidden="true"
              className={
                mtd.mtdUsd >= cap
                  ? 'text-[color:var(--color-vermilion)]'
                  : 'text-[color:var(--color-ink-soft)]'
              }
            />
            <span className={mtd.mtdUsd >= cap ? 'text-[color:var(--color-vermilion)]' : undefined}>
              ${mtd.mtdUsd.toFixed(2)}
            </span>
            {` / $${cap}`}
          </span>
        )}

        {/* Auto-publish chip — D-26 rename (Phase 40) + D-16 reframe (Phase
            50-03). OFF is the safe/expected state ("Human approval required",
            quiet reassurance). ON is an honest alert — never switch-framed as
            something flipped here — pointing at where the setting actually
            lives (Administration / Config); keeps the existing loud vermilion
            treatment. */}
        {autoPublish !== undefined && (
          <span
            className={
              autoPublish
                ? 'shrink-0 whitespace-nowrap font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-vermilion)]'
                : 'shrink-0 whitespace-nowrap font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-green)]'
            }
          >
            {autoPublish ? 'Publishing automatically — managed in Administration' : 'Human approval required'}
          </span>
        )}
      </ScrollHintRow>

      {/* quick 260723-4a6 (Task 2c): the discoverable ⌘K chip — opens the
          SAME palette the global keydown listener does. hidden md:flex:
          mobile uses the drawer, not the masthead strip. */}
      <button
        type="button"
        onClick={() => openCommandPalette()}
        className="hidden min-h-[44px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[2px] px-[9px] py-[3px] font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-masthead-muted)] hover:text-[color:var(--color-masthead-text)] md:flex"
      >
        ⌘K
      </button>

      {/* Readout 3: My Tasks (D-21/D-25) + the existing inbox dropdown —
          `relative` anchors the inbox's `absolute top-[52px]` positioning
          under this readout. A full-screen transparent backdrop below the
          dropdown (but above page content) closes it on outside click.
          shrink-0: pinned right-cluster bookend, never clipped on mobile. */}
      <div className="relative shrink-0">
        <MyTasksTrigger count={taskCount} onClick={() => setInboxOpen(v => !v)} />
        {inboxOpen && (
          <button
            type="button"
            aria-label="Close awaiting-you inbox"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setInboxOpen(false)}
          />
        )}
        <AwaitingYouInbox open={inboxOpen} onClose={() => setInboxOpen(false)} />
      </div>

      <span className="shrink-0">
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'h-8 w-8',
            },
          }}
        />
      </span>
    </header>
  )
}
