/**
 * quick 260730-i4j (Task 1d) — the /desk route mount. The front door: root
 * redirects here (see app/(dashboard)/page.tsx) and it is the first
 * Editorial nav item (see lib/nav.ts).
 *
 * A thin route entry, mirroring `my-tasks/page.tsx`'s shape — the Desk is a
 * nav destination that self-resolves the current issue client-side (same
 * `issues.listForWorkspace` -> in-progress-issue resolution `issues/page.tsx`
 * already uses), so no server-side param resolution is needed here.
 *
 * force-dynamic: Convex `useQuery` subscriptions require a live
 * ConvexProvider (same rationale as every other dashboard route).
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import DeskScreen from './_components/DeskScreen'

export const metadata: Metadata = { title: 'Desk' }

export default function DeskPage() {
  return <DeskScreen />
}
