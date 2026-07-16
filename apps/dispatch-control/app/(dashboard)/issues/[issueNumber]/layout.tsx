'use client'
/**
 * Phase 41 Plan 41-06 (WSP-01, D-01..D-04) — the Issue Workspace frame.
 *
 * The shared layout mounted at every `/issues/[issueNumber]/*` route
 * (including the bare index `page.tsx`, which is now a redirect-only Server
 * Component — see the sibling `page.tsx`). This is the spine the whole
 * phase builds on: it wraps every stage route in ONE `WorkspaceStateProvider`
 * (Phase 41 Plan 41-05 — all 8 Convex subscriptions + derivation live there,
 * not here) so the frame survives tab switches without re-subscribing
 * (App Router layout semantics — modeled on `run-monitor/layout.tsx`'s
 * `usePathname`-driven active-tab pattern).
 *
 * Renders, top to bottom:
 *   1. The persistent header — Issue {n} + the derived status readout
 *      (ISS-06: 'unknown' always renders "State unknown — refresh", never a
 *      stale value) + `{tasks.length} open · ~{workMinutes} min`.
 *   2. The 5 stage tabs (Story/Draft/Fact Check/Voice/Approval), each a
 *      `<Link>` to its stage href, live status mark = label + icon (never
 *      color alone — reuses `StageStrip`'s `STAGE_STATE_LABELS` + its exact
 *      4-icon set), active via `usePathname()` + `aria-current="page"`.
 *   3. The persistent `WorkspaceOutline` (left) + the active stage's canvas
 *      (`{children}`, center) + the collapsible `ContextPanel` shell (right).
 *   4. `WorkspaceControls` — Hold/Reopen + run history, relocated from the
 *      old overview `page.tsx` (Pitfall 5 — no capability lost, D-03).
 *
 * LAST-VISITED WRITER (D-03/D-04): a `useEffect` keyed on `usePathname()`
 * parses the current path's last segment; when it is one of the 5 known
 * stage segments, it calls `api.issues.setLastVisitedStage` so the bare
 * `/issues/[n]` redirect (sibling `page.tsx`) knows where to send the
 * operator next time. Best-effort — a failed write must never block
 * navigation or surface an error (mirrors the `cancelRun` tolerance below).
 * Unknown segments (the bare index route's numeric segment, `/runs/[runId]`)
 * are silently ignored — they never match the 5-word stage-segment set.
 *
 * This file intentionally does NOT render a second main landmark element —
 * the dashboard root layout (`app/(dashboard)/layout.tsx`) already owns the
 * single one for the whole app; this frame's root is a plain `<div>`.
 */
import { useEffect } from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useMutation } from 'convex/react'
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Circle,
  CircleDot,
  FileEdit,
  PauseCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { cn } from '@/lib/utils'
import type { IssueStatus, StageState } from '@/lib/derivedState'
import {
  parseIssueNumber,
  issueStoryHref,
  issueDraftHref,
  issueFactCheckHref,
  issueVoiceHref,
  issueApprovalHref,
} from '@/lib/issueRouteResolver'
import { STAGE_STATE_LABELS } from '../_components/StageStrip'
import { WorkspaceStateProvider, useWorkspaceState } from '../_components/WorkspaceStateProvider'
import WorkspaceOutline from '../_components/WorkspaceOutline'
import ContextPanel from '../_components/ContextPanel'
import WorkspaceControls from '../_components/WorkspaceControls'
import IssueComments from './_components/IssueComments'

type StageSegment = 'story' | 'draft' | 'fact-check' | 'voice' | 'approval'

const STAGE_TABS: Array<{ label: string; segment: StageSegment; hrefFor: (n: number) => string }> = [
  { label: 'Story', segment: 'story', hrefFor: issueStoryHref },
  { label: 'Draft', segment: 'draft', hrefFor: issueDraftHref },
  { label: 'Fact Check', segment: 'fact-check', hrefFor: issueFactCheckHref },
  { label: 'Voice', segment: 'voice', hrefFor: issueVoiceHref },
  { label: 'Approval', segment: 'approval', hrefFor: issueApprovalHref },
]

const STAGE_SEGMENTS = new Set<StageSegment>(STAGE_TABS.map(t => t.segment))

