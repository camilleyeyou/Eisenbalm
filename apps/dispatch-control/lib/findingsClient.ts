/**
 * Phase 33 (EDT-04) — client for the pipeline's findings action endpoints
 * (docs/API_CONTRACTS.md §33.3).
 *
 * Mirrors contentPatchClient.ts:
 *   - pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL (throws if unset,
 *     strips trailing slash)
 *   - Bearer token from useAuth().getToken() passed as Authorization header
 *   - Non-2xx responses surface a typed { status, reason, message } error so
 *     the popover can branch on:
 *       'revision_mismatch'  (409) — reload the draft, ask the operator to
 *                                    re-open the popover and retry
 *       'span_not_resolved'  (409) — D-05 never guess: tell the operator to
 *                                    use Edit inline instead
 *       'accept_unavailable' (409) — no suggestedFix / no anchorable body
 *       'already_resolved'   (409) — someone else resolved it first
 *
 * The FastAPI endpoints raise HTTPException with a dict detail, so error
 * bodies arrive as `{detail: {reason, message}}` — unwrapped here (with a
 * flat `{reason, message}` fallback for non-enveloped shapes).
 *
 * This module (and this app) NEVER imports the Sanity client SDK or performs
 * a dashboard-side Convex mutation for resolution flips — the write boundary
 * is dashboard → pipeline API → Sanity/Convex (D-02). See
 * __tests__/dispatch-control-no-sanity-write.test.ts (EDT-05 tripwire).
 */

/**
 * Reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips trailing slash).
 * Duplicates the private helper in reviewClient.ts / contentPatchClient.ts /
 * pipelineControlClient.ts by design — each client module keeps its own
 * private copy rather than a shared cross-import (matches the existing
 * precedent).
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

// ── Structured error ─────────────────────────────────────────────────────────

/**
 * Structured error for non-2xx responses from the findings endpoints.
 * `reason` is one of the §33.3 reason strings the popover branches on.
 */
export class FindingsError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    message: string,
  ) {
    super(message)
    this.name = 'FindingsError'
  }
}

// ── Result shapes (§33.3) ────────────────────────────────────────────────────

export interface AcceptFindingResult {
  revisionId: string
  findingId: string
  resolution: 'accepted'
}

export interface DismissFindingResult {
  findingId: string
  resolution: 'dismissed'
}

export interface ReopenFindingResult {
  findingId: string
  resolution: null
}

// ── Internal fetch helper ────────────────────────────────────────────────────

async function _findingsFetch<T>(
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
    throw new FindingsError(res.status, reason, message)
  }

  return (await res.json()) as T
}

// ── acceptFinding (EDT-04, D-07) ─────────────────────────────────────────────

/**
 * POST /issues/{run_id}/findings/{finding_id}/accept — applies the finding's
 * suggestedFix to the live Sanity draft via the pipeline (server-side span
 * re-resolution, §33.5). The caller MUST refetch the draft on success (and on
 * a `revision_mismatch` 409) so client-side re-resolution runs against fresh
 * text (EDT-06).
 *
 * Phase 36 (§36.6): `payload.suggestedFixOverride` lets a rule-only tell
 * (no stored `suggestedFix`) be accepted with an on-demand voice-rewrite
 * result (`voicePassClient.rewrite`) — the server prefers the override when
 * present, falling back to the finding's stored `suggestedFix` otherwise.
 */
export async function acceptFinding(
  runId: string,
  findingId: string,
  payload: { ifRevisionID: string; suggestedFixOverride?: string },
  token: string | null,
): Promise<AcceptFindingResult> {
  return _findingsFetch<AcceptFindingResult>(
    `/issues/${encodeURIComponent(runId)}/findings/${encodeURIComponent(findingId)}/accept`,
    token,
    payload,
  )
}

// ── dismissFinding (EDT-04, D-11) ────────────────────────────────────────────

/**
 * POST /issues/{run_id}/findings/{finding_id}/dismiss — requires a non-empty
 * one-line reason (a whitespace-only reason 422s server-side). No Sanity
 * write; the finding drops from open surfaces reactively via Convex.
 */
export async function dismissFinding(
  runId: string,
  findingId: string,
  payload: { reason: string },
  token: string | null,
): Promise<DismissFindingResult> {
  return _findingsFetch<DismissFindingResult>(
    `/issues/${encodeURIComponent(runId)}/findings/${encodeURIComponent(findingId)}/dismiss`,
    token,
    payload,
  )
}

// ── reopenFinding (D-04) ─────────────────────────────────────────────────────

/**
 * POST /issues/{run_id}/findings/{finding_id}/reopen — clears the resolution
 * (never reverts text). No body.
 */
export async function reopenFinding(
  runId: string,
  findingId: string,
  token: string | null,
): Promise<ReopenFindingResult> {
  return _findingsFetch<ReopenFindingResult>(
    `/issues/${encodeURIComponent(runId)}/findings/${encodeURIComponent(findingId)}/reopen`,
    token,
  )
}
