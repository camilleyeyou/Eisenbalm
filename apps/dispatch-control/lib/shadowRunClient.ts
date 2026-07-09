/**
 * Phase 38 (EVL-05) — client for the read-only shadow-discovery endpoint.
 *
 * POSTs to the pipeline's `POST /eval/shadow-run` (docs/API_CONTRACTS §38.4)
 * with a Clerk bearer token, mirroring testRunClient.ts's base-URL + bearer +
 * error-handling shape.
 *
 * This is a PREVIEW-ONLY call (D-11): it runs Scout's `discover_candidates()`
 * against LIVE search, previewing what a paid discovery run would surface,
 * but writes NOTHING to run state (no pipelineRuns/pitchLog/charities row, no
 * Sanity write_charity). Isolation is proven server-side
 * (packages/pipeline/tests/api/test_shadow_run.py, D-12) — this client is a
 * thin, side-effect-free wrapper over that endpoint.
 */
import { pipelineBaseUrl } from '@/lib/testRunClient'

/** Mirrors scout.py's CharityCandidate shape (§38.4 response). */
export interface ShadowCandidate {
  name: string
  location: string
  website: string
  focusArea: string
  missionStatement: string
  scoutSummary: string
  whyOverlooked: string
  assetRange: string
}

export interface ShadowRunResult {
  candidates: ShadowCandidate[]
  featuredKeysCount: number
}

/**
 * Trigger a read-only shadow discovery run against LIVE real-world news.
 *
 * @param token  a Clerk session JWT (from useAuth().getToken())
 */
export async function runShadow(token: string | null): Promise<ShadowRunResult> {
  const res = await fetch(`${pipelineBaseUrl()}/eval/shadow-run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ workspace_id: 'eisenbalm' }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `shadow-run failed (${res.status})${detail ? `: ${detail}` : ''}`,
    )
  }

  return (await res.json()) as ShadowRunResult
}