function isStageSegment(value: string | undefined): value is StageSegment {
  return value !== undefined && STAGE_SEGMENTS.has(value as StageSegment)
}

/** The EXACT icon set `StageStrip` uses (private there) — label + icon, never color alone. */
function StageTabIcon({ state }: { state: StageState }) {
  switch (state) {
    case 'not-generated':
      return (
        <Circle size={14} className="shrink-0 text-[color:var(--color-faint)]" aria-hidden="true" />
      )
    case 'in-progress':
      return (
        <CircleDot
          size={14}
          className="shrink-0 text-[color:var(--color-marigold)]"
          aria-hidden="true"
        />
      )
    case 'needs-you':
      return (
        <AlertTriangle
          size={14}
          className="shrink-0 text-[color:var(--color-vermilion)]"
          aria-hidden="true"
        />
      )
    case 'clean':
      return (
        <CheckCircle2
          size={14}
          className="shrink-0 text-[color:var(--color-green)]"
          aria-hidden="true"
        />
      )
  }
}

// ── Status readout — relocated verbatim (in spirit) from the old overview
// `page.tsx` (Phase 40 Plan 40-07). ISS-06: 'unknown' ALWAYS renders the
// refresh affordance, never a stale label. ─────────────────────────────────
const STATUS_META: Record<Exclude<IssueStatus, 'unknown'>, { label: string; Icon: LucideIcon; color: string }> = {
  draft: { label: 'Draft', Icon: FileEdit, color: 'var(--color-ink-soft)' },
  'needs-review': { label: 'Needs review', Icon: AlertTriangle, color: 'var(--color-marigold-text)' },
  ready: { label: 'Ready to publish', Icon: CheckCircle2, color: 'var(--color-green)' },
  published: { label: 'Published', Icon: BadgeCheck, color: 'var(--color-green)' },
  held: { label: 'Held', Icon: PauseCircle, color: 'var(--color-vermilion)' },
}

