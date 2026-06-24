/**
 * Phase 27 — RCN-01: financial reconciliation backend (queries + mutations).
 *
 * Per docs/API_CONTRACTS.md §27.1–§27.2. Computes per-issue gross/fee/net from
 * ACTUAL recorded stripeOrders rows — NEVER from model_pricing (D-08).
 * model_pricing is a projection rendered read-only with a staleness badge (D-13).
 *
 * The Stripe fee FETCH (an external HTTP call) lives in the sibling
 * `convex/financeActions.ts` (`"use node"`), because Convex only permits
 * actions in a Node-runtime module — a `"use node"` file cannot also export a
 * query/mutation. `fetchFeeForOrder` there reads via `getOrderForFee` and
 * writes via `cacheFee`, both defined below.
 */
import { query, internalQuery, internalMutation } from './_generated/server'
import { v } from 'convex/values'

// ── perIssueRevenue (query) ──────────────────────────────────────────────────

/**
 * Per-issue gross/fee/net revenue, computed from actual stripeOrders rows.
 *
 * The caller (finance dashboard) passes the published issues — issueNumber,
 * issueId, charitySlug, charityName, publishedAt — sourced from Sanity. Issues
 * are sorted by publishedAt; each window is [publishedAt, nextPublishedAt); the
 * latest issue's window is open (upper bound = Date.now()).
 *
 * Returns one row per issue plus an `unattributed` bucket. gross is summed from
 * `amountTotal`, net from `donationAmount`. feeCents is null when any
 * contributing order lacks a cached stripeFee. model_pricing is NEVER read —
 * the D-10 window-attribution logic mirrors apps/web/lib/finance/reconcile.ts
 * (reimplemented inline because Convex cannot import from apps/web).
 */
