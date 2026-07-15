/**
 * Phase 42 (FCT-05/FCT-06, docs/API_CONTRACTS.md §42.4) — client for the
 * pipeline's Fact Check claim-action + evidence endpoints.
 *
 * Mirrors findingsClient.ts/voicePassClient.ts/contentPatchClient.ts:
 *   - pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL (throws if unset,
 *     strips trailing slash)
 *   - Bearer token from useAuth().getToken() passed as Authorization header
 *   - Non-2xx responses surface a typed { status, reason, message } error —
 *     the caller branches on 'revision_mismatch' / 'span_not_resolved' /
 *     'claim_edit_unavailable' / 'empty_reason' / 'missing_revision_id' /
 *     'no_evidence_found' (see api/factcheck.py for the full reason set).
 *
 * Six functions covering the four non-evidence claim actions plus the
 * two-step "Ask agent for better evidence" contract (§42.4a). Confirm
 * (dashboard -> claimChecks:setStatus, requireOperator) is NOT here — it
 * stays a direct Convex mutation (D-14), unchanged from the existing galley
 * popover/SourceIndex pattern.
 *
 * This module (and this app) NEVER imports the Sanity client SDK or talks to
 * the Sanity content API directly — see
 * __tests__/dispatch-control-no-sanity-write.test.ts (EDT-05 tripwire). ALL
 * content-touching writes go through the pipeline API.
 */

/**
 * Reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips trailing slash).
 * Duplicates the private helper in contentPatchClient.ts/findingsClient.ts/
 * voicePassClient.ts by design — each client module keeps its own private
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

// ── Structured error ─────────────────────────────────────────────────────────

export class FactCheckError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    message: string,
  ) {
    super(message)
    this.name = 'FactCheckError'
  }
}

// ── Result/payload shapes (§42.4) ────────────────────────────────────────────

export interface KeepClaimResult {
  claimIndex: number
  status: string
}

export interface PatchClaimBody {
  ifRevisionID?: string
  text?: string
  sourceUrl?: string
  retrievedAt?: number
}

export interface PatchClaimResult {
  claimIndex: number
  revisionId: string | null
}

export interface ReplaceSourceBody {
  sourceUrl: string
  retrievedAt?: number
}

export interface ReplaceSourceResult {
  claimIndex: number
  sourceUrl: string
  retrievedAt: number
}

export interface RemoveClaimResult {
  claimIndex: number
  status: string
}

export interface EvidencePreviewResult {
  sourceUrl: string
  sourcePublisher: string
  retrievedAt: number
  rewrittenClaim: string
}

export interface EvidenceApplyBody {
  ifRevisionID: string
  sourceUrl: string
  retrievedAt: number
  rewrittenClaim: string
}

export interface EvidenceApplyResult {
  revisionId: string
  claimIndex: number
  resolution: string
}

// ── Internal fetch helper ────────────────────────────────────────────────────

async function _factCheckFetch<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
    throw new FactCheckError(res.status, reason, message)
  }

  return (await res.json()) as T
}

function claimPath(runId: string, claimIndex: number, suffix = ''): string {
  return `/issues/${encodeURIComponent(runId)}/claims/${claimIndex}${suffix}`
}

// ── keepClaim (D-14/D-18) ────────────────────────────────────────────────────

/**
 * POST /issues/{runId}/claims/{claimIndex}/keep — Keep as written. `reason`
 * is mandatory (the server 422s on an empty/whitespace-only reason).
 */
export async function keepClaim(
  runId: string,
  claimIndex: number,
  reason: string,
  token: string | null,
): Promise<KeepClaimResult> {
  return _factCheckFetch<KeepClaimResult>('POST', claimPath(runId, claimIndex, '/keep'), token, {
    reason,
  })
}

// ── patchClaim (D-14/D-15) ───────────────────────────────────────────────────

/**
 * PATCH /issues/{runId}/claims/{claimIndex} — Edit claim. Metadata-only
 * (no `text`) when the caller only wants to adjust `sourceUrl`/`retrievedAt`
 * — no `ifRevisionID` required in that branch. When `text` is present, the
 * caller MUST supply a fresh `ifRevisionID` (obtained via `getDraft` — see
 * FactCheckScreen) or the server 400s with `missing_revision_id`.
 */
export async function patchClaim(
  runId: string,
  claimIndex: number,
  body: PatchClaimBody,
  token: string | null,
): Promise<PatchClaimResult> {
  return _factCheckFetch<PatchClaimResult>(
    'PATCH',
    claimPath(runId, claimIndex),
    token,
    body as unknown as Record<string, unknown>,
  )
}

// ── replaceSource (D-14/D-15) ────────────────────────────────────────────────

/**
 * POST /issues/{runId}/claims/{claimIndex}/replace-source — metadata-only;
 * no Sanity write. The server code-stamps `retrievedAt` when omitted.
 */
export async function replaceSource(
  runId: string,
  claimIndex: number,
  body: ReplaceSourceBody,
  token: string | null,
): Promise<ReplaceSourceResult> {
  return _factCheckFetch<ReplaceSourceResult>(
    'POST',
    claimPath(runId, claimIndex, '/replace-source'),
    token,
    body as unknown as Record<string, unknown>,
  )
}

// ── removeClaim (D-14/D-15) ───────────────────────────────────────────────────

/**
 * DELETE /issues/{runId}/claims/{claimIndex} — soft-delete via
 * `status: 'removed'`; `reason` is optional.
 */
export async function removeClaim(
  runId: string,
  claimIndex: number,
  reason: string | undefined,
  token: string | null,
): Promise<RemoveClaimResult> {
  return _factCheckFetch<RemoveClaimResult>(
    'DELETE',
    claimPath(runId, claimIndex),
    token,
    reason !== undefined ? { reason } : undefined,
  )
}

// ── evidencePreview (§42.4a, FCT-06 step 1) ──────────────────────────────────

/**
 * POST /issues/{runId}/claims/{claimIndex}/evidence/preview — "Ask agent for
 * better evidence" STEP 1. Read-only: generates a replacement source AND a
 * rewritten claim for a comparison card. NEVER mutates Convex or Sanity.
 */
export async function evidencePreview(
  runId: string,
  claimIndex: number,
  token: string | null,
): Promise<EvidencePreviewResult> {
  return _factCheckFetch<EvidencePreviewResult>(
    'POST',
    claimPath(runId, claimIndex, '/evidence/preview'),
    token,
    {},
  )
}

// ── evidenceApply (§42.4a, FCT-06 step 2) ────────────────────────────────────

/**
 * POST /issues/{runId}/claims/{claimIndex}/evidence/apply — "Ask agent for
 * better evidence" STEP 2. Applies the STEP 1 preview atomically: content
 * patch + claim update + decision-log entry. `ifRevisionID` MUST be freshly
 * obtained (via `getDraft`) immediately before calling this.
 */
export async function evidenceApply(
  runId: string,
  claimIndex: number,
  body: EvidenceApplyBody,
  token: string | null,
): Promise<EvidenceApplyResult> {
  return _factCheckFetch<EvidenceApplyResult>(
    'POST',
    claimPath(runId, claimIndex, '/evidence/apply'),
    token,
    body as unknown as Record<string, unknown>,
  )
}
