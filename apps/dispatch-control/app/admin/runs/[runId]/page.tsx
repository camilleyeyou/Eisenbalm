/**
 * force-dynamic: BehindRun uses Convex useQuery and needs a live
 * ConvexProvider; it must not be statically prerendered.
 *
 * Phase 56-09: Behind-Run replaces the old run page.
 */
export const dynamic = 'force-dynamic'
export const metadata = { title: 'What happened' }

import BehindRun from '../_components/BehindRun'

interface BehindRunPageProps {
  params: Promise<{ runId: string }>
}

export default async function BehindRunPage({ params }: BehindRunPageProps) {
  const { runId } = await params
  return <BehindRun runId={runId} />
}
