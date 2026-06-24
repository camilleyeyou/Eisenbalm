/**
 * Finance — Phase 27 RCN-01/RCN-02.
 *
 * Replaces the placeholder with the approved 27-UI-SPEC finance view, stacked
 * vertically (space-y-4):
 *   1. FinanceSummaryCard — "This Issue" gross/fees/net anchor (primary)
 *   2. IssueRevenueTable  — per-issue reconciliation + inline mark-sent payouts
 *   3. ModelPricingCard   — read-only Projection Pricing + 30-day staleness badge
 *
 * Each section loads independently via Convex subscriptions (no full-page
 * spinner). Figures are computed from ACTUAL stripeOrders, never model_pricing.
 *
 * force-dynamic: Convex useQuery subscriptions require a live ConvexProvider
 * context — static prerendering (no Convex URL in CI) would throw without this.
 */
export const dynamic = 'force-dynamic'

import { getCurrentWorkspace } from '@/lib/workspace'
import FinanceSummaryCard from './_components/FinanceSummaryCard'
import IssueRevenueTable from './_components/IssueRevenueTable'
import ModelPricingCard from './_components/ModelPricingCard'

export default async function FinancePage() {
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Finance</h1>
      <FinanceSummaryCard workspace_id={workspace_id} />
      <IssueRevenueTable workspace_id={workspace_id} />
      <ModelPricingCard workspace_id={workspace_id} />
    </div>
  )
}
