/**
 * Phase 27 — RCN-02: per-issue payout tracking backend.
 *
 * Per docs/API_CONTRACTS.md §27.3. Operator marks a payout sent (date +
 * reference) from the finance view so the "100% of proceeds" promise is
 * auditable across all issues. Tracking only — no disbursement integration
 * this phase.
 *
 * `markPayoutSent` is Clerk-JWT-guarded (ctx.auth.getUserIdentity()) and
 * audit-logged via internal.auditLog.write with before/after JSON (D-11/D-12,
 * AUD-01). `listByWorkspace` powers the dashboard's at-a-glance payout view.
 * `upsertForIssue` idempotently ensures a pending payout row exists per issue.
 */
import { query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

// ── markPayoutSent (guarded + audited) ───────────────────────────────────────

/**
 * Mark a payout sent. Guarded by Clerk JWT; rejects double-sends; audit-logged.
 *
 * - Throws 'Unauthorized' when no Clerk identity is present.
 * - Throws 'Payout not found or already sent' when the row is missing or its
 *   status is already 'sent' (no double-send).
 * - Patches status/sentAt/reference/actor/updatedAt, then writes an audit row
 *   with action 'payout:markSent' and before/after JSON of the status.
 */
export const markPayoutSent = mutation({
  args: {
    payoutId: v.id('payouts'),
    reference: v.string(),
    sentAt: v.number(),
  },
  handler: async (ctx, { payoutId, reference, sentAt }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthorized')

    const before = await ctx.db.get(payoutId)
    if (!before || before.status === 'sent') {
      throw new Error('Payout not found or already sent')
    }

    await ctx.db.patch(payoutId, {
      status: 'sent',
      sentAt,
      reference,
      actor: identity.subject,
      updatedAt: Date.now(),
    })

    await ctx.runMutation(internal.auditLog.write, {
      workspace_id: before.workspace_id,
      actorId: identity.subject,
      action: 'payout:markSent',
      resourceType: 'payouts',
      resourceId: payoutId,
      before: JSON.stringify({ status: before.status }),
      after: JSON.stringify({ status: 'sent', reference }),
    })

    return null
  },
})

// ── listByWorkspace (query) ──────────────────────────────────────────────────

/**
 * All payout rows for a workspace, ordered by issueNumber (ascending), for the
 * finance dashboard's at-a-glance payout-status view across all issues.
 */
export const listByWorkspace = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    return await ctx.db
      .query('payouts')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id),
      )
      .collect()
  },
})

// ── upsertForIssue (mutation) ────────────────────────────────────────────────

/**
 * Ensure a `pending` payout row exists for an issue (idempotent on
 * workspace_id + issueNumber). Lets the finance view guarantee a payout row per
 * reconciled issue without creating duplicates. Updates the amount/charitySlug/
 * issueId on an existing pending row; leaves a 'sent' row untouched.
 */
export const upsertForIssue = mutation({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
    issueId: v.optional(v.string()),
    charitySlug: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, { workspace_id, issueNumber, issueId, charitySlug, amount }) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('payouts')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .unique()

    if (existing) {
      // Never overwrite a sent payout; refresh the figures on a pending one.
      if (existing.status === 'pending') {
        await ctx.db.patch(existing._id, {
          issueId,
          charitySlug,
          amount,
          updatedAt: now,
        })
      }
      return existing._id
    }

    return await ctx.db.insert('payouts', {
      workspace_id,
      issueNumber,
      issueId,
      charitySlug,
      amount,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
  },
})
