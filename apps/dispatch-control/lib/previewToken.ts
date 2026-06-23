/**
 * Preview-token generator — SERVER ONLY.
 *
 * HMAC formula (must match apps/web lib/preview-token.ts verifyPreviewToken):
 *   token = HMAC_SHA256(PREVIEW_SECRET, `${runId}:${slug}:${floor(Date.now()/300_000)}`).hex
 *
 * 5-minute sliding window: apps/web verifyPreviewToken accepts tokens from the
 * current window AND the previous window to tolerate clock skew across services.
 *
 * IMPORTANT: This module must only be imported in Server Components / Route
 * Handlers. PREVIEW_SECRET must never reach the browser.
 */
import { createHmac } from 'node:crypto'

/**
 * Build a signed preview URL for a given runId + issue slug.
 *
 * The returned URL points to the apps/web draft preview route:
 *   `${NEXT_PUBLIC_WEB_PREVIEW_BASE}/issue/${slug}/preview?token=<hmac>&runId=${runId}`
 *
 * Throws if either env var is missing (PREVIEW_SECRET, NEXT_PUBLIC_WEB_PREVIEW_BASE).
 *
 * @param runId  The pipeline run UUID
 * @param slug   The Sanity weeklyIssue slug (e.g. "issue-47-pupils-behind-bars")
 */
export function buildPreviewUrl(runId: string, slug: string): string {
  const secret = process.env.PREVIEW_SECRET
  if (!secret) {
    throw new Error(
      'PREVIEW_SECRET is not set — cannot generate a signed preview URL.',
    )
  }

  const base = process.env.NEXT_PUBLIC_WEB_PREVIEW_BASE
  if (!base) {
    throw new Error(
      'NEXT_PUBLIC_WEB_PREVIEW_BASE is not set — cannot build preview URL.',
    )
  }

  const win = Math.floor(Date.now() / 300_000)
  const hmac = createHmac('sha256', secret)
    .update(`${runId}:${slug}:${win}`)
    .digest('hex')

  const origin = base.replace(/\/$/, '')
  return `${origin}/issue/${encodeURIComponent(slug)}/preview?token=${hmac}&runId=${encodeURIComponent(runId)}`
}
