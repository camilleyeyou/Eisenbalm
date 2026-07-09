/**
 * Phase 25 (RUN-01..RUN-06) — client for pipeline run-control endpoints.
 *
 * Mirrors the testRunClient.ts pattern exactly:
 *   - pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips slash)
 *   - Bearer token from useAuth().getToken() passed as Authorization header
 *   - On !res.ok: throw Error including status + body detail text
 *
 * Endpoints covered (API_CONTRACTS §3B):
 *   POST /pipeline/run             — trigger a new run (RUN-01)
 *   POST /runs/{id}/cancel         — cooperative cancel (RUN-04)
 *   POST /runs/{id}/agents/{key}/rerun — single-section re-roll (RUN-05)
 *
 * Phase 37 (SIG-03, §37.3) adds:
 *   POST /issues/{run_id}/adjudicate — Clerk-guarded Gate-1 adjudication
 *   bridge (adjudicateGate1). This is the ONLY endpoint the dashboard may
 *   call to resume a paused Gate-1 run — it is Clerk-JWT-guarded, NOT
 *   trigger-secret-guarded (that separate guard belongs to the
 *   server-to-server POST /run/{run_id}/resume, which this client never
 *   calls and which the operator never sees).
 */

export interface TriggerRunBody {
  /** Optional: force a specific issue number (omit for auto-resolve). */
  issueNumber?: number
  /** Optional: narrator profile slug to use for this run. */
  narratorSlug?: string
}

export interface TriggerRunResult {
  runId: string
}

export interface CancelRunResult {
  runId: string
  cancelRequested?: boolean
  alreadyTerminal?: boolean
  status?: string
}

export interface RerollAgentResult {
  runId: string
  agentKey: string
  rerolled: boolean
}

function pipelineBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_PIPELINE_URL
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_PIPELINE_URL is not set — cannot reach the pipeline endpoint.',
    )
  }
  return url.replace(/\/$/, '')
}

/**
 * Trigger a new pipeline run.
 *
 * @param body    optional issue number / narrator slug
 * @param token   a Clerk session JWT (from useAuth().getToken())
 */
export async function triggerRun(
  body: TriggerRunBody,
  token: string | null,
): Promise<TriggerRunResult> {
  const res = await fetch(`${pipelineBaseUrl()}/pipeline/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `trigger-run failed (${res.status})${detail ? `: ${detail}` : ''}`,
    )
  }

  return (await res.json()) as TriggerRunResult
}

/**
 * Request cooperative cancellation of a running run.
 *
 * Idempotent: if the run is already in a terminal state the endpoint returns
 * { alreadyTerminal: true } with 200 — no error is thrown.
 *
 * @param runId   the run's runId string
 * @param token   a Clerk session JWT (from useAuth().getToken())
 */
export async function cancelRun(
  runId: string,
  token: string | null,
): Promise<CancelRunResult> {
  const res = await fetch(
    `${pipelineBaseUrl()}/runs/${encodeURIComponent(runId)}/cancel`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `cancel-run failed (${res.status})${detail ? `: ${detail}` : ''}`,
    )
  }

  return (await res.json()) as CancelRunResult
}

/**
 * Re-run a single section-writer agent for an existing run.
 *
 * Only the 7 section writers are re-rollable (origin_story, problem,
 * founder_bio, case_study, game, bonus, design). The endpoint returns 422
 * for any other agentKey. Blocked while the run is still running (409).
 *
 * @param runId     the run's runId string
 * @param agentKey  the section-writer agent key (e.g. 'origin_story')
 * @param token     a Clerk session JWT (from useAuth().getToken())
 */
export async function rerollAgent(
  runId: string,
  agentKey: string,
  token: string | null,
): Promise<RerollAgentResult> {
  const res = await fetch(
    `${pipelineBaseUrl()}/runs/${encodeURIComponent(runId)}/agents/${encodeURIComponent(agentKey)}/rerun`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `reroll-agent failed (${res.status})${detail ? `: ${detail}` : ''}`,
    )
  }

  return (await res.json()) as RerollAgentResult
}

export interface AdjudicateGate1Selection {
  charityName: string
}

export interface AdjudicateGate1Body {
  selection: AdjudicateGate1Selection
  reason: string
}

export interface AdjudicateGate1Result {
  runId: string
  resumed?: boolean
  charityName?: string
}

/**
 * Submit the operator's Gate-1 pick + reason to the Clerk-guarded
 * adjudication bridge (API_CONTRACTS §37.3): `POST /issues/{run_id}/adjudicate`.
 *
 * 409s if the run isn't currently paused at Gate 1 (`state.next` empty).
 * `reason` is required by the server and stored via `audit_log` only — it is
 * never threaded into the LangGraph resume payload. This function never
 * references PIPELINE_TRIGGER_SECRET; that guards the separate
 * server-to-server resume endpoint this bridge calls internally.
 *
 * @param runId   the paused run's runId string
 * @param body    { selection: { charityName }, reason } — the operator's pick + reason
 * @param token   a Clerk session JWT (from useAuth().getToken())
 */
export async function adjudicateGate1(
  runId: string,
  body: AdjudicateGate1Body,
  token: string | null,
): Promise<AdjudicateGate1Result> {
  const res = await fetch(
    `${pipelineBaseUrl()}/issues/${encodeURIComponent(runId)}/adjudicate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `adjudicate-gate1 failed (${res.status})${detail ? `: ${detail}` : ''}`,
    )
  }

  return (await res.json()) as AdjudicateGate1Result
}
