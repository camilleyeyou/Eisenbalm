/**
 * Phase 24 (PRM-05) — client for the single-agent test-run endpoint.
 *
 * POSTs the CURRENT unsaved editor draft (D-03) to the pipeline's
 * `POST /agents/{agent_key}/test-run` (docs/API_CONTRACTS §3A.1) with a Clerk
 * bearer token (require_clerk_jwt). This is a prompt-EVALUATION utility — it
 * does NOT run the pipeline and writes to no real run/issue table.
 *
 * Pipeline base URL: NEXT_PUBLIC_PIPELINE_URL (documented in .env.example).
 */

export interface TestRunBody {
  /** The unsaved SYSTEM prompt text (D-03). */
  draft_prompt: string
  /** Unsaved user-template text, when the agent has one. */
  draft_user_template?: string
  /** Template variable values (manual entry or fixture). */
  variables: Record<string, string>
  /** When set, the pipeline loads inputs from agent_run_payloads (mode 1). */
  prior_run_id?: string
}

export interface TestRunResult {
  output: string
  cost_usd: number
  tokens_in: number
  tokens_out: number
  model: string
  duration_ms: number
}

function pipelineBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_PIPELINE_URL
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_PIPELINE_URL is not set — cannot reach the pipeline test-run endpoint.',
    )
  }
  return url.replace(/\/$/, '')
}

/**
 * Run a single agent against the supplied draft + inputs.
 *
 * @param agentKey  the pipeline agent key (e.g. 'scout', 'game')
 * @param body      draft + variables + optional prior_run_id
 * @param token     a Clerk session JWT (from useAuth().getToken())
 */
export async function runAgentTest(
  agentKey: string,
  body: TestRunBody,
  token: string | null,
): Promise<TestRunResult> {
  const res = await fetch(
    `${pipelineBaseUrl()}/agents/${encodeURIComponent(agentKey)}/test-run`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        workspace_id: 'eisenbalm',
        draft_prompt: body.draft_prompt,
        draft_user_template: body.draft_user_template,
        variables: body.variables,
        prior_run_id: body.prior_run_id,
      }),
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `test-run failed (${res.status})${detail ? `: ${detail}` : ''}`,
    )
  }

  return (await res.json()) as TestRunResult
}
