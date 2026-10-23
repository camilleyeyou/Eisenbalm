'use client'
/** Phase 56-09 — data wrapper for the Behind-Run page. */
import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { deriveRunCostUsd } from '@/lib/derivedState'
import { COPY, deriveBehindSteps, firstProblemStep, formatCostLine } from '@/lib/editorState'
import { isGateInterrupt } from '@/lib/gateInterrupt'
import { formatIssueLine, formatLongDate } from '@/lib/issueTitle'
import { issueOpenHref } from '@/lib/issueRouteResolver'
import { triggerRun, cancelRun } from '@/lib/pipelineControlClient'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { SkeletonLine } from '@/components/ui/Skeleton'
import BehindRunView, { type BehindRunMode } from './BehindRunView'

const TRY_AGAIN = "That didn't go through. Press the button again."

export default function BehindRun({ runId }: { runId: string }) {
  const { getToken } = useAuth()
  const router = useRouter()
  const confirm = useConfirm()
  const latch = useRef(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const run = useQuery(api.runs.byRunId, { runId })
  const pipelineRun = useQuery(api.pipelineRuns.byRunId, { runId })
  const agentRuns = useQuery(api.agentRuns.byRunId, { runId })
  const latest = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })
  const issueNumber = pipelineRun?.issueNumber ?? null
  const issue = useQuery(
    api.issues.byIssueNumber,
    issueNumber != null ? { workspace_id: DEFAULT_WORKSPACE_ID, issueNumber } : 'skip',
  )

  if (run === undefined || agentRuns === undefined || pipelineRun === undefined) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-3">
        <SkeletonLine />
        <SkeletonLine />
        <SkeletonLine />
      </div>
    )
  }
  if (run === null) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-6">
        <p className="font-[family-name:var(--font-body)] text-[17px]">We couldn&rsquo;t find this issue.</p>
        <Link
          href="/admin"
          className="min-h-[48px] px-6 border border-[color:var(--color-ink)] bg-[color:var(--color-card)] font-[family-name:var(--font-ui)] text-[17px] font-semibold inline-flex items-center editor-focus"
        >
          {COPY.backToBehind}
        </Link>
      </div>
    )
  }

  const interrupted =
    agentRuns.some((r) => isGateInterrupt(r)) || (pipelineRun?.errorMessage ?? '').trim().startsWith('Interrupt(')
  let mode: BehindRunMode
  if (run.status === 'complete' || issue?.published) mode = 'published'
  else if (run.status === 'cancelled') mode = 'stopped'
  else if (run.status === 'running') mode = 'working'
  else if (run.status === 'awaiting-review') mode = run.completedAt != null ? 'ready' : 'stuck'
  else mode = interrupted ? 'paused' : 'problem'

  const steps = deriveBehindSteps({ agentRuns, runStatus: run.status })
  const problemKey = steps ? firstProblemStep(steps) : null
  const failingRow = agentRuns.find((r) => r.status === 'failed' && !isGateInterrupt(r) && r.error)
  const interruptRow = agentRuns.find((r) => isGateInterrupt(r))
  const rawError =
    mode === 'paused'
      ? (interruptRow?.error ?? pipelineRun?.errorMessage ?? null)
      : mode === 'problem'
        ? (failingRow?.error ?? pipelineRun?.errorMessage ?? null)
        : null

  const stoppedMode = mode === 'problem' || mode === 'stopped' || mode === 'paused' || mode === 'stuck'
  const costLine = formatCostLine({
    costUsd: deriveRunCostUsd(agentRuns),
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    mode: stoppedMode ? 'stopped' : 'finished',
  })

  const issueLine = formatIssueLine({
    issueNumber,
    publishedAt: issue?.publishedAt,
    scheduledFor: issue?.scheduledFor,
    runStartedAt: run.startedAt,
    published: issue?.published,
  })
  const publishedDay = issue?.publishedAt != null ? formatLongDate(issue.publishedAt).split(' ')[0] : undefined

  const onPrimary = async () => {
    if (latch.current) return
    setActionError(null)
    if (mode === 'problem' || mode === 'stopped') {
      latch.current = true
      setBusy(true)
      try {
        await triggerRun({}, await getToken())
        router.push('/')
      } catch {
        setActionError(COPY.startFailed)
        latch.current = false
      } finally {
        setBusy(false)
      }
      return
    }
    if (mode === 'stuck' || mode === 'paused') {
      const ok = await confirm({
        title: COPY.stopConfirmTitle,
        body: COPY.stopConfirmBody.replace('{issue}', issueLine),
        confirmLabel: COPY.stopConfirm,
        cancelLabel: COPY.stopCancel,
        tone: 'default',
      })
      if (!ok) return
      latch.current = true
      setBusy(true)
      try {
        await cancelRun(runId, await getToken())
      } catch {
        setActionError(TRY_AGAIN)
      } finally {
        setBusy(false)
        latch.current = false
      }
    }
  }

  return (
    <BehindRunView
      mode={mode}
      issueNumber={issueNumber}
      issueLine={issueLine}
      issueHref={issueOpenHref(runId, latest?.runId)}
      steps={steps}
      costLine={costLine}
      problemKey={problemKey}
      rawError={rawError}
      publishedDay={publishedDay}
      onPrimary={onPrimary}
      primaryBusy={busy}
      actionError={actionError}
    />
  )
}
