/**
 * Quick task 260717-35u — regression test for the FastAPI error-envelope
 * unwrapping bug.
 *
 * WHY THIS TEST EXISTS: the pre-existing `DecisionRail.test.tsx` constructs
 * `new ReviewApiError(409, 'open_error_findings', ...)` directly, which
 * mocks out the very parse block that was broken. A test that mocks the
 * error object can never catch a bug in how that error object gets built.
 * This file instead stubs `fetch` to return FastAPI's true wire shape
 * (`{detail: {reason, message}}`) and drives the REAL un-mocked
 * `_reviewFetch` / `_signOffFetch` / contentPatch helpers via their public
 * exports (`publishIssue`, `recordSignOff`, `patchSection`), so the parse
 * path itself is exercised end to end.
 *
 * Scope: only the 3 clients that were broken (reviewClient, signOffClient,
 * contentPatchClient's site-1 helper). The other 5 clients already unwrap
 * the envelope correctly and are covered by findingsClient.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { publishIssue, ReviewApiError } from '../lib/reviewClient'
import { recordSignOff, SignOffApiError } from '../lib/signOffClient'
import { patchSection, ContentPatchError } from '../lib/contentPatchClient'

const BASE = 'https://pipeline.test'

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

describe('reviewClient — envelope unwrapping (THE bug)', () => {
  it('surfaces a 409 {detail:{reason,message}} envelope as reason=missing_signoffs and the server message, not "unknown"/"HTTP 409"', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(409, {
        detail: {
          reason: 'missing_signoffs',
          message: 'Both sign-offs (Facts cleared + Sounds human) are required.',
        },
      }),
    )

    let caught: unknown
    try {
      await publishIssue('tok', 'run-1')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ReviewApiError)
    const err = caught as ReviewApiError
    expect(err.reason).toBe('missing_signoffs')
    expect(err.message).toBe(
      'Both sign-offs (Facts cleared + Sounds human) are required.',
    )
    expect(err.reason).not.toBe('unknown')
    expect(err.message).not.toBe('HTTP 409')
  })
})

describe('signOffClient — envelope unwrapping', () => {
  it('surfaces a 409 {detail:{reason:"open_error_findings",message}} envelope correctly', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(409, {
        detail: {
          reason: 'open_error_findings',
          message: '2 error finding(s) must be accepted or dismissed before clearing facts.',
        },
      }),
    )

    let caught: unknown
    try {
      await recordSignOff('tok', 'run-1', 'facts-cleared')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(SignOffApiError)
    const err = caught as SignOffApiError
    expect(err.reason).toBe('open_error_findings')
    expect(err.message).toBe(
      '2 error finding(s) must be accepted or dismissed before clearing facts.',
    )
  })
})

describe('contentPatchClient — envelope unwrapping + fields bonus bug', () => {
  it('unwraps reason/message AND surfaces the fields array from the unwrapped detail (currently undefined)', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(422, {
        detail: {
          reason: 'validation_failed',
          message: 'One or more fields are invalid.',
          fields: ['blocks[0].text'],
        },
      }),
    )

    let caught: unknown
    try {
      await patchSection('run-1', 'originStory', {
        ifRevisionID: 'rev-1',
        blocks: [{ type: 'paragraph', text: '' }],
      }, 'tok')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ContentPatchError)
    const err = caught as ContentPatchError
    expect(err.reason).toBe('validation_failed')
    expect(err.message).toBe('One or more fields are invalid.')
    expect(err.fields).toEqual(['blocks[0].text'])
  })
})

describe('preserved behaviors (must NOT regress)', () => {
  it('plain-string detail ({detail:"..."}) still surfaces that string as the message', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(409, { detail: 'Something went sideways.' }),
    )

    await expect(publishIssue('tok', 'run-1')).rejects.toMatchObject({
      message: 'Something went sideways.',
    })
  })

  it('a 422 validation array ({detail:[...]}) still falls back to "HTTP 422" / reason "unknown"', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(422, { detail: [{ loc: ['body'], msg: 'field required' }] }),
    )

    let caught: unknown
    try {
      await publishIssue('tok', 'run-1')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ReviewApiError)
    const err = caught as ReviewApiError
    expect(err.reason).toBe('unknown')
    expect(err.message).toBe('HTTP 422')
  })

  it('a non-JSON error body still falls back to res.text()', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token B')
      },
      text: async () => 'Bad Gateway',
    } as unknown as Response)

    await expect(publishIssue('tok', 'run-1')).rejects.toMatchObject({
      message: 'Bad Gateway',
    })
  })

  it('a flat non-enveloped {reason, message} body still works (fallback branch)', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(409, { reason: 'wrong_status', message: 'Cannot publish in this state.' }),
    )

    await expect(publishIssue('tok', 'run-1')).rejects.toMatchObject({
      reason: 'wrong_status',
      message: 'Cannot publish in this state.',
    })
  })
})
