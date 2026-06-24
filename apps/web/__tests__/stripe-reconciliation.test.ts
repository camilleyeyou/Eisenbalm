/**
 * Phase 27 — Money + Notifications: Wave 0 RED scaffold (RCN-01).
 *
 * Covers the financial-reconciliation helpers specified in
 * docs/API_CONTRACTS.md §27.1–§27.2:
 *   - reconcileIssue(orders, fees): gross/net/fee aggregation + the
 *     gross − fee === net arithmetic identity for a clean order set.
 *   - attributeOrderToWindow(order, issues): sales-window attribution by
 *     charitySlug + createdAt within [publishedAt, nextPublishedAt); the
 *     latest issue uses an open window (Date.now() upper bound); orders
 *     outside all windows fall into the 'unattributed' bucket (D-10).
 *
 * RED-by-design: the production helpers below do NOT exist yet. These import
 * paths ARE the contract the Wave 2 finance plan implements
 * (`apps/web/lib/finance/reconcile.ts`). Until that lands this file is RED —
 * that is correct Wave 0 behavior. If this fails, do NOT delete or weaken it;
 * implement the helpers to satisfy these assertions.
 *
 * Requirements covered: RCN-01 (gross/net/fee + sales-window attribution).
 */
import { describe, it, expect } from 'vitest'

// @ts-expect-error — Wave 2 (plan 27-02) creates apps/web/lib/finance/reconcile.ts.
import { reconcileIssue, attributeOrderToWindow } from '@/lib/finance/reconcile'

// ─── Fixtures (explicit cent values) ────────────────────────────────────────
// gross 899 = net 850 + fee 49  →  the 100%-to-charity identity holds per order.
const ORDERS = [
  { sessionId: 'cs_test_a', charitySlug: 'nap-ministry', createdAt: 1_000, amountTotal: 899, amountSubtotal: 850, donationAmount: 850 },
  { sessionId: 'cs_test_b', charitySlug: 'nap-ministry', createdAt: 2_000, amountTotal: 899, amountSubtotal: 850, donationAmount: 850 },
]
const FEES = {
  cs_test_a: 49,
  cs_test_b: 49,
}

// ─── RCN-01: reconcileIssue aggregation + arithmetic identity ───────────────

describe('RCN-01: reconcileIssue gross/net/fee aggregation', () => {
  it('grossCents = sum(amountTotal)', () => {
    const r = reconcileIssue(ORDERS, FEES)
    expect(r.grossCents).toBe(899 + 899)
  })

  it('netCents = sum(donationAmount) (== amountSubtotal, 100%-to-charity)', () => {
    const r = reconcileIssue(ORDERS, FEES)
    expect(r.netCents).toBe(850 + 850)
  })

  it('feeCents = sum(stripeFee)', () => {
    const r = reconcileIssue(ORDERS, FEES)
    expect(r.feeCents).toBe(49 + 49)
  })

  it('gross − fee === net for a clean order set (arithmetic identity)', () => {
    const r = reconcileIssue(ORDERS, FEES)
    expect(r.grossCents - r.feeCents).toBe(r.netCents)
  })

  it('orderCount reflects the number of contributing orders', () => {
    const r = reconcileIssue(ORDERS, FEES)
    expect(r.orderCount).toBe(2)
  })

  it('feeCents is null when any contributing order fee is unfetched', () => {
    const r = reconcileIssue(ORDERS, { cs_test_a: 49 }) // cs_test_b fee missing
    expect(r.feeCents).toBeNull()
  })
})

// ─── RCN-01 / D-10: sales-window attribution ────────────────────────────────

describe('RCN-01 (D-10): attributeOrderToWindow sales-window attribution', () => {
  // issue 1 window: [1000, 5000); issue 2 (latest) window: [5000, Date.now())
  const ISSUES = [
    { issueNumber: 1, issueId: 'iss_1', charitySlug: 'nap-ministry', publishedAt: 1_000 },
    { issueNumber: 2, issueId: 'iss_2', charitySlug: 'free-press', publishedAt: 5_000 },
  ]

  it('attributes an order by charitySlug + createdAt within [publishedAt, nextPublishedAt)', () => {
    const order = { charitySlug: 'nap-ministry', createdAt: 2_500 }
    const result = attributeOrderToWindow(order, ISSUES)
    expect(result.issueNumber).toBe(1)
  })

  it('the latest issue uses an open window (Date.now() upper bound)', () => {
    const order = { charitySlug: 'free-press', createdAt: Date.now() - 1 }
    const result = attributeOrderToWindow(order, ISSUES)
    expect(result.issueNumber).toBe(2)
  })

  it('the window lower bound is inclusive (createdAt === publishedAt attributes to that issue)', () => {
    const order = { charitySlug: 'nap-ministry', createdAt: 1_000 }
    const result = attributeOrderToWindow(order, ISSUES)
    expect(result.issueNumber).toBe(1)
  })

  it('an order before all windows returns the unattributed bucket', () => {
    const order = { charitySlug: 'nap-ministry', createdAt: 500 }
    const result = attributeOrderToWindow(order, ISSUES)
    expect(result.issueNumber).toBeNull()
    expect(result.bucket).toBe('unattributed')
  })

  it('an order whose charitySlug matches no issue window returns the unattributed bucket', () => {
    const order = { charitySlug: 'unknown-charity', createdAt: 2_500 }
    const result = attributeOrderToWindow(order, ISSUES)
    expect(result.bucket).toBe('unattributed')
  })
})
