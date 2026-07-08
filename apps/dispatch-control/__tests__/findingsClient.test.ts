/**
 * Phase 33 (EDT-04, Plan 33-04 Task 1) — findingsClient + isOpenFinding tests.
 *
 * The findings client mirrors contentPatchClient.ts (private pipelineBaseUrl,
 * typed FindingsError with {status, reason, message}) and POSTs to the §33.3
 * endpoints:
 *
 *   POST /issues/{runId}/findings/{findingId}/accept   body {ifRevisionID}
 *   POST /issues/{runId}/findings/{findingId}/dismiss  body {reason}
 *   POST /issues/{runId}/findings/{findingId}/reopen   no body
 *
 * The FastAPI 409s arrive wrapped in the HTTPException envelope
 * `{detail: {reason, message}}` — the client must unwrap `body.detail`
 * so the popover can branch on `.reason === 'revision_mismatch'` vs
 * `.reason === 'span_not_resolved'`.
 *
 * isOpenFinding is the ONE shared open-finding predicate (Pitfall 9): a
 * finding is open only when `accepted !== true` AND `resolution == null`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  acceptFinding,
  dismissFinding,
  reopenFinding,
  FindingsError,
} from '../lib/findingsClient'
import { isOpenFinding } from '../lib/galley/findingState'

const BASE = 'https://pipeline.test'

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response
}

function errorResponse(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_PIPELINE_URL', BASE)
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('acceptFinding', () => {
  it('POSTs {ifRevisionID} to /issues/{runId}/findings/{findingId}/accept with the Bearer token and returns {revisionId}', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({ revisionId: 'rev-2', findingId: 'f1', resolution: 'accepted' }),
    )

    const result = await acceptFinding('run-1', 'f1', { ifRevisionID: 'rev-1' }, 'tok-abc')

    expect(result.revisionId).toBe('rev-2')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${BASE}/issues/run-1/findings/f1/accept`)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok-abc')
    expect(JSON.parse(init.body)).toEqual({ ifRevisionID: 'rev-1' })
  })

  it('surfaces a 409 {detail:{reason:"revision_mismatch"}} as FindingsError with .reason === "revision_mismatch"', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(409, {
        detail: { reason: 'revision_mismatch', message: 'The draft changed underneath you.' },
      }),
    )

    let caught: unknown
    try {
      await acceptFinding('run-1', 'f1', { ifRevisionID: 'rev-stale' }, 'tok')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(FindingsError)
    const err = caught as FindingsError
    expect(err.status).toBe(409)
    expect(err.reason).toBe('revision_mismatch')
    expect(err.message).toBe('The draft changed underneath you.')
  })

  it('surfaces a 409 {detail:{reason:"span_not_resolved"}} as a DISTINCT .reason === "span_not_resolved" branch', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(409, {
        detail: {
          reason: 'span_not_resolved',
          message: "Couldn't locate this text in the current draft. Use Edit inline instead.",
        },
      }),
    )

    let caught: unknown
    try {
      await acceptFinding('run-1', 'f1', { ifRevisionID: 'rev-1' }, 'tok')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(FindingsError)
    const err = caught as FindingsError
    expect(err.reason).toBe('span_not_resolved')
    expect(err.reason).not.toBe('revision_mismatch')
  })

  it('also unwraps a flat {reason, message} error body (non-enveloped shape)', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(409, { reason: 'already_resolved', message: 'Already dismissed.' }),
    )

    await expect(
      acceptFinding('run-1', 'f1', { ifRevisionID: 'rev-1' }, 'tok'),
    ).rejects.toMatchObject({ reason: 'already_resolved', status: 409 })
  })
})

describe('dismissFinding', () => {
  it('POSTs {reason} to /dismiss and returns {findingId}', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ findingId: 'f1', resolution: 'dismissed' }))

    const result = await dismissFinding('run-1', 'f1', { reason: 'Stylistic; fine as-is.' }, 'tok')

    expect(result.findingId).toBe('f1')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${BASE}/issues/run-1/findings/f1/dismiss`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ reason: 'Stylistic; fine as-is.' })
  })

  it('surfaces a 422 empty-reason response as a FindingsError', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(422, {
        detail: { reason: 'empty_reason', message: 'A dismissal reason is required.' },
      }),
    )

    await expect(dismissFinding('run-1', 'f1', { reason: '' }, 'tok')).rejects.toMatchObject({
      status: 422,
      reason: 'empty_reason',
    })
  })
})

describe('reopenFinding', () => {
  it('POSTs to /reopen with no body and returns {findingId}', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ findingId: 'f1', resolution: null }))

    const result = await reopenFinding('run-1', 'f1', 'tok')

    expect(result.findingId).toBe('f1')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${BASE}/issues/run-1/findings/f1/reopen`)
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
  })
})

describe('isOpenFinding', () => {
  it('returns true for an open finding (accepted !== true, resolution absent)', () => {
    expect(isOpenFinding({})).toBe(true)
    expect(isOpenFinding({ accepted: false })).toBe(true)
    expect(isOpenFinding({ accepted: false, resolution: null })).toBe(true)
  })

  it('returns false for a legacy accepted finding (accepted === true)', () => {
    expect(isOpenFinding({ accepted: true })).toBe(false)
  })

  it('returns false for an accepted resolution', () => {
    expect(isOpenFinding({ accepted: false, resolution: 'accepted' })).toBe(false)
  })

  it('returns false for a dismissed resolution (Pitfall 9 — dismissed findings drop from every open surface)', () => {
    expect(isOpenFinding({ accepted: false, resolution: 'dismissed' })).toBe(false)
  })
})
