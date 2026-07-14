/**
 * Phase 40 — ISS-01/ISS-02/ISS-03/ISS-04: the `issues` Convex table functions.
 *
 * `issues` is the operational-state substrate every other Phase 40 plan reads
 * (§40.1/§40.2). One row per issueNumber, created either by the console (D-03)
 * or defensively by the pipeline at run start (D-04) via `ensureByNumber` —
 * an idempotent insert-if-absent mutation that is a STRICT NO-OP on an
 * existing row (it must never resurrect a Held issue).
 *
 * `held` and `published` are the ONLY stored status inputs (D-18) — issue
 * status is derived elsewhere (lib/derivedState.ts, §40.6), never stored here.
 *
 * Lane split (mirrors pipelineConfig.ts / sign_offs pattern):
 *   - `byIssueNumber` / `listForWorkspace` are PUBLIC unguarded reads, same
 *     convention as `claimChecks:allSignedOff`.
 *   - `ensureByNumber` / `markPublished` are DUAL LANE via
 *     `requireOperatorOrPipeline` — both the console and the pipeline call
 *     them.
 *   - `hold` / `reopen` are OPERATOR-ONLY via `requireOperator` — these are
 *     human editorial decisions, never made by the pipeline.
 *
 * API_CONTRACTS §40.2 — all exported function signatures match exactly.
 */
import { query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireOperator, requireOperatorOrPipeline } from './lib/auth'

// ── byIssueNumber (public query) ───────────────────────────────────────────

export const byIssueNumber = query({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
  },
  handler: async (ctx, { workspace_id, issueNumber }) => {
    return await ctx.db
      .query('issues')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .first()
  },
})

// ── listForWorkspace (public query) ────────────────────────────────────────

export const listForWorkspace = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    const rows = await ctx.db
      .query('issues')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()
    return rows.sort((a, b) => b.issueNumber - a.issueNumber)
  },
})

// ── ensureByNumber (dual lane — console D-03 + pipeline D-04) ──────────────

export const ensureByNumber = mutation({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
    scheduledFor: v.optional(v.number()),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, issueNumber, scheduledFor, pipelineSecret }) => {
    await requireOperatorOrPipeline(ctx, pipelineSecret)

    const existing = await ctx.db
      .query('issues')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .first()

    // D-04 guard: a stray run (POST /run/weekly with an empty body, a curl, a
    // future cron) must NEVER silently resurrect a Held issue. Strict NO-OP —
    // do not patch held/heldReason/heldBy/heldAt/published on an existing row.
    if (existing) {
      return { issueNumber, created: false }
    }

    await ctx.db.insert('issues', {
      workspace_id,
      issueNumber,
      scheduledFor,
      held: false,
      published: false,
      createdAt: Date.now(),
    })
    return { issueNumber, created: true }
  },
})

// ── hold (operator-only) ────────────────────────────────────────────────────

export const hold = mutation({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { workspace_id, issueNumber, reason }) => {
    const actor = await requireOperator(ctx)

    const trimmedReason = reason.trim()
    if (trimmedReason === '') {
      throw new Error('A reason is required to hold this issue.')
    }

    const existing = await ctx.db
      .query('issues')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .first()
    if (!existing) throw new Error('Issue not found')

    await ctx.db.patch(existing._id, {
      held: true,
      heldReason: trimmedReason,
      heldBy: actor,
      heldAt: Date.now(),
    })

    // D-14: "also stop the run in progress" is a SEPARATE client-side call to
    // the existing runs:requestCancel mutation — hold does NOT touch
    // runs.cancelRequested. The two state systems stay distinct in the model.
    await ctx.runMutation(internal.auditLog.write, {
      workspace_id,
      actorId: actor,
      action: 'issue.held',
      resourceType: 'issue',
      resourceId: String(issueNumber),
      before: JSON.stringify({ held: false }),
      after: JSON.stringify({ held: true, heldReason: trimmedReason }),
    })

    return null
  },
})

// ── reopen (operator-only) ──────────────────────────────────────────────────

export const reopen = mutation({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
  },
  handler: async (ctx, { workspace_id, issueNumber }) => {
    const actor = await requireOperator(ctx)

    const existing = await ctx.db
      .query('issues')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .first()
    if (!existing) throw new Error('Issue not found')

    await ctx.db.patch(existing._id, {
      held: false,
      heldReason: undefined,
      heldBy: undefined,
      heldAt: undefined,
    })

    // D-17: status re-derives on its own — no "restore previous status"
    // bookkeeping.
    await ctx.runMutation(internal.auditLog.write, {
      workspace_id,
      actorId: actor,
      action: 'issue.reopened',
      resourceType: 'issue',
      resourceId: String(issueNumber),
      before: JSON.stringify({ held: true, heldReason: existing.heldReason }),
      after: JSON.stringify({ held: false }),
    })

    return null
  },
})

// ── markPublished (dual lane — D-05 backfill + publisher) ──────────────────

export const markPublished = mutation({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
    sanityIssueId: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, issueNumber, sanityIssueId, publishedAt, pipelineSecret }) => {
    await requireOperatorOrPipeline(ctx, pipelineSecret)

    const existing = await ctx.db
      .query('issues')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .first()
    if (!existing) throw new Error('Issue not found')

    // Idempotent — safe to call more than once with the same or refreshed args.
    await ctx.db.patch(existing._id, {
      published: true,
      publishedAt: publishedAt ?? Date.now(),
      sanityIssueId,
    })

    return null
  },
})
