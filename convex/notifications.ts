/**
 * Phase 27 — NTF-01/02: operational notification idempotency ledger.
 *
 * Internal-only functions — NOT exposed to the browser client. Mirrors the
 * Phase 20 `emailSends` two-step pattern (insertScheduled → markSent/markFailed/
 * markSkipped), re-keyed on (runId, eventType, channel) per API_CONTRACTS §27.4.
 *
 * Idempotency key (D-07): (runId|eventKey, eventType, channel). The
 * by_runId_eventType_channel index makes the gate O(1) and guarantees each
 * event sends at most once per channel. Re-fires / scheduler retries are safe.
 *
 * Called by the sendNotification internalAction (convex/notificationActions.ts):
 *   getByKey (idempotency gate) → insertScheduled (status 'queued') → send →
 *   markSent / markFailed.
 */
import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Look up a notificationsLedger row by (runId, eventType, channel).
 * Returns the full row or null if not found.
 */
export const getByKey = internalQuery({
  args: {
    runId: v.string(),
    eventType: v.string(),
    channel: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('notificationsLedger')
      .withIndex('by_runId_eventType_channel', q =>
        q
          .eq('runId', args.runId)
          .eq('eventType', args.eventType)
          .eq('channel', args.channel),
      )
      .first()
  },
})

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Atomic check-and-insert: insert a 'queued' row for (runId, eventType, channel)
 * ONLY if no row already exists. Returns the existing row's _id when present so
 * the caller can detect an already-handled key without a second query.
 */
export const insertScheduled = internalMutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    eventType: v.string(),
    channel: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('notificationsLedger')
      .withIndex('by_runId_eventType_channel', q =>
        q
          .eq('runId', args.runId)
          .eq('eventType', args.eventType)
          .eq('channel', args.channel),
      )
      .first()
    if (existing) return existing._id

    return await ctx.db.insert('notificationsLedger', {
      workspace_id: args.workspace_id,
      runId: args.runId,
      eventType: args.eventType,
      channel: args.channel,
      status: 'queued',
      createdAt: Date.now(),
    })
  },
})

/**
 * Mark a (runId, eventType, channel) row as sent after successful delivery.
 */
export const markSent = internalMutation({
  args: {
    runId: v.string(),
    eventType: v.string(),
    channel: v.string(),
    providerId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('notificationsLedger')
      .withIndex('by_runId_eventType_channel', q =>
        q
          .eq('runId', args.runId)
          .eq('eventType', args.eventType)
          .eq('channel', args.channel),
      )
      .first()
    if (row) {
      await ctx.db.patch(row._id, {
        status: 'sent',
        providerId: args.providerId,
        sentAt: Date.now(),
      })
    }
  },
})

/**
 * Mark a (runId, eventType, channel) row as failed after a provider error.
 */
export const markFailed = internalMutation({
  args: {
    runId: v.string(),
    eventType: v.string(),
    channel: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('notificationsLedger')
      .withIndex('by_runId_eventType_channel', q =>
        q
          .eq('runId', args.runId)
          .eq('eventType', args.eventType)
          .eq('channel', args.channel),
      )
      .first()
    if (row) {
      await ctx.db.patch(row._id, {
        status: 'failed',
        errorMessage: args.errorMessage,
      })
    }
  },
})

/**
 * Mark a (runId, eventType, channel) row as skipped (e.g. flag-off detected
 * after a row was scheduled). No-op if the row is absent.
 */
export const markSkipped = internalMutation({
  args: {
    runId: v.string(),
    eventType: v.string(),
    channel: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('notificationsLedger')
      .withIndex('by_runId_eventType_channel', q =>
        q
          .eq('runId', args.runId)
          .eq('eventType', args.eventType)
          .eq('channel', args.channel),
      )
      .first()
    if (row) {
      await ctx.db.patch(row._id, { status: 'skipped' })
    }
  },
})
