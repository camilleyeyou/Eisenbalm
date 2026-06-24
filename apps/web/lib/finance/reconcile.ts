/**
 * Phase 27 — RCN-01: financial reconciliation pure helpers.
 *
 * Per docs/API_CONTRACTS.md §27.1–§27.2. Reconciliation is computed from
 * ACTUAL recorded stripeOrders rows — gross from amountTotal, net from
 * donationAmount, fee from the cached/fetched Stripe fee — NEVER from
 * model_pricing (D-08). model_pricing is a projection rendered read-only.
 *
 * Both helpers are pure and unit-tested by
 * apps/web/__tests__/stripe-reconciliation.test.ts (Wave 0 scaffold).
 */

/** One order contributing to a reconciliation. */
export type ReconcileOrder = {
  sessionId: string
  charitySlug?: string
  createdAt?: number
  amountTotal: number // gross charged, cents
  amountSubtotal?: number
  donationAmount?: number // == amountSubtotal, the 100%-to-charity figure, cents
}

/** Map of sessionId → cached Stripe fee (cents). Missing entries => fee unfetched. */
export type FeeMap = Record<string, number>

export type ReconcileResult = {
  orderCount: number
  grossCents: number
  netCents: number
  feeCents: number | null // null when any contributing order's fee is unfetched
}

/**
 * Aggregate gross / net / fee for a set of orders.
 *
 * - grossCents = sum(amountTotal)
 * - netCents   = sum(donationAmount) (== amountSubtotal, 100%-to-charity)
 * - feeCents   = sum(fees[sessionId]); null if ANY order's fee is missing from
 *   the fee map (the UI shows "—" until every contributing fee is fetched).
 *
 * For a clean order set, gross − fee === net (the 100%-to-charity identity).
 */
export function reconcileIssue(
  orders: ReconcileOrder[],
  fees: FeeMap = {},
): ReconcileResult {
  let grossCents = 0
  let netCents = 0
  let feeCents: number | null = 0

  for (const order of orders) {
    grossCents += order.amountTotal ?? 0
    netCents += order.donationAmount ?? 0

    if (feeCents !== null) {
      const fee = fees[order.sessionId]
      if (fee === undefined) {
        feeCents = null // any uncached fee poisons the whole sum
      } else {
        feeCents += fee
      }
    }
  }

  return {
    orderCount: orders.length,
    grossCents,
    netCents,
    feeCents,
  }
}

/** A published issue's attribution window seed (upper bound derived at runtime). */
export type IssueWindow = {
  issueNumber: number
  issueId?: string
  charitySlug: string
  publishedAt: number
}

/** An order, reduced to the fields needed for window attribution. */
export type AttributableOrder = {
  charitySlug?: string
  createdAt: number
}

export type AttributionResult = {
  issueNumber: number | null
  bucket: string // the matched issueNumber as a label, or 'unattributed'
}

/**
 * Attribute an order to a published-issue sales window (D-10).
 *
 * Issues are ordered by publishedAt; each issue's window is
 * `[publishedAt, nextPublishedAt)`. The LATEST issue's window is open — its
 * upper bound is `now` (defaults to Date.now() so callers can pass a fixed
 * instant for deterministic tests).
 *
 * An order matches when `order.charitySlug === issue.charitySlug` AND
 * `order.createdAt ∈ [windowStart, windowEnd)`. Lower bound is inclusive,
 * upper bound exclusive. Unmatched orders fall into the 'unattributed' bucket.
 */
export function attributeOrderToWindow(
  order: AttributableOrder,
  issues: IssueWindow[],
  now: number = Date.now(),
): AttributionResult {
  const sorted = [...issues].sort((a, b) => a.publishedAt - b.publishedAt)

  for (let i = 0; i < sorted.length; i++) {
    const issue = sorted[i]
    if (!issue) continue
    const next = sorted[i + 1]
    const windowStart = issue.publishedAt
    const windowEnd = next ? next.publishedAt : now

    if (
      order.charitySlug === issue.charitySlug &&
      order.createdAt >= windowStart &&
      order.createdAt < windowEnd
    ) {
      return { issueNumber: issue.issueNumber, bucket: String(issue.issueNumber) }
    }
  }

  return { issueNumber: null, bucket: 'unattributed' }
}