function StatusReadout({ status }: { status: IssueStatus }) {
  if (status === 'unknown') {
    return (
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex min-h-[44px] items-center gap-[6px] font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-vermilion)] underline underline-offset-2"
      >
        <AlertTriangle size={16} aria-hidden="true" />
        State unknown — refresh
      </button>
    )
  }
  const meta = STATUS_META[status]
  const StatusIcon = meta.Icon
  return (
    <span
      className="flex items-center gap-[6px] font-[family-name:var(--font-ui)] text-[13px] font-semibold"
      style={{ color: meta.color }}
    >
      <StatusIcon size={16} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

// ── Cost-vs-budget readout (Phase 45 Plan 45-06, REV-05, D-12/D-13/D-15) ────
// Net-new, mounted next to the tasks/minutes line. Never-blank: while
// `runCostUsd` is loading (`undefined`) this renders a refresh affordance —
// NEVER `$0` or a blank — mirroring `StatusReadout`'s 'unknown' pattern above.
function CostBudgetReadout({ runCostUsd, capUsd }: { runCostUsd: number | undefined; capUsd: number }) {
  if (runCostUsd === undefined) {
    return (
      <span
        data-testid="cost-vs-budget"
        className="font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--color-ink-soft)]"
      >
        cost unknown — refresh
      </span>
    )
  }
  return (
    <span
      data-testid="cost-vs-budget"
      className="font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--color-ink)]"
    >
      ${runCostUsd.toFixed(2)} / ${capUsd.toFixed(2)}
    </span>
  )
}

function FrameChrome({ issueNumber: n, children }: { issueNumber: number; children: React.ReactNode }) {
  const pathname = usePathname()
  const { status, stages, tasks, workMinutes, panelContent, runCostUsd, capUsd } =
    useWorkspaceState()
  const setLastVisitedStage = useMutation(api.issues.setLastVisitedStage)

  // Last-visited-stage writer (D-03/D-04) — best-effort, never blocks nav.
  useEffect(() => {
    const segments = pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (!isStageSegment(last)) return
    setLastVisitedStage({
      workspace_id: DEFAULT_WORKSPACE_ID,
      issueNumber: n,
      stage: last,
    }).catch(() => {
      // Tolerated — a failed "remember where I was" write must never block
      // navigation or surface an error to the operator.
    })
  }, [pathname, n, setLastVisitedStage])

  // Phase 49 Plan 08 (ROL-04) — derives the same stage segment the effect
  // above computes, for the persistent Comments affordance's `stage` scope.
  // The bare overview route's last segment is the numeric issueNumber, which
  // never matches a stage segment, so `currentStageSegment` is correctly
  // `undefined` there (an issue-overview-level comment).
  const pathSegments = pathname.split('/').filter(Boolean)
  const lastPathSegment = pathSegments[pathSegments.length - 1]
  const currentStageSegment = isStageSegment(lastPathSegment) ? lastPathSegment : undefined

  return (
    <div className="min-h-screen bg-[color:var(--color-rail)] px-6 py-8 lg:px-8">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
        <Link
          href="/issues"
          className="flex min-h-[44px] w-fit items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)]"
        >
          ← Back to Issues
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-[22px] font-semibold text-[color:var(--color-ink)]">
            Issue {n}
          </h1>
          <div className="flex flex-wrap items-center gap-6">
            <StatusReadout status={status} />
            <span className="font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--color-ink)]">
              {tasks.length} open · ~{workMinutes} min
            </span>
            <CostBudgetReadout runCostUsd={runCostUsd} capUsd={capUsd} />
          </div>
        </div>

        <nav
          aria-label="Workspace stages"
          className="flex flex-wrap gap-2 border-b border-[color:var(--color-faint)] pb-3"
        >
          {STAGE_TABS.map((tab, i) => {
            const href = tab.hrefFor(n)
            const isActive = pathname === href || pathname.startsWith(href + '/')
            // `stages` is a fixed 5-tuple in exact lockstep with STAGE_TABS'
            // 5 entries (both ordered Story/Draft/Fact Check/Voice/Approval);
            // the fallback below only satisfies noUncheckedIndexedAccess —
            // it is never actually reached.
            const stageResult = stages[i] ?? { state: 'not-generated' as const, openCount: 0 }
            const stateLabel = STAGE_STATE_LABELS[stageResult.state]
            const suffix =
              stageResult.state === 'needs-you' && stageResult.openCount > 0
                ? ` · ${stageResult.openCount}`
                : ''
            return (
              <Link
                key={tab.segment}
                href={href}
                data-testid={`workspace-tab-${tab.segment}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-[44px] min-w-[112px] items-center gap-[6px] rounded-[2px] border-b-2 px-[9px] py-[3px] transition-colors',
                  isActive
                    ? 'border-[color:var(--color-cobalt)] text-[color:var(--color-ink)]'
                    : 'border-transparent text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]',
                )}
              >
                <StageTabIcon state={stageResult.state} />
                <span className="flex flex-col leading-tight">
                  <span className="font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.06em]">
                    {tab.label}
                  </span>
                  <span className="font-[family-name:var(--font-ui)] text-[13px]">
                    {stateLabel}
                    {suffix}
                  </span>
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr_300px]">
          <WorkspaceOutline />
          <div className="min-w-0">{children}</div>
          <ContextPanel title="Context">{panelContent}</ContextPanel>
        </div>

        {/*
          Phase 49 Plan 08 (ROL-04) — a PERSISTENT region, separate from
          `ContextPanel` above (whose `panelContent` is replaced per-stage via
          `setPanelContent` and would clobber anything mounted inside it).
          Survives every stage switch because it lives in this shared frame,
          not in `{children}`.
        */}
        <IssueComments issueNumber={n} stage={currentStageSegment} />

        <WorkspaceControls issueNumber={n} />
      </div>
    </div>
  )
}

export default function IssueWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const n = parseIssueNumber(String(params.issueNumber))

  return (
    <WorkspaceStateProvider issueNumber={n}>
      {n === null ? (
        <div className="min-h-screen bg-[color:var(--color-rail)] px-6 py-8 lg:px-8">
          <div className="mx-auto flex max-w-[900px] flex-col gap-3">
            <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
              That isn&rsquo;t a valid issue number.
            </p>
            <Link
              href="/issues"
              className="flex min-h-[44px] w-fit items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)]"
            >
              ← Back to Issues
            </Link>
          </div>
        </div>
      ) : (
        <FrameChrome issueNumber={n}>{children}</FrameChrome>
      )}
    </WorkspaceStateProvider>
  )
}
