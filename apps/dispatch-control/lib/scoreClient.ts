/**
 * Phase 28 (PRC-09) — client for the single-output voice-rubric scoring endpoint.
 *
 * POSTs ONE arbitrary agent output to the pipeline's
 * `POST /agents/{agent_key}/score` (docs/API_CONTRACTS §3A.2) with a Clerk
 * bearer token (_require_operator). It returns a per-axis voice-rubric breakdown
 * + an overall headline number + a 1-2 line rationale. The score is the standout
 * authoring-loop guardrail — but it is ADVISORY ONLY and never gates any action.
 *
 * Mirrors testRunClient.ts (same base URL, same bearer + error-handling shape).
 * Pipeline base URL: NEXT_PUBLIC_PIPELINE_URL (shared via pipelineBaseUrl()).
 */
import { pipelineBaseUrl } from '@/lib/testRunClient'

/** One rubric axis's score (e.g. gravity / sentiment / irony / precision). */
export interface VoiceAxisScore {
  axis: string
  score: number
  pass: boolean
  note: string
}

/** The §3A.2 ScoreResponse shape. */
export interface ScoreResult {
  /** Headline 0-10. */
  overall: number
  axes: VoiceAxisScore[]
  /** 1-2 line summary. */
  rationale: string
  /** Which rubric the scorer resolved: 'convex' (active row) or 'disk'. */
  rubric_source: string
  cost_usd: number
  tokens_in: number
  tokens_out: number
  model: string
  duration_ms: number
}

/**
 * Score a single agent output against the live active voice rubric.
 *
 * @param agentKey  the pipeline agent key (canonical path param; the body echoes it)
 * @param output    a SINGLE arbitrary agent output to score
 * @param token     a Clerk session JWT (from useAuth().getToken())
 */
export async function scoreOutput(
  agentKey: string,
  output: string,
  token: string | null,
): Promise<ScoreResult> {
  const res = await fetch(
    `${pipelineBaseUrl()}/agents/${encodeURIComponent(agentKey)}/score`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        workspace_id: 'eisenbalm',
        agent_key: agentKey,
        output,
      }),
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `score failed (${res.status})${detail ? `: ${detail}` : ''}`,
    )
  }

  return (await res.json()) as ScoreResult
}
