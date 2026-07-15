/**
 * Phase 23 — OBS-03/OBS-05: Per-agent live progress + I/O snapshots.
 *
 * All write mutations (`queueForRun`, `started`, `completed`, `failed`,
 * `savePayload`) are `internalMutation` — only the pipeline backend calls
 * them via the Convex HTTP API with a deploy key. The live-subscription
 * queries (`byRunId`, `payloadByRunIdAgentKey`) are public `query` functions
 * consumed by the dashboard `useQuery` hooks.
 *
 * Upsert pattern (mirrors runs.ts / agents.ts):
 *   - Guard via index → patch existing else insert.
 *   - Throws `Run not found: ${runId}` only where a missing row is an error
 *     (none in this file — all writes are upserts; missing rows are created).
 *
 * The `agent_runs` table carries only status/cost/timing (kept small for
 * live subscriptions). I/O snapshots live in `agent_run_payloads` (queried
 * on node click, NOT subscribed).
 */
import { internalMutation, query } from './_generated/server'
import { v } from 'convex/values'

// ── queueForRun ──────────────────────────────────────────────────────────────

/**
 * Pre-populate all agent_runs rows as "queued" at run start.
 * Idempotent: skips any (runId, agentKey) pair that already has a row.
 * Called from the pipeline before graph.invoke() so the dashboard graph
 * shows all nodes in grey "queued" state immediately when a run begins.
 */
export const queueForRun = internalMutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    agentKeys: v.array(v.string()),
  },
  handler: async (ctx, { workspace_id, runId, agentKeys }) => {
    for (const agentKey of agentKeys) {
      const existing = await ctx.db
        .query('agent_runs')
        .withIndex('by_runId', q => q.eq('runId', runId))
        .filter(q => q.eq(q.field('agentKey'), agentKey))
        .first()
      if (!existing) {
        await ctx.db.insert('agent_runs', {
          workspace_id,
          runId,
          agentKey,
          status: 'queued',
        })
      }
    }
  },
})

// ── started ──────────────────────────────────────────────────────────────────

/**
 * Called by wrap_agent_node before fn() runs.
 * Upsert: if a "queued" row exists, patch status to "running"; else insert.
 */
export const started = internalMutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    agentKey: v.string(),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { workspace_id, runId, agentKey, startedAt } = args
    const existing = await ctx.db
      .query('agent_runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .filter(q => q.eq(q.field('agentKey'), agentKey))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { status: 'running', startedAt })
    } else {
      await ctx.db.insert('agent_runs', {
        workspace_id,
        runId,
        agentKey,
        status: 'running',
        startedAt,
      })
    }
  },
})

// ── completed ────────────────────────────────────────────────────────────────

/**
 * Called by wrap_agent_node after fn() returns successfully.
 * Upsert: patch status to "done" with all cost/timing fields; else insert.
 */
export const completed = internalMutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    agentKey: v.string(),
    completedAt: v.number(),
    costUsd: v.number(),
    durationMs: v.number(),
    tokensIn: v.number(),
    tokensOut: v.number(),
    retryCount: v.optional(v.number()),  // Phase 37 §37.1
  },
  handler: async (ctx, args) => {
    const { workspace_id, runId, agentKey, completedAt, costUsd, durationMs, tokensIn, tokensOut, retryCount } = args
    const retryCountField = retryCount !== undefined ? { retryCount } : {}
    const existing = await ctx.db
      .query('agent_runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .filter(q => q.eq(q.field('agentKey'), agentKey))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: 'done',
        completedAt,
        costUsd,
        durationMs,
        tokensIn,
        tokensOut,
        ...retryCountField,
      })
    } else {
      await ctx.db.insert('agent_runs', {
        workspace_id,
        runId,
        agentKey,
        status: 'done',
        completedAt,
        costUsd,
        durationMs,
        tokensIn,
        tokensOut,
        ...retryCountField,
      })
    }
  },
})

// ── failed ───────────────────────────────────────────────────────────────────

/**
 * Called by wrap_agent_node on exception. Re-raise happens in the wrapper;
 * this records the failure in Convex for the dashboard to surface.
 * Upsert: patch status to "failed" with error + completedAt; else insert.
 */
export const failed = internalMutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    agentKey: v.string(),
    error: v.string(),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { workspace_id, runId, agentKey, error } = args
    const completedAt = args.completedAt ?? Date.now()
    const existing = await ctx.db
      .query('agent_runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .filter(q => q.eq(q.field('agentKey'), agentKey))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { status: 'failed', error, completedAt })
    } else {
      await ctx.db.insert('agent_runs', {
        workspace_id,
        runId,
        agentKey,
        status: 'failed',
        error,
        completedAt,
      })
    }
  },
})

// ── savePayload ───────────────────────────────────────────────────────────────

/**
 * Upsert per-agent I/O snapshot into agent_run_payloads.
 * Called alongside agentRuns:completed. Write failure is non-fatal
 * (the live subscription doesn't depend on this table).
 */
export const savePayload = internalMutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    agentKey: v.string(),
    inputSnapshot: v.optional(v.string()),
    outputSnapshot: v.optional(v.string()),
    // Phase 44 §44.5 — untruncated top-level input key list; additive-optional.
    inputKeys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { workspace_id, runId, agentKey, inputSnapshot, outputSnapshot, inputKeys } = args
    const existing = await ctx.db
      .query('agent_run_payloads')
      .withIndex('by_runId_agentKey', q => q.eq('runId', runId).eq('agentKey', agentKey))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { inputSnapshot, outputSnapshot, inputKeys })
    } else {
      await ctx.db.insert('agent_run_payloads', {
        workspace_id,
        runId,
        agentKey,
        inputSnapshot,
        outputSnapshot,
        inputKeys,
      })
    }
  },
})

// ── byRunId (public query — live subscription source) ───────────────────────

/**
 * Returns all agent_runs rows for a run. Used by the dashboard graph and
 * run-detail views via `useQuery(api.agentRuns.byRunId, { runId })`.
 */
export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return ctx.db
      .query('agent_runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()
  },
})

// ── payloadByRunIdAgentKey (public query — node-click on-demand fetch) ───────

/**
 * Returns one payload row for a (runId, agentKey) pair.
 * Queried on node click (NOT subscribed) — keeps the live subscription lean.
 */
export const payloadByRunIdAgentKey = query({
  args: { runId: v.string(), agentKey: v.string() },
  handler: async (ctx, { runId, agentKey }) => {
    return ctx.db
      .query('agent_run_payloads')
      .withIndex('by_runId_agentKey', q => q.eq('runId', runId).eq('agentKey', agentKey))
      .first()
  },
})
