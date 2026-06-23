/**
 * Phase 26 (RVW-03) — client for pipeline review-decision endpoints.
 *
 * Mirrors pipelineControlClient.ts:
 *   - pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips slash)
 *   - Bearer token from useAuth().getToken() passed as Authorization header
 *   - 4xx responses surface a typed reason string so the UI can show
 *     the UI-SPEC error copy ("claims_not_signed_off", "wrong_status", etc.)
 *
 * Endpoints covered (API_CONTRACTS §26.3 / Plan 26-03):
 *   POST /issues/{runId}/publish  — approve + publish immediately (RVW-03)
 *   POST /issues/{runId}/schedule — approve + schedule for future publish
 *   POST /issues/{runId}/reject   — reject run (stays awaiting-review)
 */

/**
 * Reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips trailing slash).
 * Duplicates the private helper in pipelineControlClient.ts — kept private
 * there, so we re-implement it here to avoid exposing internals.
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

export interface PublishIssueResult {
  issueId: string
  published: true
}

export interface ScheduleIssueResult {
  issueId: string
  scheduledAt: number
}

export interface RejectIssueResult {
  issueId: string | null
  rejected: true
}

/**
 * Structured error for 4xx responses from the review endpoints.
 * `reason` maps to the UI-SPEC error copy table.
 */
export class ReviewApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    message: string,
  ) {
    super(message)
    this.name = 'ReviewApiError'
  }
}

// ── Internal helper ─────────────────────────────────────────────────────────

async function _reviewFetch<T>(
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
      const detail = await res.json()
      if (detail?.reason) reason = detail.reason
      if (detail?.message) message = detail.message
      else if (typeof detail === 'string') message = detail
    } catch {
      const text = await res.text().catch(() => '')
      if (text) message = text
    }
    throw new ReviewApiError(res.status, reason, message)
  }

  return (await res.json()) as T
}

// ── publishIssue ─────────────────────────────────────────────────────────────

/**
 * Approve and publish a run immediately.
 *
 * On success: returns `{ issueId, published: true }`.
 * On 409 `claims_not_signed_off`: ReviewApiError — show
 *   "Sign off all factual claims before publishing."
 * On 409 `wrong_status`: ReviewApiError — show
 *   "This run cannot be published in its current state."
 *
 * @param token   Clerk session JWT (from useAuth().getToken())
 * @param runId   the run's runId string
 */
export async function publishIssue(
  token: string | null,
  runId: string,
): Promise<PublishIssueResult> {
  return _reviewFetch<PublishIssueResult>(
    `/issues/${encodeURIComponent(runId)}/publish`,
    token,
  )
}

// ── scheduleIssue ─────────────────────────────────────────────────────────────

/**
 * Approve and schedule a run for future publish.
 *
 * On success: returns `{ issueId, scheduledAt }`.
 * On 400 `schedule_in_past`: ReviewApiError — show "Choose a time in the future."
 * On 409: ReviewApiError with reason "claims_not_signed_off" or "wrong_status".
 *
 * @param token        Clerk session JWT
 * @param runId        the run's runId string
 * @param scheduledAt  Unix ms timestamp for the desired publish time
 */
export async function scheduleIssue(
  token: string | null,
  runId: string,
  scheduledAt: number,
): Promise<ScheduleIssueResult> {
  return _reviewFetch<ScheduleIssueResult>(
    `/issues/${encodeURIComponent(runId)}/schedule`,
    token,
    { scheduledAt },
  )
}

// ── rejectIssue ──────────────────────────────────────────────────────────────

/**
 * Reject a run (status stays "awaiting-review" — the run is flagged, not deleted).
 *
 * On success: returns `{ issueId, rejected: true }`.
 * No claims gate — reject is always allowed so operators can un-stick a run.
 *
 * @param token   Clerk session JWT
 * @param runId   the run's runId string
 * @param note    optional free-text rejection note
 */
export async function rejectIssue(
  token: string | null,
  runId: string,
  note?: string,
): Promise<RejectIssueResult> {
  return _reviewFetch<RejectIssueResult>(
    `/issues/${encodeURIComponent(runId)}/reject`,
    token,
    { note },
  )
}
