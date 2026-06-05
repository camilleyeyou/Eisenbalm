"use node"
/**
 * Phase 20 — Email lifecycle: send actions (EMAIL-02, EMAIL-03).
 *
 * MUST run in the Node.js runtime ("use node" directive).
 * Only internalAction can make external HTTP calls (Resend, Sanity CDN).
 * Actions CANNOT use ctx.db — all DB access via ctx.runQuery / ctx.runMutation.
 *
 * sendEmailStep:
 *   1. Idempotency gate — skip if already sent (EMAIL-02).
 *   2. Fetch order via getOrder.
 *   3. Suppression gate — skip marketing steps when unsubscribed (EMAIL-03).
 *   4. Resolve charity data from Sanity CDN.
 *   5. Render via renderEmailStep (placeholder; Plan 20-04 wires templates).
 *   6. Add List-Unsubscribe headers for marketing steps only.
 *   7. Send via selectProvider (live OFF by default).
 *   8. Mark sent or failed.
 *
 * sweepStaleSends:
 *   Re-enqueue rows still 'scheduled' that are >1h past their expected fire time.
 *   Idempotency in sendEmailStep makes re-enqueue safe even on overlap.
 */
import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import {
  shouldSuppressStep,
  shouldSendStep,
  isMarketingStep,
  STEP_STREAM,
  SUBJECTS,
  selectProvider,
  buildFundedCharityQuery,
  buildOtherCharitiesQuery,
  buildFundedSinceCountQuery,
  orderMsToIsoDate,
  offsetForStep,
  renderEmailStep,
} from '@eisenbalm/emails'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch GROQ from the Sanity CDN. Returns null on any error. */
async function fetchSanityGroq<T>(groq: string): Promise<T | null> {
  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    if (!projectId) return null
    const url = `https://${projectId}.api.sanity.io/v2024-01-01/data/query/production?query=${encodeURIComponent(groq)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as { result: T }
    return json.result
  } catch {
    return null
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

export const sendEmailStep = internalAction({
  args: {
    orderId: v.id('stripeOrders'),
    step: v.number(),
  },
  handler: async (ctx, { orderId, step }) => {
    // 1. Idempotency gate (EMAIL-02): skip if already sent
    const existing = await ctx.runQuery(internal.emailSends.getByOrderStep, {
      orderId,
      step,
    })
    if (!shouldSendStep(existing)) return

    // 2. Fetch order
    const order = await ctx.runQuery(internal.emailFlow.getOrder, { orderId })
    if (!order?.customerEmail) {
      await ctx.runMutation(internal.emailSends.markSkipped, {
        orderId,
        email: '',
        step,
      })
      return
    }

    // 3. Suppression gate (EMAIL-03): skip marketing when unsubscribed
    const subscriber = await ctx.runQuery(
      internal.emailSubscribers.getByEmail,
      { email: order.customerEmail },
    )
    if (shouldSuppressStep(step, subscriber)) return

    // 4. Resolve charity data from Sanity CDN
    let charity: {
      name: string
      location?: string
      focusArea?: string
      missionStatement?: string
    } | null = null
    let others: Array<{ name: string }> | null = null
    let fundedMoreCount: number | null = null

    if (step <= 6) {
      const q = buildFundedCharityQuery(order.charitySlug)
      if (q) {
        charity = await fetchSanityGroq<typeof charity>(q)
      }
    }

    if (step === 7) {
      const q = buildOtherCharitiesQuery(order.charitySlug)
      const raw = await fetchSanityGroq<
        Array<{ charity: { name: string } }>
      >(q)
      others = raw?.map((r) => ({ name: r.charity.name })) ?? null
    }

    if (step === 8) {
      const q = buildFundedSinceCountQuery(orderMsToIsoDate(order.createdAt))
      const count = await fetchSanityGroq<number>(q)
      fundedMoreCount = typeof count === 'number' ? count : null
    }

    // 5. Render HTML
    const html = await renderEmailStep(step, {
      order,
      charity,
      others,
      fundedMoreCount,
      unsubscribeToken: subscriber?.unsubscribeToken ?? null,
      postalAddress: process.env.EMAIL_POSTAL_ADDRESS ?? null,
    })

    // 6. Build headers — marketing only carries List-Unsubscribe (20-RESEARCH Anti-Pattern)
    const headers: Record<string, string> = {}
    if (
      isMarketingStep(step) &&
      subscriber?.unsubscribeToken
    ) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ''
      headers['List-Unsubscribe'] =
        `<${baseUrl}/api/email/unsubscribe?token=${subscriber.unsubscribeToken}>`
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }

    // 7. Determine from address by stream
    const from =
      STEP_STREAM[step] === 'transactional'
        ? (process.env.EMAIL_FROM_TRANSACTIONAL ?? 'receipts@receipts.eisenbalm.com')
        : (process.env.EMAIL_FROM_MARKETING ?? 'dispatch@dispatch.eisenbalm.com')

    // 8. Send via provider (live OFF by default)
    const provider = selectProvider(process.env)
    try {
      const res = await provider.send({
        from,
        to: order.customerEmail,
        subject: SUBJECTS[step] as string,
        html,
        headers,
      })
      await ctx.runMutation(internal.emailSends.markSent, {
        orderId,
        step,
        providerMessageId: res.id,
      })
    } catch (err) {
      await ctx.runMutation(internal.emailSends.markFailed, {
        orderId,
        step,
        errorMessage: String(err),
      })
    }
  },
})

export const sweepStaleSends = internalAction({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.runQuery(
      internal.emailSends.listStaleScheduled,
      {},
    )
    const now = Date.now()
    for (const row of rows) {
      const expectedFireAt = row.createdAt + offsetForStep(row.step)
      // Only re-enqueue rows still 'scheduled' AND >1h past their expected fire time.
      // The tightened window prevents noisy re-fires of low-offset steps (e.g. E1 offset=0).
      if (row.status === 'scheduled' && now - expectedFireAt > 3_600_000) {
        await ctx.scheduler.runAfter(
          0,
          internal.emailActions.sendEmailStep,
          { orderId: row.orderId, step: row.step },
        )
      }
    }
  },
})
