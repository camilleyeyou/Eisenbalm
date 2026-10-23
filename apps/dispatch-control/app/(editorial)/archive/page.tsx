'use client'
/**
 * Phase 56-07 — `/archive`: data wrapper. Joins issues.listWithTitles with
 * runs.listRecentForWorkspace on the client (no Convex change). Old
 * /issues/:n redirects arrive as ?issue=N and forward to that issue.
 */
import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { deriveArchiveRows } from '@/lib/editorState'
import { issueOpenHref, parseIssueNumber } from '@/lib/issueRouteResolver'
import { ArchiveBody } from './_components/ArchiveBody'

interface ArchiveSearchParams {
  issue?: string | string[]
}

function isThenable<T>(value: unknown): value is Promise<T> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function'
}

function websiteUrlFor(publishedUrl: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_WEB_PREVIEW_BASE
  if (!base || !publishedUrl) return null
  return `${base.replace(/\/$/, '')}${publishedUrl}`
}

export default function ArchivePage({
  searchParams,
}: {
  searchParams?: ArchiveSearchParams | Promise<ArchiveSearchParams>
} = {}) {
  const resolved: ArchiveSearchParams = isThenable<ArchiveSearchParams>(searchParams)
    ? use(searchParams)
    : (searchParams ?? {})
  const issueParam = typeof resolved.issue === 'string' ? parseIssueNumber(resolved.issue) : null
  const router = useRouter()
  const issues = useQuery(api.issues.listWithTitles, { workspace_id: DEFAULT_WORKSPACE_ID })
  const runs = useQuery(api.runs.listRecentForWorkspace, { workspace_id: DEFAULT_WORKSPACE_ID })
  const latest = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })
  const currentRunId = latest?.runId ?? null

  const rows =
    issues === undefined
      ? undefined
      : deriveArchiveRows({
          issues: issues.map((i) => ({
            issueNumber: i.issueNumber,
            title: i.title,
            published: i.published,
            runId: i.runId,
            publishedAt: i.publishedAt,
            runStartedAt: i.runStartedAt,
            scheduledFor: i.scheduledFor,
            slug: i.published ? `issue-${i.issueNumber}` : null,
          })),
          runs,
          currentRunId,
        })

  const target =
    issueParam != null && rows
      ? [...rows.listed, ...rows.unfinished].find((r) => r.issueNumber === issueParam)
      : undefined
  const forwardHref = target && latest !== undefined ? issueOpenHref(target.runId, currentRunId) : null
  useEffect(() => {
    if (forwardHref) router.replace(forwardHref)
  }, [forwardHref, router])

  return <ArchiveBody rows={rows} currentRunId={currentRunId} websiteUrlFor={websiteUrlFor} />
}
