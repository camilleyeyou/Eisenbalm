// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  recordSignOff: vi.fn(),
  publishIssue: vi.fn(),
}))

vi.mock('@/lib/signOffClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/signOffClient')>('@/lib/signOffClient')
  return { ...actual, recordSignOff: hoisted.recordSignOff }
})
vi.mock('@/lib/reviewClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reviewClient')>('@/lib/reviewClient')
  return { ...actual, publishIssue: hoisted.publishIssue }
})

import {
  publishChain,
  derivePublishGate,
  NETWORK_FAILURE_MESSAGE,
  COLLABORATOR_LOCK_LABEL,
  HELD_REASON,
  PUBLISH_SLOW_MS,
  PUBLISH_SLOW_NOTICE,
} from '@/lib/publishChain'
import { SignOffApiError } from '@/lib/signOffClient'
import { ReviewApiError } from '@/lib/reviewClient'
import type { HomeFooter } from '@/lib/homeSections'

let log: string[]
let getToken: ReturnType<typeof vi.fn>

beforeEach(() => {
  log = []
  hoisted.recordSignOff.mockReset()
  hoisted.publishIssue.mockReset()
  hoisted.recordSignOff.mockImplementation(async (_t: unknown, _r: unknown, kind: string) => {
    log.push(kind)
    return { runId: 'run_1', kind, signedAt: 1 }
  })
  hoisted.publishIssue.mockImplementation(async () => {
    log.push('publish')
    return { issueId: 'i', published: true }
  })
  getToken = vi.fn(async () => 'tok')
})

const run = (activeSignOffs: Record<string, unknown> = {}) =>
  publishChain({ getToken, runId: 'run_1', activeSignOffs })

describe('chain', () => {
  it('records facts, then voice, then publishes, in order', async () => {
    const res = await run()
    expect(res).toEqual({ ok: true })
    expect(log).toEqual(['facts-cleared', 'sounds-human', 'publish'])
    expect(hoisted.recordSignOff).toHaveBeenNthCalledWith(1, 'tok', 'run_1', 'facts-cleared')
    expect(hoisted.recordSignOff).toHaveBeenNthCalledWith(2, 'tok', 'run_1', 'sounds-human')
    expect(hoisted.publishIssue).toHaveBeenCalledWith('tok', 'run_1')
    expect(getToken).toHaveBeenCalledTimes(3)
  })
})

describe('skip', () => {
  it('skips an already-active facts sign-off', async () => {
    await run({ 'facts-cleared': { signedAt: 1 } })
    expect(log).toEqual(['sounds-human', 'publish'])
  })
  it('skips both when both are active', async () => {
    await run({ 'facts-cleared': {}, 'sounds-human': {} })
    expect(hoisted.recordSignOff).not.toHaveBeenCalled()
    expect(hoisted.publishIssue).toHaveBeenCalledTimes(1)
  })
})

describe('stop', () => {
  it('stops at the first failure with the server message', async () => {
    const msg = '1 claim(s) contradicted by sources must be fixed or dismissed before clearing facts.'
    hoisted.recordSignOff.mockRejectedValueOnce(new SignOffApiError(409, 'claims_not_signed_off', msg))
    const res = await run()
    expect(res).toEqual({ ok: false, step: 'facts-cleared', message: msg })
    expect(hoisted.recordSignOff).toHaveBeenCalledTimes(1)
    expect(hoisted.publishIssue).not.toHaveBeenCalled()
  })
  it('maps a network error to the plain message at any step', async () => {
    hoisted.publishIssue.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const res = await run({ 'facts-cleared': {}, 'sounds-human': {} })
    expect(res).toEqual({ ok: false, step: 'publish', message: NETWORK_FAILURE_MESSAGE })
    hoisted.recordSignOff.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const res2 = await run()
    expect(res2).toEqual({ ok: false, step: 'facts-cleared', message: NETWORK_FAILURE_MESSAGE })
  })
})

describe('reasons', () => {
  const rows: Array<[string, number, 'facts-cleared' | 'sounds-human' | 'publish']> = [
    ['claims_not_signed_off', 409, 'facts-cleared'],
    ['open_error_findings', 409, 'facts-cleared'],
    ['open_voice_findings', 409, 'sounds-human'],
    ['run_not_reviewable', 409, 'sounds-human'],
    ['forbidden_role', 403, 'sounds-human'],
    ['missing_signoffs', 409, 'publish'],
    ['wrong_status', 409, 'publish'],
    ['no_sanity_issue', 409, 'publish'],
  ]
  it.each(rows)('%s (%i) surfaces at %s', async (reason, status, step) => {
    const message = `server says ${reason}`
    if (step === 'publish') {
      hoisted.publishIssue.mockRejectedValueOnce(new ReviewApiError(status, reason, message))
      const res = await run({ 'facts-cleared': {}, 'sounds-human': {} })
      expect(res).toEqual({ ok: false, step, message })
    } else {
      const err = new SignOffApiError(status, reason, message)
      if (step === 'facts-cleared') {
        hoisted.recordSignOff.mockRejectedValueOnce(err)
      } else {
        hoisted.recordSignOff.mockResolvedValueOnce({ runId: 'run_1', kind: 'facts-cleared', signedAt: 1 })
        hoisted.recordSignOff.mockRejectedValueOnce(err)
      }
      const res = await run()
      expect(res).toEqual({ ok: false, step, message })
      expect(hoisted.publishIssue).not.toHaveBeenCalled()
    }
  })
})

describe('gate', () => {
  const ready: HomeFooter = { kind: 'ready' }
  const base = { footer: ready, role: 'Editor-in-chief' as const, held: false, busy: false }
  it('enables for a ready footer, Editor-in-chief, not held, not busy', () => {
    expect(derivePublishGate(base)).toEqual({ enabled: true })
  })
  it('gives each disabled reason', () => {
    expect(derivePublishGate({ ...base, role: undefined })).toEqual({ enabled: false, reason: 'role-unknown' })
    expect(derivePublishGate({ ...base, role: 'Collaborator' })).toEqual({ enabled: false, reason: 'collaborator' })
    expect(derivePublishGate({ ...base, held: true })).toEqual({ enabled: false, reason: 'held' })
    expect(derivePublishGate({ ...base, held: undefined })).toEqual({ enabled: false, reason: 'loading' })
    expect(derivePublishGate({ ...base, busy: true })).toEqual({ enabled: false, reason: 'busy' })
  })
  it('disables every non-ready footer', () => {
    const footers = [
      { kind: 'loading' },
      { kind: 'none' },
      { kind: 'failed' },
      { kind: 'gate1' },
      { kind: 'running' },
      { kind: 'published' },
      { kind: 'fix' },
    ] as unknown as HomeFooter[]
    for (const footer of footers) {
      expect(derivePublishGate({ ...base, footer })).toEqual({ enabled: false, reason: 'not-ready' })
    }
  })
})

describe('slow', () => {
  it('exposes the slow threshold, notice and copy constants', () => {
    expect(PUBLISH_SLOW_MS).toBe(75_000)
    expect(PUBLISH_SLOW_NOTICE).toBe('Publishing is taking longer than usual — check Admin → Run Details.')
    expect(COLLABORATOR_LOCK_LABEL).toBe('Collaborators can review and comment, not publish.')
    expect(HELD_REASON).toBe('This issue is held — release the hold to publish.')
  })
})
