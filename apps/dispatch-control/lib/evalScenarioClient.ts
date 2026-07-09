/**
 * Phase 38 (EVL-01) — client for the golden-scenario read endpoint.
 *
 * GETs the pipeline's `GET /eval/scenarios` (docs/API_CONTRACTS §38.1) with a
 * Clerk bearer token (`_require_operator`), optionally filtered by
 * `agentKey` — mirroring the eval drawer's auto-select behavior (D-04).
 * Scenarios are repo-sourced fixtures (D-01); this client is a pure read, it
 * writes nothing.
 *
 * Mirrors testRunClient.ts / scoreClient.ts (same base URL, same bearer +
 * error-handling shape).
 */
import { pipelineBaseUrl } from '@/lib/testRunClient'

/** Absolute floor for a scenario's judge `overall` score (0-10 scale). */
export interface EvalScoringTarget {
  min_overall: number
}

/** The §38.1 Scenario shape. */
export interface EvalScenario {
  id: string
  agentKey: string
  description: string
  whatItCatches: string
  /** Maps 1:1 onto TestRunBody.variables for this agentKey. */
  input: Record<string, string>
  scoringTarget: EvalScoringTarget
}

/**
 * Fetch the golden-scenario fixtures, optionally filtered to one agentKey.
 *
 * @param agentKey  when set, only scenarios for this agentKey are returned
 * @param token     a Clerk session JWT (from useAuth().getToken())
 */
export async function fetchScenarios(
  agentKey: string | undefined,
  token: string | null,
): Promise<EvalScenario[]> {
  const query = agentKey ? `?agentKey=${encodeURIComponent(agentKey)}` : ''
  const res = await fetch(`${pipelineBaseUrl()}/eval/scenarios${query}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `fetchScenarios failed (${res.status})${detail ? `: ${detail}` : ''}`,
    )
  }

  const json = (await res.json()) as { scenarios: EvalScenario[] }
  return json.scenarios
}
