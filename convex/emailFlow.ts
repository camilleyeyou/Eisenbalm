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
import {
  planEnqueue,
  offsetForStep,
  generateUnsubscribeToken,
} from '@eisenbalm/emails'

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
    const token = generateUnsubscribeToken()
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
