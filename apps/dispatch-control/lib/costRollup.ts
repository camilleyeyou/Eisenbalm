/**
 * Phase 23 — OBS-04: Cost roll-up utilities.
 *
 * Parses `runs.cost` JSON (shape: `{total, agents: {...}}`) and aggregates
 * costs across multiple runs. Aggregation happens on the frontend — no
 * separate Convex aggregation query needed at current scale (52 runs/year).
 *
 * Shape mirrors `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py`
 * `get_cost_payload()` return value, which is JSON-stringified into
 * `pipelineRuns.cost` and `runs.cost`.
 */

export type AgentCostEntry = {
  tokens_in?: number
  tokens_out?: number
  usd?: number
  duration_ms?: number
}

export type CostPayload = {
  total: number
  agents: Record<string, AgentCostEntry>
}

/**
 * Parse a `runs.cost` JSON string into a typed `CostPayload`.
 * Returns `{ total: 0, agents: {} }` for null / undefined / invalid JSON.
 */
export function parseCostJson(raw: string | undefined | null): CostPayload {
  if (!raw) return { total: 0, agents: {} }
  try {
    const parsed = JSON.parse(raw)
    const total = typeof parsed?.total === 'number' ? parsed.total : 0
    const agents =
      parsed?.agents && typeof parsed.agents === 'object' ? parsed.agents : {}
    return { total, agents }
  } catch {
    return { total: 0, agents: {} }
  }
}

/**
 * Sum `cost.total` across an array of run-like objects.
 * Non-parseable `cost` fields are treated as 0 (no throw).
 */
export function sumRunsCost(runs: Array<{ cost?: string | null }>): number {
  return runs.reduce((acc, run) => acc + parseCostJson(run.cost).total, 0)
}
