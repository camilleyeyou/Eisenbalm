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
import { ReviewApiError } from '@/lib/reviewClient'
import type { HomeFooter } from '@/lib/homeSections'

let getToken: ReturnType<typeof vi.fn>

beforeEach(() => {
  hoisted.recordSignOff.mockReset()
  hoisted.publishIssue.mockReset()
  hoisted.publishIssue.mockResolvedValue({ issueId: 'i', published: true })
  getToken = vi.fn(async () => 'tok')
})

const run = () => publishChain({ getToken, runId: 'run_1' })

describe('chain', () => {
  it('publishes only: no sign-off is ever recorded (quick 261021-7aw)', async () => {
    const res = await run()
    expect(res).toEqual({ ok: true })
    expect(hoisted.recordSignOff).not.toHaveBeenCalled()
    expect(hoisted.publishIssue).toHaveBeenCalledWith('tok', 'run_1')
    expect(getToken).toHaveBeenCalledTimes(1)
  })
})

describe('stop', () => {
  it('maps a network error to the plain message', async () => {
    hoisted.publishIssue.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await run()).toEqual({ ok: false, step: 'publish', message: NETWORK_FAILURE_MESSAGE })
  })
  it('surfaces the server message on a publish error', async () => {
    hoisted.publishIssue.mockRejectedValueOnce(new ReviewApiError(409, 'wrong_status', 'server says wrong_status'))
    expect(await run()).toEqual({ ok: false, step: 'publish', message: 'server says wrong_status' })
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
    ] as unknown as HomeFooter[]
    for (const footer of footers) {
      expect(derivePublishGate({ ...base, footer })).toEqual({ enabled: false, reason: 'not-ready' })
    }
  })
})

describe('slow', () => {
  it('exposes the slow threshold, notice and copy constants', () => {
    expect(PUBLISH_SLOW_MS).toBe(75_000)
    expect(PUBLISH_SLOW_NOTICE).toBe('Publishing is taking longer than usual. Nothing is lost. This page will update when it is done.')
    expect(COLLABORATOR_LOCK_LABEL).toBe('Waiting for the editor-in-chief to publish.')
    expect(HELD_REASON).toBe('This issue is on hold. Release it to publish.')
  })
})
