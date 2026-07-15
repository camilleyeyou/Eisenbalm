'use client'
/**
 * Phase 41 Plan 41-05 (WSP-02/WSP-03/WSP-07) — WorkspaceStateProvider.
 *
 * The ONE place the Issue Workspace's Convex subscriptions + derivation
 * live (41-RESEARCH Pattern 1 / Pitfall 3). Every consumer inside the frame
 * (stage tabs, outline, context panel, persistent controls — Plans
 * 41-06/41-09) reads from `useWorkspaceState()` instead of re-subscribing to
 * the same eight Convex queries independently.
 *
 * The subscription + normalization + derivation block below is lifted
 * verbatim from `issues/[issueNumber]/page.tsx` (Phase 40 Plan 40-07, lines
 * ~116-161): the same eight queries, the same `signOffs`
 * `{}`-on-resolved-no-run normalization, and the same claimRows
 * text->claimText mapping.
 *
 * BLOCKER FIX (plan review — non-negotiable): the outline's per-section "is
 * this generated" signal must come from the SAME authoritative source the
 * Stage-2 canvas reads — `getDraft(runId, token)` — never from
 * qaCorrections/claimChecks side-tables (a clean, claim-less, finding-less
 * section legitimately has no side-table rows and must never be inferred
 * "not generated" from their absence). This provider fetches the draft the
 * same way `ReviewDeskRunView.reloadDraft` does and derives `sectionStates`
 * from `draftSectionIdsFromDraft(draft)` (the 41-01 shared presence
 * source — the SAME source the canvas uses). While the draft is loading OR
 * the fetch failed, `sectionStates` stays `undefined` — it is NEVER an
 * empty set, which would silently mislabel every section 'not-generated'
 * (the mirror-image of the WSP-07 "never silently clean" concern).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery } from 'convex/react'
import { useAuth } from '@clerk/nextjs'
import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import {
  deriveIssueStatus,
  deriveStageStates,
  deriveSectionStates,
  deriveTasks,
  estimateWorkMinutes,
  draftSectionIdsFromDraft,
  type DerivationInputs,
  type IssueStatus,
  type SectionStateResult,
  type DerivedTask,
} from '@/lib/derivedState'
import { getDraft, ContentPatchError, type DraftResponse } from '@/lib/contentPatchClient'

export interface WorkspaceStateValue {
  issueNumber: number | null
  runId: string | null
  held: boolean
  published: boolean
  status: IssueStatus
  stages: ReturnType<typeof deriveStageStates>
  /**
   * `undefined` while the authoritative draft is loading or failed to load
   * — never an inferred empty set (the blocker fix above). Consumers
   * (WorkspaceOutline, Plan 41-05 Task 2) MUST render a loading state when
   * this is `undefined`, never a wall of "not generated".
   */
  sectionStates: Record<string, SectionStateResult> | undefined
  tasks: DerivedTask[]
  workMinutes: number
  history: Doc<'pipelineRuns'>[] | undefined
  issue: Doc<'issues'> | null | undefined
}

const WorkspaceStateContext = createContext<WorkspaceStateValue | null>(null)

interface WorkspaceStateProviderProps {
  issueNumber: number | null
  children: ReactNode
}

export function WorkspaceStateProvider({
  issueNumber: n,
  children,
}: WorkspaceStateProviderProps) {
  const { getToken } = useAuth()

  // ── The exact subscription block lifted from issues/[issueNumber]/page.tsx ──
  // Queries are 'skip'-guarded on `n === null` / `runId === null` — hooks are
  // always called; only the query itself is skipped.
  const issue = useQuery(
    api.issues.byIssueNumber,
    n !== null ? { workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n } : 'skip',
  )
  const run = useQuery(api.pipelineRuns.byIssueNumber, n !== null ? { issueNumber: n } : 'skip')
  const history = useQuery(
    api.pipelineRuns.listByIssueNumber,
    n !== null ? { issueNumber: n } : 'skip',
  )

  const runLookupResolved = n === null || run !== undefined
  const runId: string | null = run?.runId ?? null

  const signOffsRaw = useQuery(api.signOffs.activeByRunId, runId ? { runId } : 'skip')
  const claimRowsRaw = useQuery(api.claimChecks.listByRunId, runId ? { runId } : 'skip')
  const qaFindings = useQuery(api.qaCorrections.byRunId, runId ? { runId } : 'skip')
  const pitchRows = useQuery(api.pitchLog.byRunId, runId ? { runId } : 'skip')
  const runRow = useQuery(api.runs.byRunId, runId ? { runId } : 'skip')

  // Same normalization as the overview page (Phase 40 Plan 40-07): once the
  // run lookup has genuinely resolved to "no run", `signOffs` becomes
  // loaded-and-empty `{}` rather than staying the raw `undefined` a skipped
  // query produces — otherwise a brand-new issue with no run yet would show
  // `status === 'unknown'` forever instead of 'draft'.
  const signOffs = !runLookupResolved ? undefined : runId === null ? {} : signOffsRaw

  const claimRows = claimRowsRaw?.map(row => ({
    _id: row._id,
    status: row.status,
    sourceUrl: row.sourceUrl,
    sectionName: row.sectionName,
    claimText: row.text,
  }))

  const derivationInputs: DerivationInputs = {
    issueNumber: n,
    runId,
    issue:
      issue === undefined
        ? undefined
        : issue === null
          ? null
          : { held: issue.held, published: issue.published },
    signOffs,
    claimRows,
    qaFindings,
    pitchRows,
    runStatus: runRow?.status,
  }

  const status = deriveIssueStatus(derivationInputs)
  const stages = deriveStageStates(derivationInputs)
  const tasks = deriveTasks(derivationInputs)
  const workMinutes = estimateWorkMinutes(tasks)

  // ── The authoritative-draft fetch (the blocker fix) ─────────────────────
  // Mirrors ReviewDeskRunView's reloadDraft: getDraft(runId, token), token
  // from useAuth().getToken(). Guarded on runId === null. `draft` stays
  // `null` while loading/on error, so `sectionStates` below stays
  // `undefined` in both cases — never an inferred empty set.
  const [draft, setDraft] = useState<DraftResponse | null>(null)

  useEffect(() => {
    if (runId === null) {
      setDraft(null)
      return
    }
    let cancelled = false
    async function load() {
      try {
        const token = await getToken()
        const result = await getDraft(runId as string, token)
        if (!cancelled) setDraft(result)
      } catch (e) {
        if (!cancelled) {
          setDraft(null)
          // Non-fatal by design (mirrors ReviewDeskRunView) — the outline
          // simply keeps showing its loading state; a future task-carrying
          // plan may surface this message directly.
          void (e instanceof ContentPatchError ? e.message : e instanceof Error ? e.message : e)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [runId, getToken])

  const sectionStates = draft
    ? deriveSectionStates(derivationInputs, draftSectionIdsFromDraft(draft))
    : undefined

  const value: WorkspaceStateValue = {
    issueNumber: n,
    runId,
    held: issue?.held ?? false,
    published: issue?.published ?? false,
    status,
    stages,
    sectionStates,
    tasks,
    workMinutes,
    history,
    issue,
  }

  return (
    <WorkspaceStateContext.Provider value={value}>{children}</WorkspaceStateContext.Provider>
  )
}

/** Throws if used outside a `<WorkspaceStateProvider>` — no silent `undefined` reads. */
export function useWorkspaceState(): WorkspaceStateValue {
  const ctx = useContext(WorkspaceStateContext)
  if (ctx === null) {
    throw new Error('useWorkspaceState must be used within a WorkspaceStateProvider')
  }
  return ctx
}
