/**
 * Phase 38 — §38.2: eval_scores append-only time-series store.
 *
 * `record` inserts ONE row per scenario run — the eval drawer (D-04/D-05) and
 * the pre-commit gate check (§38.3) both call it once per scenario per side
 * (draft or active) scored. This is a dashboard-only mutation
 * (`requireOperator`), mirroring `prompt_versions`/`audit_log` — there is no
 * pipeline round-trip and no `pipelineSecret` arg (§3A.1/§3A.2's isolation
 * contract keeps the pipeline's test-run/score endpoints write-free; the
 * CALLER, i.e. the dashboard, owns persistence).
 *
 * NEVER mutate or remove an existing `eval_scores` row: the append-only
 * time-series IS the editorial drift record (D-09/D-10). Every write here
 * must be a fresh `ctx.db.insert('eval_scores', ...)` call — this module must
 * never call the document-update or document-removal db methods.
 *
 * `listForScenario` / `listForAgent` are the two read shapes consumed by the
 * Eval Center's drift scoreboard and scenario cards (§38.2).
 *
 * Table: `eval_scores` — defined in schema.ts (Phase 38 §38.2).
 * Indexes used: `by_workspace_scenario`, `by_workspace_agentKey`.
 */
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireOperator } from './lib/auth'

// ── record (mutation — dashboard-only, requireOperator) ──────────────────────

/**
 * Insert one append-only eval_scores row. `ranAt` is injected server-side
 * (Date.now()) — never trust a caller-supplied timestamp for the time-series.
 */
export const record = mutation({
  args: {
    workspace_id: v.string(),
    scenarioId: v.string(),
    agentKey: v.string(),
    promptVersion: v.string(),
    overall: v.number(),
    axes: v.string(),       // JSON-encoded ScoreResponse.axes
    costUsd: v.number(),
    source: v.string(),     // "drawer" | "commit" | "manual"
  },
  handler: async (ctx, args) => {
    await requireOperator(ctx)

    return await ctx.db.insert('eval_scores', { ...args, ranAt: Date.now() })
  },
})

// ── listForScenario (query — time-series for one scenario, ascending) ───────

/**
 * Returns eval_scores rows for one scenario, oldest-first — the drift chart's
 * data source (each point is one historical run against a prompt version).
 */
export const listForScenario = query({
  args: {
    workspace_id: v.string(),
    scenarioId: v.string(),
  },
  handler: async (ctx, { workspace_id, scenarioId }) => {
    const rows = await ctx.db
      .query('eval_scores')
      .withIndex('by_workspace_scenario', (q) =>
        q.eq('workspace_id', workspace_id).eq('scenarioId', scenarioId),
      )
      .collect()

    return rows.sort((a, b) => a.ranAt - b.ranAt)
  },
})

// ── listForAgent (query — newest-first, scenario card "last result") ────────

/**
 * Returns eval_scores rows for one agent, newest-first — the scenario card's
 * "last result" source and the per-agent drift view.
 */
export const listForAgent = query({
  args: {
    workspace_id: v.string(),
    agentKey: v.string(),
  },
  handler: async (ctx, { workspace_id, agentKey }) => {
    const rows = await ctx.db
      .query('eval_scores')
      .withIndex('by_workspace_agentKey', (q) =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey),
      )
      .collect()

    return rows.sort((a, b) => b.ranAt - a.ranAt)
  },
})
