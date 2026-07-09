/**
 * force-dynamic: Convex useQuery subscriptions (in SignalDeskScreen) require
 * a live ConvexProvider context — static prerendering throws without this
 * (same reasoning as run-monitor/graph/page.tsx).
 */
export const dynamic = 'force-dynamic'

/**
 * Phase 37 (SIG-01/02/03) — Signal Desk (Server Component).
 *
 * Resolves the workspace_id server-side and passes it to the Client
 * Component shell. All Convex subscriptions (useQuery) live in
 * SignalDeskScreen — this page stays a Server Component, mirroring
 * run-monitor/graph/page.tsx's split.
 *
 * Replaces the Phase 30 placeholder stub: this is the Gate 1 candidate
 * slate (SIG-01), the decision panel (SIG-02), and — when the run is paused
 * at Gate 1 — the adjudication surface (SIG-03).
 */
import { getCurrentWorkspace } from '@/lib/workspace'
import { SignalDeskScreen } from './_components/SignalDeskScreen'

export default async function SignalDeskPage() {
  const workspace_id = await getCurrentWorkspace()

  return <SignalDeskScreen workspace_id={workspace_id} />
}
