/**
 * Preview token helpers — SERVER ONLY.
 *
 * HMAC formula (must match dispatch-control Plan 26-05 generator):
 *   token = HMAC_SHA256(PREVIEW_SECRET, `${runId}:${slug}:${floor(Date.now()/300_000)}`).hex
 *
 * 5-minute sliding window: verifyPreviewToken accepts tokens from the current
 * window AND the previous window to tolerate clock skew across services.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Generate a preview token for the given runId + slug at the specified wall-clock
 * moment (defaults to Date.now()). Used in tests and by dispatch-control's
 * companion generator (Plan 26-05).
 */
export function previewToken(
  secret: string,
  runId: string,
  slug: string,
  windowMs: number = Date.now(),
): string {
  const window = Math.floor(windowMs / 300_000)
  return createHmac('sha256', secret)
    .update(`${runId}:${slug}:${window}`)
    .digest('hex')
}

/**
 * Verify a preview token from the request. Reads PREVIEW_SECRET from
 * process.env (never passed via the browser).
 *
 * Accepts the current 5-minute window AND the previous window to handle
 * reasonable clock skew between dispatch-control and apps/web.
 *
 * Returns false when:
 *   - PREVIEW_SECRET is not set
 *   - token is absent / empty
 *   - token does not match either window
 */
export function verifyPreviewToken(
  token: string | null | undefined,
  runId: string | null | undefined,
  slug: string | null | undefined,
): boolean {
  const secret = process.env.PREVIEW_SECRET
  if (!secret || !token || !runId || !slug) return false

  const now = Date.now()
  const candidates = [
    previewToken(secret, runId, slug, now),            // current window
    previewToken(secret, runId, slug, now - 300_000),  // previous window
  ]

  const tokenBuf = Buffer.from(token, 'hex')
  for (const candidate of candidates) {
    const candidateBuf = Buffer.from(candidate, 'hex')
    // timingSafeEqual requires equal-length buffers; mismatched length = false
    if (
      tokenBuf.length === candidateBuf.length &&
      timingSafeEqual(tokenBuf, candidateBuf)
    ) {
      return true
    }
  }
  return false
}
