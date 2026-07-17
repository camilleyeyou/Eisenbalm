/**
 * Phase 34 (PUB-01, PUB-03) — client for the pipeline sign-off endpoint.
 *
 * Mirrors reviewClient.ts:
 *   - pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips slash)
 *   - Bearer token from useAuth().getToken() passed as Authorization header
 *   - 4xx responses surface a typed reason string so the UI can show
 *     the server's message ("claims_not_signed_off", "open_error_findings", etc.)
 *
 * Endpoint covered (API_CONTRACTS §34.3):
 *   POST /issues/{runId}/sign-off  body { kind } — record a "facts-cleared" or
 *   "sounds-human" sign-off. NOTE: there is NO manual revoke endpoint —
 *   revocation happens only via D-08 auto-revoke on content mutation.
 */

/**
 * Reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips trailing slash).
 * Duplicates the private helper in reviewClient.ts/pipelineControlClient.ts —
 * kept private there, so we re-implement it here to avoid exposing internals.
 */
function pipelineBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_PIPELINE_URL
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_PIPELINE_URL is not set — cannot reach the pipeline endpoint.',
    )
  }
  return url.replace(/\/$/, '')
}

// ── Typed result interfaces ─────────────────────────────────────────────────

export type SignOffKind = 'facts-cleared' | 'sounds-human'

export interface RecordSignOffResult {
  runId: string
  kind: SignOffKind
  signedAt: number
}

/**
 * Structured error for 4xx responses from the sign-off endpoint.
 * `reason` maps to the server's 409 reason ("claims_not_signed_off",
 * "open_error_findings").
 */
export class SignOffApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    message: string,
  ) {
    super(message)
    this.name = 'SignOffApiError'
  }
}

// ── Internal helper ─────────────────────────────────────────────────────────

async function _signOffFetch<T>(
  path: string,
  token: string | null,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${pipelineBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    let reason = 'unknown'
    let message = `HTTP ${res.status}`
    try {
      const parsed = await res.json()
      // FastAPI HTTPException wraps dict details as {detail: {reason, message}};
      // fall back to a flat {reason, message} body.
      const detail =
        parsed?.detail && typeof parsed.detail === 'object' ? parsed.detail : parsed
      if (detail?.reason) reason = detail.reason
      if (detail?.message) message = detail.message
      else if (typeof parsed?.detail === 'string') message = parsed.detail
      else if (typeof parsed === 'string') message = parsed
    } catch {
      const text = await res.text().catch(() => '')
      if (text) message = text
    }
    throw new SignOffApiError(res.status, reason, message)
  }

  return (await res.json()) as T
}

// ── recordSignOff ────────────────────────────────────────────────────────────

/**
 * Record a sign-off ("facts-cleared" or "sounds-human") for a run.
 *
 * On success: returns `{ runId, kind, signedAt }`.
 * On 409 `claims_not_signed_off` (facts-cleared only): SignOffApiError — show
 *   "All claim checks must be signed off before clearing facts."
 * On 409 `open_error_findings` (facts-cleared only): SignOffApiError — show
 *   "{n} error finding(s) must be accepted or dismissed before clearing facts."
 *
 * @param token   Clerk session JWT (from useAuth().getToken())
 * @param runId   the run's runId string
 * @param kind    which sign-off to record
 */
export async function recordSignOff(
  token: string | null,
  runId: string,
  kind: SignOffKind,
): Promise<RecordSignOffResult> {
  return _signOffFetch<RecordSignOffResult>(
    `/issues/${encodeURIComponent(runId)}/sign-off`,
    token,
    { kind },
  )
}
