'use client'
/**
 * Quick 261022-cr6 (client bug 4) — "Issue N — Charity · date" for one run.
 * Per-row subscriptions are fine: the default runs views render only recent rows.
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { formatRunLabel } from './runLabels'

/** `undefined` while loading. */
export function useRunLabel(runId: string, startedAt: number): string | undefined {
  const pipelineRun = useQuery(api.pipelineRuns.byRunId, { runId })
  const pitch = useQuery(api.pitchLog.selectedByRunId, { runId })
  if (pipelineRun === undefined || pitch === undefined) return undefined
  return formatRunLabel({
    issueNumber: pipelineRun?.issueNumber ?? null,
    charityName: pitch?.charityName ?? null,
    startedAt,
  })
}
