/**
 * Phase 31 (EDT-01/EDT-02/EDT-03) — client for the pipeline's content-patch
 * endpoint family (docs/API_CONTRACTS.md §31).
 *
 * Mirrors reviewClient.ts:
 *   - pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips
 *     trailing slash)
 *   - Bearer token from useAuth().getToken() passed as Authorization header
 *   - Non-2xx responses surface a typed { reason, message } error so the
 *     editor can branch on 'revision_mismatch' (D-10 — prompt reload) vs
 *     'validation_failed' (D-08 — show field errors)
 *
 * §31.1 load-bearing correction: every route resolves run_id -> sanityIssueId
 * server-side and targets the plain `issue-{n}` document — never
 * `drafts.issue-{n}`. This client never constructs a Sanity document ID; it
 * only ever POSTs/PATCHes/GETs pipeline API routes keyed by runId.
 *
 * This module (and this app) NEVER imports the Sanity client SDK or talks to
 * the Sanity content API directly — see
 * __tests__/dispatch-control-no-sanity-write.test.ts (EDT-05 tripwire). ALL
 * writes go through the pipeline API.
 */

/**
 * Reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips trailing slash).
 * Duplicates the private helper in reviewClient.ts / pipelineControlClient.ts
 * by design — each client module keeps its own private copy rather than a
 * shared cross-import (matches the existing precedent).
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
 * Structured error for non-2xx responses from the content-patch endpoints.
 * `reason` is one of the §31.4/§31.5 reason strings the editor branches on:
 *   - 'revision_mismatch' (409) — D-10: prompt reload, reapply the edit
 *   - 'validation_failed' (4xx) — D-08: show field-level errors (`fields`)
 */
export class ContentPatchError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    message: string,
    public readonly fields?: string[],
  ) {
    super(message)
    this.name = 'ContentPatchError'
  }
}

// ── Shared payload/result shapes (mirrors §31.3/§31.7) ──────────────────────

export interface ContentBlock {
  type: 'paragraph' | 'h2' | 'h3' | 'blockquote'
  text: string
}

export interface PatchResult {
  revisionId: string
  warnings?: string[]
}

export interface SectionPatchPayload {
  ifRevisionID: string
  blocks: ContentBlock[]
}

export interface HeadlinePatchPayload {
  ifRevisionID: string
  headline: string
}

export interface ThemePatchPayload {
  ifRevisionID: string
  primaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  fontDisplay: string
  fontBody: string
  visualDirection?: string
}

export interface GamePatchPayload {
  ifRevisionID: string
  headline?: string
  description?: string
  embedCode: string
}

export interface KeyDataPoint {
  stat: string
  source: string
}

export interface PdfDataPointsPatchPayload {
  ifRevisionID: string
  problemStatement?: string
  /** Exactly 3 entries — Sanity schema `Rule.length(3)`, no add/remove in the editor. */
  keyDataPoints?: KeyDataPoint[]
  interventionMechanism?: string
}

export interface BonusPatchPayload {
  ifRevisionID: string
  // variant-shaped: specAd -> body (ContentBlock[]); bigBudget -> storyboards;
  // jingle -> lyrics + sunoPrompt. Left as a loose record because the shape
  // is discriminated by the run's bonusType (§31.7), not known statically here.
  [key: string]: unknown
}

export interface DeliberationTurn {
  speaker: string
  text: string
}

export interface DeliberationConversationPatchPayload {
  ifRevisionID: string
  turns: DeliberationTurn[]
}

export interface PodcastTranscriptPatchPayload {
  ifRevisionID: string
  transcript: string
}

export interface UploadAssetOptions {
  filename: string
  contentType: string
  ifRevisionID: string
}

export interface UploadAssetResult {
  assetUrl: string
  assetId: string
  revisionId: string
}

/** §31.7 draft-read GET response shape. */
export interface DraftSection {
  headline?: string
  blocks: ContentBlock[]
  lossy: boolean
}

export interface DraftResponse {
  revisionId: string
  sections: Record<string, DraftSection>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  game: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bonus: Record<string, any>
  bonusType: 'specAd' | 'bigBudget' | 'jingle'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  podcast: Record<string, any>
  /**
   * The deliberation turn list. NOTE: the live pipeline's `get_issue_draft()`
   * returns this top-level key as `conversation` (not nested under a
   * `deliberation` object) — matches the Plan 31-05 interface contract; kept
   * here (not `deliberation`) to stay byte-accurate with the actual response.
   */
  conversation: DeliberationTurn[]
}

// ── Internal fetch helper (JSON body) ───────────────────────────────────────

async function _contentFetch<T>(
  method: 'GET' | 'PATCH' | 'POST',
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
    let fields: string[] | undefined
    try {
      const detail = await res.json()
      if (detail?.reason) reason = detail.reason
      if (detail?.message) message = detail.message
      else if (typeof detail === 'string') message = detail
      if (Array.isArray(detail?.fields)) fields = detail.fields
    } catch {
      const text = await res.text().catch(() => '')
      if (text) message = text
    }
    throw new ContentPatchError(res.status, reason, message, fields)
  }

  return (await res.json()) as T
}