export const perIssueRevenue = query({
  args: {
    issues: v.array(
      v.object({
        issueNumber: v.number(),
        issueId: v.optional(v.string()),
        charitySlug: v.string(),
        charityName: v.string(),
        publishedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, { issues }) => {
    const orders = await ctx.db.query('stripeOrders').collect()

    const now = Date.now()
    const sorted = [...issues].sort((a, b) => a.publishedAt - b.publishedAt)

    // Build window bounds for each issue (windowEnd null = open/latest issue).
    const windows = sorted.map((issue, i) => {
      const next = sorted[i + 1]
      return {
        issue,
        windowStart: issue.publishedAt,
        windowEnd: next ? next.publishedAt : null,
      }
    })

    type Acc = {
      issueNumber: number
      issueId: string | undefined
      charitySlug: string
      charityName: string
      windowStart: number
      windowEnd: number | null
      orderCount: number
      grossCents: number
      netCents: number
      feeCents: number | null
    }
    const accByIssue = new Map<number, Acc>()
    for (const w of windows) {
      accByIssue.set(w.issue.issueNumber, {
        issueNumber: w.issue.issueNumber,
        issueId: w.issue.issueId,
        charitySlug: w.issue.charitySlug,
        charityName: w.issue.charityName,
        windowStart: w.windowStart,
        windowEnd: w.windowEnd,
        orderCount: 0,
        grossCents: 0,
        netCents: 0,
        feeCents: 0,
      })
    }

    const unattributed: {
      orderCount: number
      grossCents: number
      netCents: number
      feeCents: number | null
    } = { orderCount: 0, grossCents: 0, netCents: 0, feeCents: 0 }

    const applyOrder = (
      target: {
        orderCount: number
        grossCents: number
        netCents: number
        feeCents: number | null
      },
      order: (typeof orders)[number],
    ) => {
      target.orderCount += 1
      target.grossCents += order.amountTotal ?? 0
      target.netCents += order.donationAmount ?? 0
      if (target.feeCents !== null) {
        if (order.stripeFee === undefined || order.stripeFee === null) {
          target.feeCents = null // any uncached fee poisons the window total
        } else {
          target.feeCents += order.stripeFee
        }
      }
    }

    for (const order of orders) {
      // Inline D-10 attribution: charitySlug + createdAt ∈ [start, end).
      let matched: Acc | undefined
      for (const w of windows) {
        const upper = w.windowEnd ?? now
        const createdAt = order.createdAt ?? 0
        if (
          order.charitySlug === w.issue.charitySlug &&
          createdAt >= w.windowStart &&
          createdAt < upper
        ) {
          matched = accByIssue.get(w.issue.issueNumber)
          break
        }
      }
      if (matched) applyOrder(matched, order)
      else applyOrder(unattributed, order)
    }

    return {
      issues: windows.map(w => accByIssue.get(w.issue.issueNumber)!),
      unattributed,
    }
  },
})

// ── publishedIssues (query) ──────────────────────────────────────────────────

/**
 * The published-issue list that `perIssueRevenue` consumes, derived entirely
 * from data already in Convex so the dispatch-control finance dashboard does
 * not need its own Sanity client (dispatch-control has no Sanity dependency).
 *
 * Source of record: the `payouts` table — `payouts.upsertForIssue` writes one
 * row per reconciled/published issue (issueNumber, issueId, charitySlug). The
 * window-start `publishedAt` for each issue is approximated by the earliest
 * `stripeOrders.createdAt` for that issue's charitySlug; if no order exists yet
 * we fall back to the payout row's `createdAt`. `charityName` falls back to the
 * slug (no separate name source in Convex). Rows are returned sorted by
 * issueNumber so the caller's window math (next-issue boundary) is stable.
 *
 * This is intentionally an approximation of the canonical Sanity-sourced list
 * (§27.1) — accurate for gross/net/payout reconciliation, which is what the
 * finance view audits. The exact publish timestamp can be threaded in later
 * once dispatch-control reads Sanity directly.
 */
export const publishedIssues = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    const payouts = await ctx.db
      .query('payouts')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id),
      )
      .collect()

    const orders = await ctx.db.query('stripeOrders').collect()

    // earliest order createdAt per charitySlug → publishedAt proxy
    const earliestBySlug = new Map<string, number>()
    for (const o of orders) {
      if (!o.charitySlug) continue
      const createdAt = o.createdAt ?? 0
      const prev = earliestBySlug.get(o.charitySlug)
      if (prev === undefined || createdAt < prev) {
        earliestBySlug.set(o.charitySlug, createdAt)
      }
    }

    return payouts
      .map(p => ({
        issueNumber: p.issueNumber,
        issueId: p.issueId,
        charitySlug: p.charitySlug,
        charityName: p.charitySlug,
        publishedAt: earliestBySlug.get(p.charitySlug) ?? p.createdAt,
      }))
      .sort((a, b) => a.issueNumber - b.issueNumber)
  },
})

// ── listModelPricing (query) ─────────────────────────────────────────────────

/**
 * Read-only `model_pricing` rows for the workspace, powering the
 * ModelPricingCard "Projection Pricing" table + 30-day staleness badge (D-13).
 * Projection only — NEVER used to derive reconciliation figures (D-08).
 */
export const listModelPricing = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    return await ctx.db
      .query('model_pricing')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()
  },
})

// ── getOrderForFee (internalQuery) ───────────────────────────────────────────

/** Internal: read one order (sessionId + cached fee) for the fee-fetch action. */
export const getOrderForFee = internalQuery({
  args: { orderId: v.id('stripeOrders') },
  handler: async (ctx, { orderId }) => {
    return await ctx.db.get(orderId)
  },
})

// ── cacheFee (internalMutation) ──────────────────────────────────────────────

/**
 * Additively cache the fetched Stripe fee to stripeOrders.stripeFee. Write-once:
 * if a fee is already cached we leave it untouched so the fetch is idempotent.
 */
export const cacheFee = internalMutation({
  args: {
    orderId: v.id('stripeOrders'),
    fee: v.number(),
  },
  handler: async (ctx, { orderId, fee }) => {
    const order = await ctx.db.get(orderId)
    if (!order) return
    if (order.stripeFee !== undefined && order.stripeFee !== null) return // write-once
    await ctx.db.patch(orderId, { stripeFee: fee })
  },
})
