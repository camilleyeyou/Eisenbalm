/**
 * Phase 45 (REV-04, docs/API_CONTRACTS.md §45.2) — client for the pipeline's
 * passage-revision preview/apply endpoint pair.
 *
 * Mirrors factCheckClient.ts (and contentPatchClient.ts/reviewClient.ts before
 * it):
 *   - pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL (throws if unset,
 *     strips trailing slash) — own private copy, matching the per-client
 *     precedent (each module keeps its own copy rather than a shared
 *     cross-import).
 *   - Bearer token from useAuth().getToken() passed as Authorization header.
 *   - Non-2xx responses surface a typed { status, reason, message } error —
 *     the caller branches on 'cost_cap_exceeded' (409, preview) /
 *     'revision_mismatch' / 'span_not_resolved' / 'claim_edit_unavailable'
 *     (409, apply) — see api/revision.py for the full reason set.
 *
 * This module (and this app) NEVER imports the Sanity client SDK or talks to
 * the Sanity content API directly — see
 * __tests__/dispatch-control-no-sanity-write.test.ts (EDT-05 tripwire). ALL
 * content-touching writes go through the pipeline API.
 */

/**
 * Reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips trailing slash).
 * Duplicates the private helper in factCheckClient.ts/contentPatchClient.ts/
 * findingsClient.ts/voicePassClient.ts by design — each client module keeps
 * its own private copy rather than a shared cross-import (matches the
 * existing precedent).
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
 * Structured error for non-2xx responses from the revision endpoints. For a
 * `cost_cap_exceeded` (409, preview) response, the server's detail also
 * carries `spentUsd`/`projectedUsd`/`capUsd` (§45.5, D-14) — carried onto the
 * error as optional fields so the caller can render an explanatory
 * disabled-chip title (D-14) without a second round trip.
 */
export class RevisionError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    message: string,
    public readonly spentUsd?: number,
    public readonly projectedUsd?: number,
    public readonly capUsd?: number,
  ) {
    super(message)
    this.name = 'RevisionError'
  }
}

// ── Shapes (§45.1/§45.2) ─────────────────────────────────────────────────────

/** The seven REV-02 direction-chip identifiers (§45.1 — locked, never invented). */
export type DirectionChip =
  | 'make_clearer'
  | 'make_more_specific'
  | 'tighten'
  | 'match_brief'
  | 'reduce_repetition'
  | 'try_another_approach'
  | 'custom'

export interface RevisePreviewBody {
  sectionName: string
  quotedText: string
  blockIndexHint?: number
  direction: DirectionChip
  customDirection?: string
  priorProposals?: string[]
}

export interface RevisionClaimDelta {
  added: string[]
  removed: string[]
  altered: string[]
}

export interface RevisePreviewResult {
  proposedText: string
  whatChanged: string
  claimDelta: RevisionClaimDelta
}

export interface ReviseApplyBody {
  ifRevisionID: string
  sectionName: string
  quotedText: string
  blockIndexHint?: number
  newText: string
}

export interface ReviseApplyResult {
  revisionId: string
  resolution: string
}

// ── Internal fetch helper ────────────────────────────────────────────────────

async function _revisionFetch<T>(
  method: 'GET' | 'POST',
  path: string,
  token: string | null,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${pipelineBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    let reason = 'unknown'
    let message = `HTTP ${res.status}`
    let spentUsd: number | undefined
    let projectedUsd: number | undefined
    let capUsd: number | undefined
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
      if (typeof detail?.spentUsd === 'number') spentUsd = detail.spentUsd
      if (typeof detail?.projectedUsd === 'number') projectedUsd = detail.projectedUsd
      if (typeof detail?.capUsd === 'number') capUsd = detail.capUsd
    } catch {
      const text = await res.text().catch(() => '')
      if (text) message = text
    }
    throw new RevisionError(res.status, reason, message, spentUsd, projectedUsd, capUsd)
  }

  return (await res.json()) as T
}

function revisionPath(runId: string, suffix: string): string {
  return `/issues/${encodeURIComponent(runId)}/revise${suffix}`
}

// ── previewRevision (§45.2/§45.3, step 1) ────────────────────────────────────

/**
 * POST /issues/{runId}/revise/preview — "Ask agent to revise" STEP 1.
 * Read-only: no Convex mutation, no Sanity write, no audit row (D-02/§45.3).
 * On a `cost_cap_exceeded` 409 (REV-05/D-14), throws `RevisionError` carrying
 * `spentUsd`/`projectedUsd`/`capUsd` for the caller's disabled-chip UI.
 */
export async function previewRevision(
  runId: string,
  body: RevisePreviewBody,
  token: string | null,
): Promise<RevisePreviewResult> {
  return _revisionFetch<RevisePreviewResult>(
    'POST',
    revisionPath(runId, '/preview'),
    token,
    body as unknown as Record<string, unknown>,
  )
}

// ── applyRevision (§45.2/§45.4, step 2) ──────────────────────────────────────

/**
 * POST /issues/{runId}/revise/apply — "Ask agent to revise" STEP 2. Applies
 * the STEP 1 preview (or an operator-edited replacement) atomically: span
 * re-resolved against CURRENT Sanity content, content-patched, touched claims
 * reset, sign-offs revoked, exactly one audit row emitted (§45.4).
 * `ifRevisionID` MUST be freshly obtained (via `getDraft`) immediately before
 * calling this.
 */
export async function applyRevision(
  runId: string,
  body: ReviseApplyBody,
  token: string | null,
): Promise<ReviseApplyResult> {
  return _revisionFetch<ReviseApplyResult>(
    'POST',
    revisionPath(runId, '/apply'),
    token,
    body as unknown as Record<string, unknown>,
  )
}