// ── patchSection (EDT-01) ────────────────────────────────────────────────────

/**
 * PATCH a section's prose body (originStory, problemStatement, founderBio,
 * caseStudy). `sectionName` must match §31.2's allowed set.
 */
export async function patchSection(
  runId: string,
  sectionName: string,
  payload: SectionPatchPayload,
  token: string | null,
): Promise<PatchResult> {
  return _contentFetch<PatchResult>(
    'PATCH',
    `/issues/${encodeURIComponent(runId)}/sections/${encodeURIComponent(sectionName)}`,
    token,
    payload as unknown as Record<string, unknown>,
  )
}

// ── patchHeadline (EDT-02) ───────────────────────────────────────────────────

export async function patchHeadline(
  runId: string,
  sectionName: string,
  payload: HeadlinePatchPayload,
  token: string | null,
): Promise<PatchResult> {
  return _contentFetch<PatchResult>(
    'PATCH',
    `/issues/${encodeURIComponent(runId)}/headlines/${encodeURIComponent(sectionName)}`,
    token,
    payload as unknown as Record<string, unknown>,
  )
}

// ── patchTheme (EDT-02) ──────────────────────────────────────────────────────

export async function patchTheme(
  runId: string,
  payload: ThemePatchPayload,
  token: string | null,
): Promise<PatchResult> {
  return _contentFetch<PatchResult>(
    'PATCH',
    `/issues/${encodeURIComponent(runId)}/theme`,
    token,
    payload as unknown as Record<string, unknown>,
  )
}

// ── patchGame (EDT-02) ───────────────────────────────────────────────────────

export async function patchGame(
  runId: string,
  payload: GamePatchPayload,
  token: string | null,
): Promise<PatchResult> {
  return _contentFetch<PatchResult>(
    'PATCH',
    `/issues/${encodeURIComponent(runId)}/game`,
    token,
    payload as unknown as Record<string, unknown>,
  )
}

// ── patchPdfDataPoints (EDT-02) ──────────────────────────────────────────────

export async function patchPdfDataPoints(
  runId: string,
  payload: PdfDataPointsPatchPayload,
  token: string | null,
): Promise<PatchResult> {
  return _contentFetch<PatchResult>(
    'PATCH',
    `/issues/${encodeURIComponent(runId)}/pdf-data-points`,
    token,
    payload as unknown as Record<string, unknown>,
  )
}

// ── patchBonus (EDT-01/EDT-02) ───────────────────────────────────────────────

export async function patchBonus(
  runId: string,
  payload: BonusPatchPayload,
  token: string | null,
): Promise<PatchResult> {
  return _contentFetch<PatchResult>(
    'PATCH',
    `/issues/${encodeURIComponent(runId)}/bonus`,
    token,
    payload,
  )
}

// ── patchDeliberationConversation (EDT-01) ───────────────────────────────────

export async function patchDeliberationConversation(
  runId: string,
  payload: DeliberationConversationPatchPayload,
  token: string | null,
): Promise<PatchResult> {
  return _contentFetch<PatchResult>(
    'PATCH',
    `/issues/${encodeURIComponent(runId)}/deliberation-conversation`,
    token,
    payload as unknown as Record<string, unknown>,
  )
}

// ── patchPodcastTranscript (EDT-01) ──────────────────────────────────────────

export async function patchPodcastTranscript(
  runId: string,
  payload: PodcastTranscriptPatchPayload,
  token: string | null,
): Promise<PatchResult> {
  return _contentFetch<PatchResult>(
    'PATCH',
    `/issues/${encodeURIComponent(runId)}/podcast-transcript`,
    token,
    payload as unknown as Record<string, unknown>,
  )
}

// ── getDraft ──────────────────────────────────────────────────────────────

/**
 * GET /issues/{run_id}/draft — the read path for the editor (§31.7).
 */
export async function getDraft(
  runId: string,
  token: string | null,
): Promise<DraftResponse> {
  return _contentFetch<DraftResponse>(
    'GET',
    `/issues/${encodeURIComponent(runId)}/draft`,
    token,
  )
}

// ── uploadAsset (EDT-03) ─────────────────────────────────────────────────────

/**
 * POST /issues/{run_id}/assets/{slot} — raw-binary upload (§31.6). NOT a
 * multipart form body — python-multipart is not an installed pipeline
 * dependency, so the body is the raw file bytes with metadata carried in
 * headers (X-Filename, Content-Type, X-If-Revision-Id).
 *
 * `slot` is one of: podcast-audio, suno-audio, storyboard-{i}.
 */
export async function uploadAsset(
  runId: string,
  slot: string,
  file: Blob,
  options: UploadAssetOptions,
  token: string | null,
): Promise<UploadAssetResult> {
  const res = await fetch(
    `${pipelineBaseUrl()}/issues/${encodeURIComponent(runId)}/assets/${encodeURIComponent(slot)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': options.contentType,
        'X-Filename': options.filename,
        'X-If-Revision-Id': options.ifRevisionID,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    },
  )

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
    throw new ContentPatchError(res.status, reason, message)
  }

  return (await res.json()) as UploadAssetResult
}
