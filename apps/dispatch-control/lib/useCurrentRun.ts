'use client'
/**
 * quick 260730-ldn (Task 2b) — the ONE subscription assembly for "the
 * current run", consumed by both the Masthead and The Run. Lifts the
 * Masthead's existing wiring here verbatim (a move, not a redesign) and adds
 * the queries The Run additionally needs (the selected-pitch title, claim
 * rows, claim summary, the run row for `formatElapsed`, agent-run costs, and
 * pipeline config for the cost cap).
 *
 * `resolveCurrentRun` (lib/currentRun.ts) is the only place "which issue is
 * current" gets decided — this hook exists purely to assemble the Convex
 * subscriptions that feed it and the derivations that ride alongside it.
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from './workspace'
import { resolveCurrentRun, type CurrentRunState } from './currentRun'
import {
  deriveIssueStatus,
  deriveRunCostUsd,
  deriveRunCapUsd,
  type DerivationInputs,
  type IssueStatus,
} from './derivedState'

// Module-scoped stable empty object (quick 260721-pmn precedent, also used
// by DeskScreen.tsx) — never a fresh `{}` literal per render, which would
// retrigger downstream memoization for no reason.
const EMPTY_SIGNOFFS: Record<string, { actorId: string; signedAt: number }> = {}

export interface UseCurrentRunResult {
  state: CurrentRunState
  runId: string | null
  issueNumber: number | null
  /** `undefined` === still loading. Callers MUST branch on this before
   * treating a `null` title as "confirmed no subject". */
  title: string | null | undefined
  derivationInputs: DerivationInputs
  issueStatus: IssueStatus
  claimSummary: { total: number; signedOff: number; allSignedOff: boolean } | undefined
  signOffs: Record<string, { actorId: string; signedAt: number }> | undefined
  qaFindings: DerivationInputs['qaFindings']
  claimRows: DerivationInputs['claimRows']
  // runs.byRunId — startedAt/completedAt for formatElapsed.
  runRow: { startedAt: number; completedAt?: number } | null | undefined
  runCostUsd: number | undefined
  capUsd: number
  configRows: { key: string; value: string }[] | undefined
}

export function useCurrentRun(): UseCurrentRunResult {
  const latest = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })
  const pipelineRun = useQuery(
    api.pipelineRuns.byRunId,
    latest ? { runId: latest.runId } : 'skip',
  )

  const state = resolveCurrentRun(latest, pipelineRun)
  const runId: string | null = state.kind === 'run' ? state.runId : null
  const issueNumber: number | null = state.kind === 'run' ? state.issueNumber : null

  // The title — the selected pitchLog row for this run.
  const selectedPitch = useQuery(api.pitchLog.selectedByRunId, runId ? { runId } : 'skip')
  const title: string | null | undefined =
    selectedPitch === undefined ? undefined : selectedPitch === null ? null : selectedPitch.charityName

  const issueRow = useQuery(
    api.issues.byIssueNumber,
    issueNumber != null ? { workspace_id: DEFAULT_WORKSPACE_ID, issueNumber } : 'skip',
  )
  const signOffsRaw = useQuery(api.signOffs.activeByRunId, runId ? { runId } : 'skip')
  const claimRowsRaw = useQuery(api.claimChecks.listByRunId, runId ? { runId } : 'skip')
  const claimSummary = useQuery(api.claimChecks.allSignedOff, runId ? { runId } : 'skip')
  const qaFindings = useQuery(api.qaCorrections.byRunId, runId ? { runId } : 'skip')
  const pitchRows = useQuery(api.pitchLog.byRunId, runId ? { runId } : 'skip')
  const runRow = useQuery(api.runs.byRunId, runId ? { runId } : 'skip')
  const agentRunsRows = useQuery(api.agentRuns.byRunId, runId ? { runId } : 'skip')
  const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id: DEFAULT_WORKSPACE_ID })

  // signOffs normalization (ISS-06 discipline, identical to Masthead's prior
  // wiring): leave `undefined` while the run lookup is genuinely unresolved
  // (state.kind === 'loading') so downstream derivations correctly render a
  // loading state. Once state.kind === 'none' is CONFIRMED, hand
  // deriveIssueStatus the stable EMPTY_SIGNOFFS constant.
  const signOffs =
    state.kind === 'loading' ? undefined : state.kind === 'none' ? EMPTY_SIGNOFFS : signOffsRaw

  const claimRows = claimRowsRaw?.map(row => ({
    _id: row._id,
    status: row.status,
    sourceUrl: row.sourceUrl,
    sectionName: row.sectionName,
    claimText: row.text,
  }))

  const derivationInputs: DerivationInputs = {
    issueNumber,
    runId,
    issue:
      issueRow === undefined ? undefined : issueRow ? { held: issueRow.held, published: issueRow.published } : null,
    signOffs,
    claimRows,
    qaFindings,
    pitchRows,
    runStatus: latest?.status,
    runStartedAt: latest?.startedAt,
    runCompletedAt: latest?.completedAt,
  }

  const issueStatus = deriveIssueStatus(derivationInputs)
  const runCostUsd = deriveRunCostUsd(agentRunsRows)
  const capUsd = deriveRunCapUsd(configRows)

  return {
    state,
    runId,
    issueNumber,
    title,
    derivationInputs,
    issueStatus,
    claimSummary,
    signOffs,
    qaFindings,
    claimRows,
    runRow,
    runCostUsd,
    capUsd,
    configRows,
  }
}
