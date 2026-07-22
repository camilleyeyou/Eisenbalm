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
 * source — the SAME source the canvas uses).
 *
 * THREE-WAY DRAFT OUTCOME (quick 260720-ig5 — supersedes the original
 * two-way "undefined on load-or-fail" design above): a definitive
 * `ContentPatchError` with `reason === 'no_sanity_issue'` (a run that never
 * got past Gate 1, e.g. a paused-at-Gate-1 run — quick 260719-w6o) is NOT
 * "still loading" — it is a resolved, honest "there is no content" outcome.
 * Conflating the two produced a perpetual "Loading outline…" spinner for
 * every contentless run. `sectionStates` STILL stays `undefined` while
 * loading OR on any OTHER failure (never an inferred empty set — the
 * mirror-image of the WSP-07 "never silently clean" concern, unchanged).
 * The `no_sanity_issue` case is instead surfaced via the separate
 * `draftContentAbsent` boolean below, scoped STRICTLY to that one reason so
 * every other error (network blip, generic Error, any other
 * ContentPatchError reason) still leaves the outline on "Loading outline…"
 * (the original WSP-07 transient-failure intent, preserved).
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
  deriveRunCostUsd,
  deriveRunCapUsd,
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
   * `undefined` while the authoritative draft is loading OR the fetch failed
   * for a reason OTHER than a definitive `no_sanity_issue` 409 — never an
   * inferred empty set (the blocker fix above). Consumers (WorkspaceOutline,
   * Plan 41-05 Task 2) MUST render a loading state when this is `undefined`,
   * never a wall of "not generated". See `draftContentAbsent` below for the
   * third, definitively-contentless outcome (quick 260720-ig5).
   */
  sectionStates: Record<string, SectionStateResult> | undefined
  /**
   * Quick 260720-ig5 (outline-spins-loading-forever fix) — true ONLY once
   * the authoritative draft fetch has thrown a `ContentPatchError` with
   * `reason === 'no_sanity_issue'` (a definitive "this run never generated
   * content" 409, e.g. a paused-at-Gate-1 run). False while loading, on a
   * successful load, and on every OTHER error (network blip, generic Error,
   * any other `ContentPatchError` reason) — those keep `sectionStates`
   * `undefined` and the outline on "Loading outline…" (the WSP-07 transient
   * guard, unchanged). Reset to `false` at the start of every new run's
   * fetch so a prior run's absent-state never leaks. Consumers
   * (WorkspaceOutline) MUST check this BEFORE the `sectionStates ===
   * undefined` loading branch and render a dedicated honest empty state.
   */
  draftContentAbsent: boolean
  tasks: DerivedTask[]
  workMinutes: number
  history: Doc<'pipelineRuns'>[] | undefined
  issue: Doc<'issues'> | null | undefined
  /**
   * Phase 41 Plan 41-11 (WSP-03 gap closure) — the frame's single persistent
   * ContextPanel content slot. `null` when no mounted stage has published
   * anything; the frame (`layout.tsx`) renders this verbatim inside
   * `<ContextPanel>`. A stage publisher calls `setPanelContent` in an effect
   * (with cleanup that resets to `null` on unmount/stage change) — see Plan
   * 41-12.
   */
  panelContent: ReactNode
  setPanelContent: (content: ReactNode) => void
  /**
   * Phase 45 Plan 45-06 (REV-05, D-12/D-13/D-15) — the header cost-vs-budget
   * readout's source values. `runCostUsd` is `undefined` while the durable
   * `agentRuns:byRunId` rows are loading — consumers (`FrameChrome`) MUST
   * render a refresh affordance in that case, NEVER a stale/fabricated `$0`
   * (never-blank honesty). `capUsd` always has a value (defaults to 10.0
   * until `pipelineConfig:getAll` resolves).
   */
  runCostUsd: number | undefined
  capUsd: number
  /**
   * The four arrays below are the SAME already-subscribed Convex queries this
   * provider derives `stages`/`tasks`/`sectionStates` from (see the
   * subscription block further down in this file) — exposed here so Plan
   * 41-12's stage-panel publishers can reuse them with ZERO new `useQuery`
   * calls (41-CONTEXT D-19 + the gap-closure "no new subscriptions" rule).
   */
  pitchRows: Doc<'pitchLog'>[] | undefined
  qaFindings: DerivationInputs['qaFindings']
  claimRows: DerivationInputs['claimRows']
  signOffs: DerivationInputs['signOffs']
  /**
   * Phase 47 Plan 47-05 (BRF-01/02/03/05) — the Story & Brief stage's three
   * subscriptions, centralized here per the 41-04 single-subscription
   * discipline (no per-component `useQuery`). `storyLeads`/
   * `verificationRecords` are `undefined` while loading/skipped (no `runId`
   * yet); `brief` is `undefined` while loading/skipped and `null` once
   * loaded when `editor_gate_1` hasn't generated one yet (e.g. Gate 1 not
   * resolved) — never inferred from an empty array.
   */
  storyLeads: Doc<'story_leads'>[] | undefined
  verificationRecords: Doc<'verification_records'>[] | undefined
  brief: Doc<'briefs'> | null | undefined
  /**
   * Phase 48 Plan 48-06 (ENT-01/ENT-03, RESEARCH Pattern 4/Pitfall 3) — the
   * run's entry mode, sourced from the ALREADY-subscribed `runRow` (no new
   * `useQuery`). `undefined` while `runRow` is loading/skipped OR when the
   * run predates Phase 48 and never wrote the field — both cases mean
   * "treat as discovery" (mirrors the Convex schema default), never a
   * silent crash for pre-Phase-48 runs.
   */
  entryMode: 'discovery' | 'brief' | undefined
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

  // Phase 47 Plan 47-05 (BRF-01/02/03/05) — Story & Brief stage subscriptions,
  // runId-scoped/'skip'-guarded exactly like pitchRows above.
  const storyLeads = useQuery(api.storyLeads.byRunId, runId ? { runId } : 'skip')
  const verificationRecords = useQuery(
    api.verificationRecords.byRunId,
    runId ? { runId } : 'skip',
  )
  const brief = useQuery(api.briefs.byRunId, runId ? { runId } : 'skip')

  // Phase 48 Plan 48-06 (ENT-01/ENT-03) — derived from the ALREADY-subscribed
  // runRow (L148 above), not a new subscription. Absent/undefined stays
  // undefined here; StoryBriefScreen's `ws.entryMode === 'brief'` check
  // treats undefined the same as 'discovery' (the Convex schema default).
  const entryMode = (runRow?.entryMode as 'discovery' | 'brief' | undefined) ?? undefined

  // Phase 45 Plan 45-06 (REV-05, D-12/D-13/D-15) — the header cost-vs-budget
  // readout's subscriptions. `agentRunRows` sources spend from the durable
  // agent_runs table (never the pipeline's in-memory cost store, which is
  // cleared before any human review stage begins — 45-RESEARCH Pitfall 1).
  // `pipelineConfigRows` sources the cap (per_run_cap_usd, D-12: reuse the
  // existing cost cap, do not invent a second budget system).
  const agentRunRows = useQuery(api.agentRuns.byRunId, runId ? { runId } : 'skip')
  const pipelineConfigRows = useQuery(api.pipelineConfig.getAll, {
    workspace_id: DEFAULT_WORKSPACE_ID,
  })
  const runCostUsd = deriveRunCostUsd(agentRunRows as Array<{ costUsd?: number }> | undefined)
  const capUsd = deriveRunCapUsd(
    pipelineConfigRows as Array<{ key: string; value: string }> | undefined,
  )

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
    // Phase 42 Plan 42-05 (FCT-02, D-16) — severity/summary fields so My
    // Tasks + the stage badges read the SAME data as the Stage 3 screen.
    // Deliberately NOT claimType/context — those are full-row-only, read
    // directly by the Stage 3 screen + Approval SourceIndex (see 42-06
    // Task 3, 42-CONTEXT SCOPE NOTE).
    claimIndex: row.claimIndex,
    claimId: row.claimId,
    importance: row.importance,
    changedSinceCheck: row.changedSinceCheck,
    conflict: row.conflict,
    checkedAt: row.checkedAt,
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
    // Phase 47 Plan 47-08 (Pitfall 3) — threads the run's completedAt so
    // deriveStoryStage can gate its 'needs-you' state on the precise
    // Gate-1-paused predicate (status==='awaiting-review' && completedAt==
    // null) rather than "leads exist and none is selected."
    runCompletedAt: runRow?.completedAt,
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
  //
  // `draftContentAbsent` (quick 260720-ig5) is the THIRD outcome: true ONLY
  // when the fetch threw a `ContentPatchError` whose `reason ===
  // 'no_sanity_issue'` (a definitive contentless-run 409) — reset to false
  // at the top of every fetch so a prior run's absent-state never leaks into
  // a new run, and left false for every other error (the WSP-07 transient
  // guard).
  const [draft, setDraft] = useState<DraftResponse | null>(null)
  const [draftContentAbsent, setDraftContentAbsent] = useState(false)

  useEffect(() => {
    if (runId === null) {
      setDraft(null)
      setDraftContentAbsent(false)
      return
    }
    let cancelled = false
    setDraftContentAbsent(false)
    async function load() {
      try {
        const token = await getToken()
        const result = await getDraft(runId as string, token)
        if (!cancelled) {
          setDraft(result)
          setDraftContentAbsent(false)
        }
      } catch (e) {
        if (!cancelled) {
          setDraft(null)
          setDraftContentAbsent(e instanceof ContentPatchError && e.reason === 'no_sanity_issue')
          // Non-fatal by design (mirrors ReviewDeskRunView) — the outline
          // simply keeps showing its loading state (or, for the definitive
          // no_sanity_issue case above, the honest empty state); a future
          // task-carrying plan may surface this message directly.
          void (e instanceof ContentPatchError ? e.message : e instanceof Error ? e.message : e)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // getToken (Clerk) is a stable accessor called FRESH inside load() and
    // always returns a current token regardless of which reference was
    // captured; including its identity here caused an infinite
    // refetch/re-render loop on CONTENT runs (setDraft stores a fresh object
    // every fetch) when getToken's reference churns — quick 260721-ohu.
    // Depend on runId ONLY; the draft still refetches on run change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  const sectionStates = draft
    ? deriveSectionStates(derivationInputs, draftSectionIdsFromDraft(draft))
    : undefined

  // ── The panel-content slot (Plan 41-11, WSP-03 gap closure) ──────────────
  // A stage publisher calls `setPanelContent` to feed the frame's single
  // persistent ContextPanel; defaults to `null` (the panel's own honest
  // "Nothing to show for this stage yet" placeholder) until one does.
  const [panelContent, setPanelContent] = useState<ReactNode>(null)

  const value: WorkspaceStateValue = {
    issueNumber: n,
    runId,
    held: issue?.held ?? false,
    published: issue?.published ?? false,
    status,
    stages,
    sectionStates,
    draftContentAbsent,
    tasks,
    workMinutes,
    history,
    issue,
    panelContent,
    setPanelContent,
    runCostUsd,
    capUsd,
    pitchRows,
    qaFindings,
    claimRows,
    signOffs,
    storyLeads,
    verificationRecords,
    brief,
    entryMode,
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
