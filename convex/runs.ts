/**
 * Phase 22 — CFG-02: dashboard `runs` table writes (Phase-21 superset of the
 * frozen pipelineRuns table — do NOT touch pipelineRuns here).
 *
 * `create` inserts a schema-complete `runs` row before graph invoke. The
 * Phase-21 schema requires workspace_id, runId, triggerSource, status, and
 * startedAt (all non-optional); `status` and `startedAt` are set server-side
 * IN THE HANDLER (mirroring pipelineRuns.create, which hardcodes
 * `status: 'running' as const`) — the Python caller does NOT pass them.
 *
 * `setConfigSnapshot` patches the per-run config snapshot (Plan 05) for
 * reproducibility, locating the row by `by_runId` and throwing
 * `Run not found: ${runId}` on a miss (mirrors pipelineRuns.updateStatus).
 *
 * The `runs` table already has a `by_runId` index (schema.ts) — used for both
 * the create-guard and the setConfigSnapshot lookup.
 */
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const create = mutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    triggerSource: v.string(),       // "manual" | "cron" | "webhook"
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, runId, triggerSource, triggeredBy }) => {
    // Idempotent guard: same runId as pipelineRuns.create (join key). If a runs
    // row already exists for this runId, no-op rather than insert a duplicate.
    const existing = await ctx.db
      .query('runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
    if (existing) return existing._id

    return await ctx.db.insert('runs', {
      workspace_id,
      runId,
      triggerSource,
      triggeredBy,
      status: 'running', // server-side default — NOT an arg (mirrors pipelineRuns.create)
      startedAt: Date.now(), // server-side — NOT an arg; Python caller does not pass it
    })
  },
})

export const setConfigSnapshot = mutation({
  args: {
    runId: v.string(),
    configSnapshot: v.string(), // JSON
  },
  handler: async (ctx, { runId, configSnapshot }) => {
    const run = await ctx.db
      .query('runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
    if (!run) throw new Error(`Run not found: ${runId}`)
    await ctx.db.patch(run._id, { configSnapshot })
  },
})

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
  },
})

// ── listForWorkspace ─────────────────────────────────────────────────────────

/**
 * Returns all runs for a workspace, sorted newest-first (by startedAt desc).
 * Used by the Runs history table (OBS-02) and cost roll-up (OBS-04).
 * Frontend aggregation is acceptable at 52 runs/year per RESEARCH Pattern 5.
 */
export const listForWorkspace = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    const rows = await ctx.db
      .query('runs')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()
    return rows.sort((a, b) => b.startedAt - a.startedAt)
  },
})

// ── latest ───────────────────────────────────────────────────────────────────

/**
 * Returns the most recent run for a workspace (by startedAt desc).
 * Used by the dashboard graph view to find the active run for live subscription.
 * Frontend aggregation is acceptable at 52 runs/year per RESEARCH Pattern 5.
 */
export const latest = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    const rows = await ctx.db
      .query('runs')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()
    return rows.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null
  },
})

// ── Phase 25 RUN-04 — Cooperative cancel mutations ────────────────────────────

/**
 * Set the cancelRequested flag on a run (RUN-04). The flag is polled by
 * wrap_agent_node before each node executes — when true, the next node
 * raises RunCancelled instead of starting (cooperative-only, no task.cancel).
 */
export const requestCancel = mutation({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db
      .query('runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
    if (!run) throw new Error(`Run not found: ${runId}`)
    await ctx.db.patch(run._id, { cancelRequested: true })
  },
})

/**
 * Query the cancelRequested flag for a run (RUN-04). Called by
 * convex_query_safe in wrap_agent_node before each node starts.
 * Returns false (not null) when the run does not exist so the wrapper
 * fails-open and doesn't crash a node on a Convex miss.
 */
export const isCancelRequested = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db
      .query('runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
    return Boolean(run?.cancelRequested)
  },
})

/**
 * Update the status (and optionally completedAt) of a runs row.
 * Used by _execute_run to land RunCancelled / CostCapExceeded as
 * runs.status='cancelled' (Pitfall 1: pipelineRuns.status stays 'failed').
 * errorMessage is accepted for API symmetry but not stored (runs schema
 * has no errorMessage field — that lives on pipelineRuns).
 */
export const updateStatus = mutation({
  args: {
    runId: v.string(),
    status: v.string(),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { runId, status, completedAt }) => {
    const run = await ctx.db
      .query('runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
    if (!run) throw new Error(`Run not found: ${runId}`)
    await ctx.db.patch(run._id, {
      status,
      ...(completedAt !== undefined ? { completedAt } : {}),
    })
  },
})
