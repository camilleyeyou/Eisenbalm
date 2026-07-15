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

import MyTasksScreen from './_components/MyTasksScreen'

export default function MyTasksPage() {
  return <MyTasksScreen />
}
