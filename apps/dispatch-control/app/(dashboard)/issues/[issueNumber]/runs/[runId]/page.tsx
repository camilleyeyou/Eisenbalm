/**
 * force-dynamic: same reason as run-monitor/runs/[runId]/page.tsx — Convex
 * useQuery in RunDetail requires a live ConvexProvider and must not be
 * statically prerendered.
 */
export const dynamic = 'force-dynamic'

/**
 * Phase 40 (ISS-02, D-08, Plan 40-06 Task 2) — a pipeline run as a
 * HISTORICAL RECORD under its issue.
 *
 * Mirrors run-monitor/runs/[runId]/page.tsx exactly: a Server Component
 * that reads the runId route param and renders the existing `RunDetail`
 * Client Component, unmodified (no rewrite of run-monitor internals). The
 * only addition here is the issue-keyed URL shape plus a back link to the
 * issue overview (D-09) — a run is reachable HERE, under its issue, never
 * as a top-level editorial destination.
 *
 * quick 260722-v01 (audit item 9): header + back-link typography/color
 * migrated onto the `var(--color-*)` / bracket-pixel system — no structural
 * change.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { parseIssueNumber, issueHref } from '@/lib/issueRouteResolver'
import RunDetail from '../../../../run-monitor/runs/_components/RunDetail'

interface IssueRunDetailPageProps {
  params: Promise<{ issueNumber: string; runId: string }>
}

export default async function IssueRunDetailPage({ params }: IssueRunDetailPageProps) {
  const { issueNumber: rawIssueNumber, runId } = await params
  const n = parseIssueNumber(rawIssueNumber)
  if (n === null) redirect('/issues')

  return (
    <div className="space-y-4">
      <Link
        href={issueHref(n)}
        className="font-[family-name:var(--font-ui)] text-[11px] font-medium text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
      >
        ← Back to Issue {n}
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-[20px] font-semibold text-[color:var(--color-ink)]">
        Run Detail — Issue {n}
      </h1>
      <RunDetail runId={runId} />
    </div>
  )
}
