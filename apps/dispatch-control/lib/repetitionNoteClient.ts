/**
 * Phase 40 Plan 40-04 (§40.5, ISS-03, D-10) — client for the pipeline's
 * repetition-note read endpoint (docs/API_CONTRACTS.md §40.4).
 *
 * Mirrors coverageStripClient.ts line-for-line:
 *   - pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL (throws if unset,
 *     strips trailing slash)
 *   - Bearer token from useAuth().getToken() passed as Authorization header
 *   - Non-2xx responses surface a typed error the caller can render
 *
 * This module (and this app) NEVER imports the Sanity client SDK — the
 * repetition-note endpoint performs the Convex charities -> Sanity
 * cause/geo join server-side; the dashboard only ever GETs this one
 * pipeline route. See __tests__/dispatch-control-no-sanity-write.test.ts
 * (EDT-05 tripwire).
 */

/**
 * Reads NEXT_PUBLIC_PIPELINE_URL (throws if unset, strips trailing slash).
 * Duplicates the private helper in coverageStripClient.ts / findingsClient.ts
 * / contentPatchClient.ts / reviewClient.ts by design — each client module
 * keeps its own private copy rather than a shared cross-import (matches the
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

/** Structured error for a non-2xx response from GET /registry/repetition-note. */
export class RepetitionNoteError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'RepetitionNoteError'
  }
}

// ── Result shape (§40.5) ─────────────────────────────────────────────────────

export interface RepetitionAvoidItem {
  dimension: 'geo' | 'cause'
  value: string
  count: number
}

export interface RepetitionNote {
  note: string | null
  avoid: RepetitionAvoidItem[]
  sampleSize: number
}

// ── fetchRepetitionNote ──────────────────────────────────────────────────────

/**
 * GET /registry/repetition-note — a deterministic (no LLM call, no run
 * required) readout of over-represented cause/geo dimensions over the last
 * <=8 featured charities, formatted as "avoid X · avoid Y". Read-only.
 */
export async function fetchRepetitionNote(token: string | null): Promise<RepetitionNote> {
  const res = await fetch(`${pipelineBaseUrl()}/registry/repetition-note`, {
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
    throw new RepetitionNoteError(res.status, message)
  }

  return (await res.json()) as RepetitionNote
}
