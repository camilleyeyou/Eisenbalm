/**
 * Phase 39 (MEM-01) — client for the pipeline's coverage-strip read endpoint
 * (docs/API_CONTRACTS.md §39; server implementation landed in 39-02).
 *
 * Mirrors findingsClient.ts:
 *   - pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL (throws if unset,
 *     strips trailing slash)
 *   - Bearer token from useAuth().getToken() passed as Authorization header
 *   - Non-2xx responses surface a typed error the caller can render
 *
 * This module (and this app) NEVER imports the Sanity client SDK — the
 * coverage-strip endpoint performs the Convex charities -> Sanity
 * focusArea/location/scoutNotes join server-side (39-02); the dashboard only
 * ever GETs this one pipeline route. See
 * __tests__/dispatch-control-no-sanity-write.test.ts (EDT-05 tripwire).
 */

/**
 * Reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips trailing slash).
 * Duplicates the private helper in findingsClient.ts / contentPatchClient.ts
 * / reviewClient.ts by design — each client module keeps its own private
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

/** Structured error for a non-2xx response from GET /registry/coverage-strip. */
export class CoverageStripError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'CoverageStripError'
  }
}

// ── Result shape (§39, 39-02) ────────────────────────────────────────────────

/**
 * One column of the coverage-memory strip: a single featured charity's
 * cause/geo/signal chip data. `cause`/`geo`/`signal` may be `null` for a
 * legacy featured row with no `sanityCharityId` (39-02 Pitfall 6) — the
 * strip must render these gracefully, never crash.
 */
export interface CoverageColumn {
  name: string
  sanityCharityId?: string | null
  lastFeaturedAt?: number | null
  cause?: string | null
  geo?: string | null
  signal?: string | null
}

// ── fetchCoverageStrip ───────────────────────────────────────────────────────

/**
 * GET /registry/coverage-strip — the last <=8 featured charities
 * (lastFeaturedAt desc) joined to their Sanity cause/geo/signal chip data.
 * Read-only.
 */
export async function fetchCoverageStrip(token: string | null): Promise<CoverageColumn[]> {
  const res = await fetch(`${pipelineBaseUrl()}/registry/coverage-strip`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const text = await res.text()
      if (text) message = text
    } catch {
      // ignore — fall back to the HTTP-status message above
    }
    throw new CoverageStripError(res.status, message)
  }

  return (await res.json()) as CoverageColumn[]
}
