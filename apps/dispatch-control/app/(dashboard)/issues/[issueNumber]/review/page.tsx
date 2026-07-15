/**
 * Phase 41 (D-06, Plan 41-08 Task 1) — legacy `/review` URL redirect.
 *
 * Stage 2 (Draft) now lives at `/issues/[issueNumber]/draft` (this file's
 * sibling `draft/page.tsx`, D-06). This wrapper is retired to a pure
 * redirect so old bookmarked/shared `/review` links keep working —
 * `parseIssueNumber` failure falls back to `/issues` (never a run-keyed
 * URL, which would redirect-loop).
 */
import { redirect } from 'next/navigation'
import { parseIssueNumber, issueDraftHref } from '@/lib/issueRouteResolver'

interface IssueReviewPageProps {
  params: Promise<{ issueNumber: string }>
}

export default async function IssueReviewPage({ params }: IssueReviewPageProps) {
  const { issueNumber: rawIssueNumber } = await params
  const n = parseIssueNumber(rawIssueNumber)
  if (n === null) redirect('/issues')

  redirect(issueDraftHref(n))
}
