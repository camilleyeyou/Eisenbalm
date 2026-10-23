'use client'
/** Phase 56-08 — data wrapper for "Behind the scenes". */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { useCurrentRun } from '@/lib/useCurrentRun'
import { deriveRunCostUsd } from '@/lib/derivedState'
import { COPY, deriveBehindSteps, formatCostLine, runStatusWord } from '@/lib/editorState'
import { formatIssueLine } from '@/lib/issueTitle'
import { ADMIN_ITEMS } from '@/lib/nav'
import BehindHubView from './BehindHubView'

export default function BehindHub() {
  const cr = useCurrentRun()
  const runId = cr.runId
  const agentRuns = useQuery(api.agentRuns.byRunId, runId ? { runId } : 'skip')
  const corrections = useQuery(api.qaCorrections.byRunId, runId ? { runId } : 'skip')
  const runStatus = cr.derivationInputs.runStatus
  const none = cr.state.kind === 'none'

  const steps = none
    ? []
    : deriveBehindSteps({ agentRuns, runStatus, fixCount: corrections?.length })
  const cost = deriveRunCostUsd(agentRuns)
  const costLine = none
    ? null
    : formatCostLine({
        costUsd: cost,
        startedAt: cr.runRow?.startedAt,
        completedAt: cr.runRow?.completedAt,
        mode: runStatus === 'cancelled' || runStatus === 'failed' ? 'stopped' : 'finished',
      })

  const word = runStatusWord({ status: runStatus ?? '' })
  const slabSentence =
    word === 'Problem'
      ? 'This issue hit a problem and stopped. Nothing reached readers.'
      : word === 'Working'
        ? "Nothing here needs you. The writers are working on this week's issue."
        : COPY.behindSlab

  const issueLine = cr.issueNumber == null
    ? null
    : formatIssueLine({ issueNumber: cr.issueNumber, runStartedAt: cr.runRow?.startedAt })

  return (
    <BehindHubView
      slabSentence={slabSentence}
      issueLine={issueLine}
      steps={steps}
      costLine={costLine}
      items={ADMIN_ITEMS}
    />
  )
}
