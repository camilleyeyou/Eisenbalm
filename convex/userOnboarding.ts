/**
 * Quick 260721-qdx — per-user first-run onboarding state.
 *
 * Additive sibling of `users` (convex/users.ts) — decoupled from that
 * table's JIT provisioning (which requires `email` and may not have run
 * yet). Mirrors `users.ts` conventions exactly: file-local
 * `DEFAULT_WORKSPACE_ID`, `by_clerkUserId` index lookup, `byClerkUserId` as
 * a public read query returning `null` on no-row/workspace-mismatch.
 *
 * Tracks:
 *   - `tourCompletedAt` — set on tour completion OR skip (both terminal —
 *     the tour never re-auto-launches once either happens)
 *   - `cardDismissedAt` — the Issues-home "Start here" card dismissed
 *   - `dismissedStageHints` — per-stage-segment hint-strip dismissals
 *     (story|draft|fact-check|voice|approval), idempotent appends
 */
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'

const DEFAULT_WORKSPACE_ID = 'eisenbalm'

// ── byClerkUserId (public query) — exact shape of users.byClerkUserId ──────

export const byClerkUserId = query({
  args: {
    workspace_id: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, { workspace_id, clerkUserId }) => {
    const row = await ctx.db
      .query('user_onboarding')
      .withIndex('by_clerkUserId', q => q.eq('clerkUserId', clerkUserId))
      .first()

    if (!row || row.workspace_id !== workspace_id) return null
    return row
  },
})

// ── upsert helper — shared by the three mutations below ────────────────────

async function upsertForCaller(ctx: MutationCtx): Promise<Doc<'user_onboarding'>> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Not authenticated')

  const clerkUserId = identity.subject

  const existing = await ctx.db
    .query('user_onboarding')
    .withIndex('by_clerkUserId', q => q.eq('clerkUserId', clerkUserId))
    .first()

  if (existing) return existing

  const _id = await ctx.db.insert('user_onboarding', {
    workspace_id: DEFAULT_WORKSPACE_ID,
    clerkUserId,
    updatedAt: Date.now(),
  })
  const inserted = await ctx.db.get(_id)
  if (!inserted) throw new Error('Failed to provision user_onboarding row')
  return inserted
}

// ── completeTour ─────────────────────────────────────────────────────────

export const completeTour = mutation({
  args: {},
  handler: async ctx => {
    const row = await upsertForCaller(ctx)
    const updatedAt = Date.now()
    await ctx.db.patch(row._id, { tourCompletedAt: updatedAt, updatedAt })
  },
})

// ── dismissCard ──────────────────────────────────────────────────────────

export const dismissCard = mutation({
  args: {},
  handler: async ctx => {
    const row = await upsertForCaller(ctx)
    const updatedAt = Date.now()
    await ctx.db.patch(row._id, { cardDismissedAt: updatedAt, updatedAt })
  },
})

// ── dismissStageHint ─────────────────────────────────────────────────────

export const dismissStageHint = mutation({
  args: { stage: v.string() },
  handler: async (ctx, { stage }) => {
    const row = await upsertForCaller(ctx)
    const existing = row.dismissedStageHints ?? []
    const dismissedStageHints = existing.includes(stage) ? existing : [...existing, stage]
    await ctx.db.patch(row._id, { dismissedStageHints, updatedAt: Date.now() })
  },
})
