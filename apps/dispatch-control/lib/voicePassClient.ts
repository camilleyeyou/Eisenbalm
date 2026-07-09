/**
 * Phase 36 (VOX-04, §36.4) — client for the pipeline's on-demand voice
 * judge trigger.
 *
 * Mirrors signOffClient.ts:
 *   - pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips slash)
 *   - Bearer token from useAuth().getToken() passed as Authorization header
 *   - Non-2xx responses surface a typed reason string
 *
 * Endpoint covered (API_CONTRACTS §36.4):
 *   POST /issues/{runId}/voice-recheck  (no body) — re-runs the existing
 *   Opus judge (`agents/qa/judge.py::run_llm_judge`) against the current
 *   (post-edit) draft, superseding any still-open prior on-demand findings,
 *   and writes fresh voice-axis qaCorrections rows tagged
 *   `agentId="qa-recheck"`. The caller does not need to manually refetch
 *   findings — Convex reactivity surfaces them; `reloadDraft` is only ever
 *   needed after an ACCEPTED text change, not after a recheck.
 */

/**
 * Reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips trailing slash).
 * Duplicates the private helper in signOffClient.ts / contentPatchClient.ts /
 * findingsClient.ts by design — each client module keeps its own private
 * copy rather than a shared cross-import (matches the existing precedent).
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

// ── Typed result interface (§36.4) ──────────────────────────────────────────

export interface VoiceRecheckResult {
  runId: string
  findingCount: number
}

/** Structured error for non-2xx responses from the voice-pass endpoints. */
export class VoicePassApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    message: string,
  ) {
    super(message)
    this.name = 'VoicePassApiError'
  }
}

// ── Internal helper ─────────────────────────────────────────────────────────

async function _voicePassFetch<T>(
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
    throw new VoicePassApiError(res.status, reason, message)
  }

  return (await res.json()) as T
}

// ── recheck (§36.4, VOX-04) ──────────────────────────────────────────────────

/**
 * POST /issues/{runId}/voice-recheck — re-runs the Opus judge on demand
 * ("deterministic rules render instantly, judge on click" — VOX-04). Convex
 * reactivity surfaces the fresh voice-axis findings once written; the
 * caller's existing `qaCorrections:byRunId` subscription needs no manual
 * refetch.
 */
export async function recheck(
  runId: string,
  token: string | null,
): Promise<VoiceRecheckResult> {
  return _voicePassFetch<VoiceRecheckResult>(
    `/issues/${encodeURIComponent(runId)}/voice-recheck`,
    token,
  )
}
