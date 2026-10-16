/**
 * Phase 52 (HOME-01) — `/` is the editor's front door: the current issue,
 * its nine stories, one Publish button. Replaces the (dashboard) redirect
 * stub to /run (deleted in the same commit — two groups owning `/` breaks
 * the build, 1430b98f). The old console stays at its own URLs (/run,
 * /issues, /issues/[n]/approval, …) as the fallback path (Phase 53 SC-4).
 * force-dynamic: Convex useQuery needs a live provider (same as run/page.tsx).
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import IssueHome from './_components/IssueHome'

export const metadata: Metadata = { title: 'This issue' }

export default function IssueHomePage() {
  return <IssueHome />
}
