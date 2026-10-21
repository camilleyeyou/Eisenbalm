'use client'
/**
 * Quick 261021-j83 — `/archive`: data wrapper for the editorial archive.
 * One `listWithTitles` subscription; held rows keep Release (HeldIssueRow);
 * a bounded verification disclosure lists recently published issues.
 * No start/create panels: the front door owns the single Start button.
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { useCurrentRun } from '@/lib/useCurrentRun'
import { relativeWeekLabel } from '@/lib/issueTitle'
import HeldIssueRow from '../_components/HeldIssueRow'
import RecentlyPublishedRow from '../_components/RecentlyPublishedRow'
import { ArchiveBody, type ArchiveRow } from './_components/ArchiveBody'

// ── RecentlyPublishedRowContainer — bounded per-row subscription, accepted ──
// (pre-existing, capped at 5 rows). Narrowed prop type (not `Doc<'issues'>`)
// since the wrapper now sources rows from `listWithTitles`, not
// `listForWorkspace` — only `issueNumber`/`publishedAt` are ever read here.

function RecentlyPublishedRowContainer({
  issue,
}: {
  issue: { issueNumber: number; publishedAt?: number }
}) {
  const run = useQuery(api.pipelineRuns.byIssueNumber, { issueNumber: issue.issueNumber })
  const runId = run?.runId ?? null

  const signOffs = useQuery(api.signOffs.activeByRunId, runId ? { runId } : 'skip')
  const claimSummary = useQuery(api.claimChecks.allSignedOff, runId ? { runId } : 'skip')

  return (
    <RecentlyPublishedRow
      issue={{ issueNumber: issue.issueNumber, publishedAt: issue.publishedAt }}
      verification={{
        total: claimSummary?.total ?? 0,
        contradicted: claimSummary?.blocking ?? 0,
        factsClearedBy: signOffs?.['facts-cleared']?.actorId,
        factsClearedAt: signOffs?.['facts-cleared']?.signedAt,
        voiceApprovedBy: signOffs?.['sounds-human']?.actorId,
        voiceApprovedAt: signOffs?.['sounds-human']?.signedAt,
      }}
    />
  )
}

export default function ArchivePage() {
  const run = useCurrentRun()
  const issuesList = useQuery(api.issues.listWithTitles, { workspace_id: DEFAULT_WORKSPACE_ID })

  const now = Date.now()
  const rows: ArchiveRow[] = (issuesList ?? []).map(issue => ({
    issueNumber: issue.issueNumber,
    title: issue.title,
    dek: issue.held ? (issue.heldReason ?? '') : issue.runId === null ? '' : (issue.subtitle ?? ''),
    hasDrafts: issue.hasDrafts,
    runId: issue.runId,
    published: issue.published,
    held: issue.held,
    relativeWeek: relativeWeekLabel(issue.runStartedAt ?? issue.publishedAt ?? issue.createdAt, now),
  }))

  const heldIssues = (issuesList ?? []).filter(i => i.held && !i.published)
  const publishedIssues = (issuesList ?? [])
    .filter(i => i.published)
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .slice(0, 5)

  const heldSlot =
    heldIssues.length > 0 ? (
      <div className="mt-2 flex flex-col gap-1 border-t border-[color:var(--color-ink)]/[.08] pt-2">
        <span className="font-[family-name:var(--font-ui)] text-[10.5px] uppercase tracking-[.06em] text-[color:var(--color-faint)]">
          Reopen
        </span>
        {heldIssues.slice(0, 8).map(issue => (
          <HeldIssueRow key={issue._id} issue={issue} />
        ))}
        {heldIssues.length > 8 && (
          <p className="font-[family-name:var(--font-ui)] text-[11px] text-[color:var(--color-ink-soft)]">
            +{heldIssues.length - 8} more held
          </p>
        )}
      </div>
    ) : undefined

  const verificationSlot =
    publishedIssues.length > 0 ? (
      <details className="border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-4">
        <summary className="cursor-pointer font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
          Verification record — recently published
        </summary>
        <div className="mt-2 flex flex-col gap-1">
          {publishedIssues.map(issue => (
            <RecentlyPublishedRowContainer key={issue._id} issue={issue} />
          ))}
        </div>
      </details>
    ) : undefined

  return (
    <ArchiveBody
      rows={rows}
      currentIssueNumber={run.issueNumber}
      heldSlot={heldSlot}
      verificationSlot={verificationSlot}
    />
  )
}
