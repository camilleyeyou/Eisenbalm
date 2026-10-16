/**
 * quick 260730-ldn (Task 4) — the `/run` route mount. Formerly the
 * post-login landing page; since Phase 52 `/` is the Issue front door
 * (app/(editorial)/page.tsx) and The Run stays reachable here and as the
 * first Editorial nav item (see lib/nav.ts). Supersedes quick 260730-i4j's `/desk`.
 *
 * A thin route entry, mirroring `my-tasks/page.tsx`'s shape — The Run is a
 * nav destination that self-resolves the current issue client-side (via
 * `useCurrentRun()`), so no server-side param resolution is needed here.
 *
 * force-dynamic: Convex `useQuery` subscriptions require a live
 * ConvexProvider (same rationale as every other dashboard route).
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import RunScreen from './_components/RunScreen'

export const metadata: Metadata = { title: 'The Run' }

export default function RunPage() {
  return <RunScreen />
}
