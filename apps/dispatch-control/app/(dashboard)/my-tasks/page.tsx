/**
 * Phase 43 Plan 43-05 (TSK-01..TSK-05) — the /my-tasks nav-level screen.
 *
 * A thin route entry. Unlike the issue-keyed screens under
 * `/issues/[issueNumber]/...`, My Tasks is a nav destination that
 * self-resolves the current issue client-side (mirrors Masthead.tsx's
 * `runs.latest -> pipelineRuns.byRunId -> ...` assembly) — no server-side
 * param resolution needed here.
 *
 * force-dynamic: Convex `useQuery` subscriptions require a live
 * ConvexProvider (same rationale as every other dashboard route).
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import MyTasksScreen from './_components/MyTasksScreen'

// quick 260723-4a6 (Task 1e): a Server Component route can export a static
// title directly — composes with app/layout.tsx's `%s — Dispatch Control` template.
export const metadata: Metadata = { title: 'My Tasks' }

export default function MyTasksPage() {
  return <MyTasksScreen />
}
