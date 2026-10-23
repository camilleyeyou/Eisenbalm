/**
 * Phase 56 Plan 05 — IssueHome data wrapper tests (mocked Convex/Clerk/clients).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { useQuery } from 'convex/react'
import type { DraftResponse } from '@/lib/contentPatchClient'
import type { DerivationInputs } from '@/lib/derivedState'

const hoisted = vi.hoisted(() => ({
  getDraft: vi.fn(),
  publishChain: vi.fn(),
  triggerRun: vi.fn(),
  cancelRun: vi.fn(),
  confirm: vi.fn(),
  replace: vi.fn(),
  hold: vi.fn(),
  reopen: vi.fn(),
  role: { current: 'Editor-in-chief' as string | undefined },
  latest: { current: undefined as unknown },
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn((fn: string) => (fn === 'issues:hold' ? hoisted.hold : hoisted.reopen)),
}))
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok') }),
  useUser: () => ({ isLoaded: true, user: { publicMetadata: { role: hoisted.role.current } } }),
}))
vi.mock('@convex/_generated/api', () => ({
  api: {
    runs: { latest: 'runs:latest' },
    pitchLog: { selectedByRunId: 'pitchLog:selectedByRunId' },
    issues: { byIssueNumber: 'issues:byIssueNumber', hold: 'issues:hold', reopen: 'issues:reopen' },
  },
}))
vi.mock('@/lib/useCurrentRun', () => ({ useCurrentRun: () => mockCurrentRun }))
vi.mock('@/lib/contentPatchClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/contentPatchClient')>('@/lib/contentPatchClient')
  return { ...actual, getDraft: hoisted.getDraft }
})
vi.mock('@/lib/publishChain', async () => {
  const actual = await vi.importActual<typeof import('@/lib/publishChain')>('@/lib/publishChain')
  return { ...actual, publishChain: hoisted.publishChain }
})
vi.mock('@/lib/pipelineControlClient', () => ({
  triggerRun: hoisted.triggerRun,
  cancelRun: hoisted.cancelRun,
}))
vi.mock('@/components/ui/ConfirmDialog', () => ({ useConfirm: () => hoisted.confirm }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: hoisted.replace }) }))

import IssueHome from '../app/(editorial)/_components/IssueHome'

function readyInputs(over: Partial<DerivationInputs> = {}): DerivationInputs {
  return {
    issueNumber: 7,
    runId: 'run_1',
    issue: { held: false, published: false },
    signOffs: {},
    claimRows: [],
    qaFindings: [],
    pitchRows: [],
    runStatus: 'awaiting-review',
    runStartedAt: 1,
    runCompletedAt: 2,
    ...over,
  }
}

function currentRun(over: Record<string, unknown> = {}, inputs: Partial<DerivationInputs> = {}) {
  const derivationInputs = readyInputs(inputs)
  return {
    state: { kind: 'run' as const },
    runId: 'run_1',
    issueNumber: 7,
    title: 'The Quiet Ledger' as string | null | undefined,
    derivationInputs,
    claimSummary: { total: 0, signedOff: 0, blocking: 0, flagged: 0, allSignedOff: true } as unknown,
    signOffs: {} as unknown,
    qaFindings: derivationInputs.qaFindings as unknown,
    claimRows: derivationInputs.claimRows as unknown,
    runRow: { startedAt: 1, completedAt: 1_700_000_000_000 },
    ...over,
  }
}

// eslint-disable-next-line prefer-const -- tests reassign
let mockCurrentRun: Record<string, unknown> = currentRun()

function cleanDraft(): DraftResponse {
  const long = { headline: 'h', blocks: [{ type: 'paragraph', text: 't' }], lossy: false }
  return {
    revisionId: 'rev_1',
    sections: { originStory: long, problemStatement: long, founderBio: long, caseStudy: long },
    theme: { fontDisplay: 'Newsreader', fontBody: 'Lora', accentColor: '#9A3324' },
    game: { headline: 'g', description: 'd', embedCode: '<canvas></canvas>' },
    bonus: { headline: 'b', body: [{ type: 'paragraph', text: 't' }] },
    bonusType: 'specAd',
    podcast: { transcript: 'x' },
    conversation: [{ speaker: 'Scout', text: 'x' }],
  } as unknown as DraftResponse
}


beforeEach(() => {
  vi.clearAllMocks()
  hoisted.role.current = 'Editor-in-chief'
  hoisted.latest.current = { runId: 'run_1' }
  mockCurrentRun = currentRun()
  hoisted.getDraft.mockResolvedValue(cleanDraft())
  hoisted.triggerRun.mockResolvedValue({ runId: 'run_2' })
  hoisted.cancelRun.mockResolvedValue({ stopped: true })
  hoisted.confirm.mockResolvedValue(true)
  hoisted.hold.mockResolvedValue(undefined)
  hoisted.reopen.mockResolvedValue(undefined)
  vi.mocked(useQuery).mockImplementation(((fn: string) => {
    if (fn === 'pitchLog:selectedByRunId')
      return { charityName: 'The Quiet Ledger', scoutSummary: 'A two-person water lab.' }
    if (fn === 'runs:latest') return hoisted.latest.current
    return undefined
  }) as never)
  global.fetch = vi.fn(async () => ({ json: async () => ({ previewUrl: null }) })) as never
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const PUBLISH = 'Publish Issue 7'

async function publishButton() {
  return (await screen.findByRole('button', { name: PUBLISH })) as HTMLButtonElement
}

describe('ready', () => {
  it('shows the charity, the slab and Publish for the Editor-in-chief', async () => {
    render(<IssueHome />)
    expect(await screen.findByRole('heading', { level: 1, name: 'The Quiet Ledger' })).toBeTruthy()
    expect(await publishButton()).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hold this issue' })).toBeTruthy()
  })

  it('double click calls publishChain once; failure shows the plain sentence', async () => {
    hoisted.publishChain.mockResolvedValue({ ok: false, step: 'publish', message: 'server says no' })
    render(<IssueHome />)
    const btn = await publishButton()
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(hoisted.publishChain).toHaveBeenCalledTimes(1)
    expect(hoisted.publishChain.mock.calls[0]![0].runId).toBe('run_1')
    expect(
      await screen.findByText(
        "Publishing didn't go through, and nothing has reached readers. Press Publish Issue 7 to try again. If it keeps happening, tell Andrew.",
      ),
    ).toBeTruthy()
  })

  it('shows the slow notice after 75 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    hoisted.publishChain.mockResolvedValue({ ok: true })
    render(<IssueHome />)
    const btn = await publishButton()
    fireEvent.click(btn)
    for (let i = 0; i < 20 && !screen.queryByRole('status'); i++) {
      await act(async () => {
        await Promise.resolve()
        vi.advanceTimersByTime(75_000)
      })
    }
    expect(screen.getByRole('status').textContent).toBe(
      'Publishing is taking longer than usual. Nothing is lost. This page will update when it is done.',
    )
  })

  it('Hold this issue calls the hold mutation with the fixed reason', async () => {
    render(<IssueHome />)
    fireEvent.click(await screen.findByRole('button', { name: 'Hold this issue' }))
    await waitFor(() => expect(hoisted.hold).toHaveBeenCalled())
    expect(hoisted.hold.mock.calls[0]![0]).toMatchObject({ issueNumber: 7, reason: 'Held by the editor' })
  })

  it('Collaborator sees the waiting sentence and no Publish button', async () => {
    hoisted.role.current = 'Collaborator'
    render(<IssueHome />)
    expect(await screen.findByText('Waiting for the editor-in-chief to publish.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: PUBLISH })).toBeNull()
  })

  it('role undefined: no collaborator sentence and no Publish button', async () => {
    hoisted.role.current = undefined
    render(<IssueHome />)
    await screen.findByRole('heading', { level: 1, name: 'The Quiet Ledger' })
    expect(screen.queryByText('Waiting for the editor-in-chief to publish.')).toBeNull()
    expect(screen.queryByRole('button', { name: PUBLISH })).toBeNull()
  })
})

describe('held', () => {
  it('Release this issue calls reopen', async () => {
    mockCurrentRun = currentRun({}, { issue: { held: true, published: false } })
    render(<IssueHome />)
    fireEvent.click(await screen.findByRole('button', { name: 'Release this issue' }))
    await waitFor(() => expect(hoisted.reopen).toHaveBeenCalled())
    expect(hoisted.reopen.mock.calls[0]![0]).toMatchObject({ issueNumber: 7 })
  })
})

describe('start and stop', () => {
  it("published: Start next week's issue triggers once; failure shows the plain sentence", async () => {
    mockCurrentRun = currentRun({}, { issue: { held: false, published: true } })
    hoisted.triggerRun.mockRejectedValueOnce(new Error('409'))
    render(<IssueHome />)
    const btn = await screen.findByRole('button', { name: "Start next week's issue" })
    fireEvent.click(btn)
    fireEvent.click(btn)
    await waitFor(() => expect(hoisted.triggerRun).toHaveBeenCalledTimes(1))
    expect(hoisted.triggerRun.mock.calls[0]![0]).toEqual({})
    expect(await screen.findByText(/We couldn't start a new issue just now/)).toBeTruthy()
  })

  it('failed run: Start a new issue', async () => {
    mockCurrentRun = currentRun({}, { runStatus: 'failed' })
    render(<IssueHome />)
    fireEvent.click(await screen.findByRole('button', { name: 'Start a new issue' }))
    await waitFor(() => expect(hoisted.triggerRun).toHaveBeenCalledTimes(1))
  })

  it('no run: Start the first issue', async () => {
    mockCurrentRun = currentRun({ state: { kind: 'none' }, runId: null, issueNumber: null })
    render(<IssueHome />)
    fireEvent.click(await screen.findByRole('button', { name: 'Start the first issue' }))
    await waitFor(() => expect(hoisted.triggerRun).toHaveBeenCalledTimes(1))
    expect(hoisted.getDraft).not.toHaveBeenCalled()
  })

  it('writing: Stop writing this issue confirms, then cancels', async () => {
    mockCurrentRun = currentRun({}, { runStatus: 'running' })
    hoisted.getDraft.mockRejectedValue(new Error('no draft'))
    render(<IssueHome />)
    fireEvent.click(await screen.findByRole('button', { name: 'Stop writing this issue' }))
    await waitFor(() => expect(hoisted.cancelRun).toHaveBeenCalledTimes(1))
    expect(hoisted.cancelRun.mock.calls[0]![0]).toBe('run_1')
    expect(hoisted.confirm).toHaveBeenCalled()
  })

  it('writing: a declined confirm does not cancel', async () => {
    hoisted.confirm.mockResolvedValue(false)
    mockCurrentRun = currentRun({}, { runStatus: 'running' })
    hoisted.getDraft.mockRejectedValue(new Error('no draft'))
    render(<IssueHome />)
    fireEvent.click(await screen.findByRole('button', { name: 'Stop writing this issue' }))
    await waitFor(() => expect(hoisted.confirm).toHaveBeenCalled())
    expect(hoisted.cancelRun).not.toHaveBeenCalled()
  })

  it('stuck: Stop this issue confirms, then cancels', async () => {
    mockCurrentRun = currentRun({}, { runStatus: 'awaiting-review', runCompletedAt: undefined })
    hoisted.getDraft.mockRejectedValue(new Error('no draft'))
    render(<IssueHome />)
    fireEvent.click(await screen.findByRole('button', { name: 'Stop this issue' }))
    await waitFor(() => expect(hoisted.cancelRun).toHaveBeenCalledTimes(1))
  })
})

describe('pinned past issues', () => {
  it('a failed pinned run redirects to its Behind-the-scenes page', async () => {
    mockCurrentRun = currentRun({}, { runStatus: 'failed' })
    render(<IssueHome runId="run_1" />)
    await waitFor(() => expect(hoisted.replace).toHaveBeenCalledWith('/admin/runs/run_1'))
  })

  it('an unpublished pinned run that is not the latest is read-only', async () => {
    hoisted.latest.current = { runId: 'run_9' }
    render(<IssueHome runId="run_1" />)
    expect(await screen.findByText('This older issue was never published.')).toBeTruthy()
    expect(document.querySelectorAll('[data-primary]').length).toBe(0)
  })

  it('part links keep ?run= for a past issue', async () => {
    hoisted.latest.current = { runId: 'run_9' }
    render(<IssueHome runId="run_1" />)
    await screen.findByText('The nine parts')
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '')
    expect(hrefs.some((h) => h.includes('?run=run_1'))).toBe(true)
  })
})
