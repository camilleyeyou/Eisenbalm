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
import { requirePipelineSecret } from './lib/auth'

export const create = mutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    triggerSource: v.string(),       // "manual" | "cron" | "webhook"
    triggeredBy: v.optional(v.string()),
    // Phase 48 ENT-01/03 — absent = 'discovery'; only brief-triggered runs pass 'brief'.
    entryMode: v.optional(v.union(v.literal('discovery'), v.literal('brief'))),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, runId, triggerSource, triggeredBy, entryMode, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)

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
      entryMode,
      status: 'running', // server-side default — NOT an arg (mirrors pipelineRuns.create)
      startedAt: Date.now(), // server-side — NOT an arg; Python caller does not pass it
    })
  },
})

export const setConfigSnapshot = mutation({
  args: {
    runId: v.string(),
    configSnapshot: v.string(), // JSON
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { runId, configSnapshot, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)

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

// ── listRecentForWorkspace ───────────────────────────────────────────────────

/**
 * quick 260722-v01 (audit item 3) — ADDITIVE ONLY. `listForWorkspace`
 * `.collect()`s every run for the workspace; several subscribers do (and
 * still should) depend on that full set. `RunsTable.tsx` only ever renders
 * its latest 50 rows client-side (with a "Show all" toggle) — this query
 * gives it a server-side `take(100)` instead of pulling the entire table.
 *
 * Uses the SAME `by_workspace` index, `.order('desc')` (Convex orders by the
 * index's implicit trailing `_creationTime` field when no other sort field is
 * specified — NOT `startedAt`). Documented assumption: `_creationTime desc`
 * is an acceptable proxy for `startedAt desc` for `runs` rows, since each run
 * document is created once, at (or immediately after) the moment it starts —
 * the two orderings only disagree if a row were ever inserted materially
 * out-of-band from its own start time, which does not happen in this
 * pipeline. The taken rows are then explicitly re-sorted by `startedAt desc`
 * (matching `listForWorkspace`'s exact ordering contract) so a caller can
 * never observe a difference between the two queries' row order.
 *
 * Does NOT modify `listForWorkspace` or any other query — ReviewQueue /
 * CostRollup / DriftStrip keep subscribing to the full-collect query.
 */
export const listRecentForWorkspace = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    const rows = await ctx.db
      .query('runs')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .order('desc')
      .take(100)
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

// ── Phase 25 RUN-06 — Month-to-date cost roll-up ─────────────────────────────

/**
 * Sums the cost of all runs for a workspace that started in the current
 * calendar month (UTC). Returns the MTD total, total completed run count, and
 * the per-run `.total` values of the last up-to-4 completed runs (newest-first)
 * for use by the trailing-average start-gate projection.
 *
 * Budget math reads actual recorded runs.cost ONLY (single-cost-writer rule —
 * Phase 23 Pitfall 3). Never reads model_pricing or derives cost.
 */
export const monthToDateCost = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    const rows = await ctx.db
      .query('runs')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()

    // Current month boundaries (UTC).
    const now = new Date()
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)

    let mtdUsd = 0
    for (const row of rows) {
      if (row.startedAt >= monthStart && row.startedAt < monthEnd) {
        if (row.cost) {
          try {
            const parsed = JSON.parse(row.cost as string)
            if (typeof parsed?.total === 'number') {
              mtdUsd += parsed.total
            }
          } catch {
            // Unparseable cost — skip row (don't double-count)
          }
        }
      }
    }

    // Trailing costs: last up-to-4 completed runs (newest-first) for projection.
    const completed = rows
      .filter(r => r.status === 'complete' || r.status === 'awaiting-review')
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 4)

    const trailingCosts: number[] = []
    for (const row of completed) {
      if (row.cost) {
        try {
          const parsed = JSON.parse(row.cost as string)
          if (typeof parsed?.total === 'number') {
            trailingCosts.push(parsed.total)
          }
        } catch {
          // Unparseable — skip
        }
      }
    }

    return {
      mtdUsd,
      completedCount: completed.length,
      trailingCosts,
    }
  },
})

// ── Phase 25 RUN-04 — Cooperative cancel mutations ────────────────────────────

/**
 * Set the cancelRequested flag on a run (RUN-04). The flag is polled by
 * wrap_agent_node before each node executes — when true, the next node
 * raises RunCancelled instead of starting (cooperative-only, no task.cancel).
 */
export const requestCancel = mutation({
  args: {
    runId: v.string(),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted. requestCancel is
    // triggered from the dashboard, but FastAPI (which already verifies the
    // operator's Clerk JWT itself) calls Convex as the pipeline — no Convex
    // identity is present at this call site (29-RESEARCH.md).
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { runId, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)

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
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { runId, status, completedAt, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)

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

// ── Phase 26 RVW-03 — Scheduled publish mutations/queries ─────────────────

/**
 * Set (or clear) the scheduled publish time for a run (approve-and-schedule).
 * Pass `scheduledPublishAt: undefined` to clear (cancel a scheduled publish).
 * The Phase 25 `/pipeline/tick` sweep calls `dueForPublish` each tick and
 * fires the publish path for any due runs.
 */
export const setScheduledPublish = mutation({
  args: {
    runId: v.string(),
    scheduledPublishAt: v.optional(v.number()), // Unix ms; undefined to clear
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { runId, scheduledPublishAt, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)

    const run = await ctx.db
      .query('runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
    if (!run) throw new Error(`Run not found: ${runId}`)
    await ctx.db.patch(run._id, { scheduledPublishAt })
  },
})

/**
 * Returns runs that are due for scheduled publish:
 *   - status === "awaiting-review"
 *   - scheduledPublishAt is set (not undefined)
 *   - scheduledPublishAt <= nowMs
 *
 * Called by the Phase 25 /pipeline/tick sweep (after the cadence gate check)
 * to fire the same Sanity status-flip publish path (D-01) for scheduled runs.
 */
export const dueForPublish = query({
  args: {
    workspace_id: v.string(),
    nowMs: v.number(),
  },
  handler: async (ctx, { workspace_id, nowMs }) => {
    const rows = await ctx.db
      .query('runs')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()

    return rows.filter(
      r =>
        r.status === 'awaiting-review' &&
        r.scheduledPublishAt !== undefined &&
        r.scheduledPublishAt <= nowMs,
    )
  },
})
