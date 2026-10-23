/**
 * Phase 56 — `/` is the editor's front door: the slab, the issue, its four
 * stations and nine parts. `/?run=<id>` opens a past issue's Home view.
 * force-dynamic: Convex useQuery needs a live provider.
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import IssueHome from './_components/IssueHome'

export const metadata: Metadata = { title: "This week's issue" }

export default async function IssueHomePage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string | string[] }>
}) {
  const sp = await searchParams
  const run = Array.isArray(sp.run) ? sp.run[0] : sp.run
  return <IssueHome runId={run ?? null} />
}
