/**
 * Phase 20 — Email lifecycle: flow engine (EMAIL-01, EMAIL-09).
 *
 * enqueueEmailFlow: internalMutation called fire-and-forget from stripeOrders.insert.
 *   - When customerEmail is present: upserts subscriber + schedules 8 sendEmailStep
 *     actions at purchase-anchored offsets; stores scheduledFnId in emailSends.
 *   - When customerEmail is absent: marks all 8 steps 'skipped' without throwing (EMAIL-09).
 *
 * getOrder: internalQuery used by sendEmailStep (actions cannot ctx.db.get directly).
 *
 * NEVER throws on the missing-email path — an enqueue failure must never fail the order write.
 */
import { internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
// NOTE: We do NOT import from '@eisenbalm/emails' here because the barrel re-exports
// token.ts (node:crypto) and provider.ts (resend), which are unavailable in the
// Convex mutation runtime (not Node.js). Instead, the pure, side-effect-free logic
// is inlined directly below. The plan spec lists these imports; this inline approach
// produces IDENTICAL runtime behavior while satisfying Convex bundler constraints.
// Tracked as: [Rule 3 - Blocking] Convex bundler can't resolve workspace barrel transitive deps.

/** 64-char hex token using Web Crypto (available in Convex mutation runtime). */
function generateToken(): string {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Returns the ms offset for a given step (1-8). Inline of offsetForStep from @eisenbalm/emails. */
function offsetForStep(step: number): number {
  const DAY_MS = 24 * 3_600_000
  const OFFSETS: readonly number[] = [
    0,             // E1 +0
    1 * DAY_MS,    // E2 +1d
    4 * DAY_MS,    // E3 +4d
    7 * DAY_MS,    // E4 +7d
    9 * DAY_MS,    // E5 +9d
    14 * DAY_MS,   // E6 +14d
    21 * DAY_MS,   // E7 +21d
    42 * DAY_MS,   // E8 +42d
  ]
  return OFFSETS[step - 1] as number
}

/** Returns { skip, steps } for an order. Inline of planEnqueue from @eisenbalm/emails. */
function planEnqueue(order: { customerEmail?: string | null }): {
  skip: boolean
  steps: number[]
} {
  return { skip: !order.customerEmail, steps: [1, 2, 3, 4, 5, 6, 7, 8] }
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Read a stripeOrders row by id.
 * Called by sendEmailStep actions — actions cannot use ctx.db directly.
 */
export const getOrder = internalQuery({
  args: { orderId: v.id('stripeOrders') },
  handler: async (ctx, { orderId }) => {
    return await ctx.db.get(orderId)
  },
})

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Schedule 8 email steps for the order identified by orderId.
 *
 * Missing-email path (EMAIL-09):
 *   Insert 8 skipped rows and return — no scheduled functions, no throw.
 *
 * Happy path:
 *   1. Upsert subscriber (preserves prior unsubscribe across purchases).
 *   2. For each step 1-8: runAfter(offsetForStep(step), sendEmailStep) → store scheduledFnId.
 */
export const enqueueEmailFlow = internalMutation({
  args: { orderId: v.id('stripeOrders') },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId)
    if (!order) return

    const plan = planEnqueue(order)

    if (plan.skip) {
      // EMAIL-09: no customer email — mark all steps skipped, never throw
      for (const step of plan.steps) {
        await ctx.runMutation(internal.emailSends.markSkipped, {
          orderId,
          email: '',
          step,
        })
      }
      return
    }

    // Upsert subscriber — preserves prior unsubscribe state on repeat purchase
    const token = generateToken()
    await ctx.runMutation(internal.emailSubscribers.upsertSubscriber, {
      email: order.customerEmail as string,
      unsubscribeToken: token,
      source: 'post-purchase-flow',
    })

    // Schedule each step at the purchase-anchored offset
    for (const step of plan.steps) {
      const fnId = await ctx.scheduler.runAfter(
        offsetForStep(step),
        internal.emailActions.sendEmailStep,
        { orderId, step },
      )
      await ctx.runMutation(internal.emailSends.insertScheduled, {
        orderId,
        email: order.customerEmail as string,
        step,
        scheduledFnId: fnId as unknown as string,
      })
    }
  },
})
