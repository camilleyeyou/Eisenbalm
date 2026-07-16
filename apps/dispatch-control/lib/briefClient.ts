/**
 * Phase 47 (BRF-05/BRF-06, docs/API_CONTRACTS.md §47.5) — client for the
 * pipeline's Brief edit + field-strengthen endpoint trio.
 *
 * Mirrors revisionClient.ts's previewRevision/applyRevision shape (per this
 * plan's <interfaces> block):
 *   - pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL (throws if unset,
 *     strips trailing slash) — own private copy, matching the per-client
 *     precedent (each module keeps its own copy rather than a shared
 *     cross-import).
 *   - Bearer token from useAuth().getToken() passed as Authorization header.
 *   - Non-2xx responses surface a typed BriefClientError — `strengthen/
 *     preview` can 409 with `cost_cap_exceeded` (mirrors revise/preview,
 *     REV-05/D-14), carrying spentUsd/projectedUsd/capUsd for the caller.
 *
 * Endpoints (packages/pipeline/src/eisenbalm_pipeline/api/brief.py):
 *   PATCH /issues/{runId}/brief                              body {field, value}   -> {resolution:'brief_field_edited'}
 *   POST  /issues/{runId}/brief/{field}/strengthen/preview    body {currentValue}   -> {proposedText, whatChanged}
 *   POST  /issues/{runId}/brief/{field}/strengthen/apply      body {newText}        -> {resolution:'brief_field_strengthened'}
 *
 * This module NEVER imports the Sanity client SDK or talks to the Sanity
 * content API directly — see __tests__/dispatch-control-no-sanity-write.
 * test.ts (EDT-05 tripwire). ALL content-touching writes go through the
 * pipeline API.
 */

/**
 * Reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips trailing slash).
 * Duplicates the private helper in revisionClient.ts/factCheckClient.ts/
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

// ── The six Brief fields (§47.1) — the only valid `field` values ───────────

export type BriefField =
  | 'premise'
  | 'currentPeg'
  | 'centralClaim'
  | 'readerEffect'
  | 'knownRisks'
  | 'voiceIntention'

// ── Structured error ─────────────────────────────────────────────────────────

/**
 * Structured error for non-2xx responses from the Brief endpoints. For a
 * `cost_cap_exceeded` (409, strengthen/preview) response, the server's
 * detail also carries `spentUsd`/`projectedUsd`/`capUsd` — carried onto the
 * error as optional fields so the caller can render an explanatory
 * disabled-state message without a second round trip (mirrors
 * revisionClient.ts::RevisionError).
 */
export class BriefClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    message: string,
    public readonly spentUsd?: number,
    public readonly projectedUsd?: number,
    public readonly capUsd?: number,
  ) {
    super(message)
    this.name = 'BriefClientError'
  }
}

// ── Shapes (§47.5) ───────────────────────────────────────────────────────────

export interface PatchBriefResult {
  resolution: string
}

export interface BriefStrengthenPreviewResult {
  proposedText: string
  whatChanged: string
}

export interface BriefStrengthenApplyResult {
  resolution: string
}

// ── Internal fetch helper ────────────────────────────────────────────────────

async function _briefFetch<T>(
  method: 'PATCH' | 'POST',
  path: string,
  token: string | null,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${pipelineBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
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
    throw new BriefClientError(res.status, reason, message, spentUsd, projectedUsd, capUsd)
  }

  return (await res.json()) as T
}

// ── patchBrief (BRF-05, §47.5) ───────────────────────────────────────────────

/**
 * PATCH /issues/{runId}/brief — the direct field edit from `BriefFieldTable`
 * (BRF-05). Guarded content boundary: Clerk -> `briefs:patch` -> a
 * (reasonless) `audit_log` row (D-12) — never a bare dashboard
 * `useMutation`.
 */
export async function patchBrief(
  runId: string,
  field: BriefField,
  value: string,
  token: string | null,
): Promise<PatchBriefResult> {
  return _briefFetch<PatchBriefResult>(
    'PATCH',
    `/issues/${encodeURIComponent(runId)}/brief`,
    token,
    { field, value },
  )
}

// ── strengthenBriefFieldPreview (BRF-06, §47.5, step 1) ─────────────────────

/**
 * POST /issues/{runId}/brief/{field}/strengthen/preview — "Ask an agent to
 * strengthen" STEP 1. Read-only: no Convex mutation, no audit row
 * (mirrors revise/preview). On a `cost_cap_exceeded` 409, throws
 * `BriefClientError` carrying `spentUsd`/`projectedUsd`/`capUsd`.
 */
export async function strengthenBriefFieldPreview(
  runId: string,
  field: BriefField,
  currentValue: string,
  token: string | null,
): Promise<BriefStrengthenPreviewResult> {
  return _briefFetch<BriefStrengthenPreviewResult>(
    'POST',
    `/issues/${encodeURIComponent(runId)}/brief/${encodeURIComponent(field)}/strengthen/preview`,
    token,
    { currentValue },
  )
}

// ── strengthenBriefFieldApply (BRF-06, §47.5, step 2) ────────────────────────

/**
 * POST /issues/{runId}/brief/{field}/strengthen/apply — "Ask an agent to
 * strengthen" STEP 2. Writes the accepted proposal via `briefs:patch` and
 * emits ONE audit_log row WITH a structured `reason=` so accepting a
 * strengthened field surfaces in the shared Decision log (mirrors
 * revise/apply, but reasoned — unlike passage revision's unreasoned
 * `passage_revised` row).
 */
export async function strengthenBriefFieldApply(
  runId: string,
  field: BriefField,
  newText: string,
  token: string | null,
): Promise<BriefStrengthenApplyResult> {
  return _briefFetch<BriefStrengthenApplyResult>(
    'POST',
    `/issues/${encodeURIComponent(runId)}/brief/${encodeURIComponent(field)}/strengthen/apply`,
    token,
    { newText },
  )
}
