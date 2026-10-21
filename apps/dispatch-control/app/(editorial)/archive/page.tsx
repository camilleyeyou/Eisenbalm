'use client'
/**
 * Quick 261021-j83 — `/archive`: data wrapper for the editorial archive.
 * One `listWithTitles` subscription; held rows keep Release (HeldIssueRow);
 * the old "verification record" disclosure (facts cleared / voice approved
 * by) was dropped: sign-offs no longer exist, so every row would read blank.
 * No start/create panels: the front door owns the single Start button.
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { useCurrentRun } from '@/lib/useCurrentRun'
import { relativeWeekLabel } from '@/lib/issueTitle'
import HeldIssueRow from '../_components/HeldIssueRow'
import { ArchiveBody, type ArchiveRow } from './_components/ArchiveBody'

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

  return (
    <ArchiveBody
      rows={rows}
      currentIssueNumber={run.issueNumber}
      heldSlot={heldSlot}
    />
  )
}
