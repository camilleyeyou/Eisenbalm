/**
 * Phase 52 Plan 04 — IssueHome data wrapper tests (mocked Convex/Clerk/clients).
 * Runs in jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { ContentPatchError, type DraftResponse } from '@/lib/contentPatchClient'
import type { DerivationInputs } from '@/lib/derivedState'
import { FAILED_SENTENCE, GATE1_SENTENCE } from '@/lib/homeSections'

const hoisted = vi.hoisted(() => ({
  getDraft: vi.fn(),
  publishChain: vi.fn(),
  role: { current: 'Editor-in-chief' as string | undefined },
}))

vi.mock('convex/react', () => ({ useQuery: vi.fn(), useMutation: vi.fn(() => vi.fn()) }))
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok') }),
  useUser: () => ({ isLoaded: true, user: { publicMetadata: { role: hoisted.role.current } } }),
}))
vi.mock('@convex/_generated/api', () => ({
  api: {
    pitchLog: { selectedByRunId: 'pitchLog:selectedByRunId' },
    issues: { byIssueNumber: 'issues:byIssueNumber' },
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
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

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

const CLEAN = /Reads clean|Ready to publish|Nothing left to fix/

beforeEach(() => {
  vi.clearAllMocks()
  hoisted.role.current = 'Editor-in-chief'
  mockCurrentRun = currentRun()
  hoisted.getDraft.mockResolvedValue(cleanDraft())
  vi.mocked(useQuery).mockImplementation(((fn: string) => {
    if (fn === 'pitchLog:selectedByRunId')
      return { charityName: 'The Quiet Ledger', scoutSummary: 'A two-person water lab.' }
    return undefined
  }) as never)
  global.fetch = vi.fn(async () => ({ json: async () => ({ previewUrl: null }) })) as never
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('title', () => {
  it('shows the charity title and subject', async () => {
    render(<IssueHome />)
    expect(await screen.findByRole('heading', { level: 1, name: 'The Quiet Ledger' })).toBeTruthy()
    expect(screen.getByText('A two-person water lab.')).toBeTruthy()
  })

  it('no current issue: honest sentence, no draft fetch', () => {
    mockCurrentRun = currentRun({ state: { kind: 'none' }, runId: null, issueNumber: null })
    render(<IssueHome />)
    expect(screen.getByText(/There is no current issue yet\./)).toBeTruthy()
    expect(hoisted.getDraft).not.toHaveBeenCalled()
  })
})

describe('loading', () => {
  const fields: Array<[string, () => void]> = [
    ['qaFindings', () => (mockCurrentRun = currentRun({ qaFindings: undefined }, { qaFindings: undefined }))],
    ['claimRows', () => (mockCurrentRun = currentRun({ claimRows: undefined }, { claimRows: undefined }))],
    ['claimSummary', () => (mockCurrentRun = currentRun({ claimSummary: undefined }))],
    ['signOffs', () => (mockCurrentRun = currentRun({ signOffs: undefined }, { signOffs: undefined }))],
    ['issue', () => (mockCurrentRun = currentRun({}, { issue: undefined }))],
    ['title', () => (mockCurrentRun = currentRun({ title: undefined }))],
  ]
  for (const [name, apply] of fields) {
    it(`${name} undefined shows a skeleton, never clean copy`, async () => {
      apply()
      const { container } = render(<IssueHome />)
      await act(async () => {})
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
      expect(screen.queryByText(CLEAN)).toBeNull()
    })
  }

  it('pending draft shows a skeleton, never clean copy', async () => {
    hoisted.getDraft.mockReturnValue(new Promise(() => {}))
    const { container } = render(<IssueHome />)
    await act(async () => {})
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText(CLEAN)).toBeNull()
  })

  it('a draft for the previous runId is ignored after the run switches', async () => {
    const { container, rerender } = render(<IssueHome />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy())
    hoisted.getDraft.mockReturnValue(new Promise(() => {}))
    mockCurrentRun = currentRun({ runId: 'run_2' }, { runId: 'run_2' })
    rerender(<IssueHome />)
    await act(async () => {})
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText(CLEAN)).toBeNull()
  })
})

describe('publish', () => {
  async function clickThrough() {
    render(<IssueHome />)
    const btn = await screen.findByRole('button', { name: 'Publish' })
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(btn)
    expect(screen.getByText('Publish Issue 7 now?')).toBeTruthy()
    const buttons = screen.getAllByRole('button', { name: 'Publish' })
    fireEvent.click(buttons[0])
  }

  it('failure shows the server sentence and re-enables Publish', async () => {
    const msg = 'Both sign-offs (Facts cleared + Sounds human) are required before publishing.'
    hoisted.publishChain.mockResolvedValue({ ok: false, step: 'publish', message: msg })
    await clickThrough()
    expect(hoisted.publishChain).toHaveBeenCalledTimes(1)
    const arg = hoisted.publishChain.mock.calls[0][0]
    expect(arg.runId).toBe('run_1')
    expect(arg.activeSignOffs).toEqual({})
    expect(typeof arg.getToken).toBe('function')
    expect((await screen.findByRole('alert')).textContent).toContain(msg)
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('success holds Publishing… until issue.published', async () => {
    hoisted.publishChain.mockResolvedValue({ ok: true })
    await clickThrough()
    const hold = await screen.findByRole('button', { name: 'Publishing…' })
    expect((hold as HTMLButtonElement).disabled).toBe(true)
    mockCurrentRun = currentRun({}, { issue: { held: false, published: true } })
    cleanup()
    render(<IssueHome />)
    expect(await screen.findByText(/Published/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull()
  })

  it('run status complete releases the hold even when issue.published stays false', async () => {
    hoisted.publishChain.mockResolvedValue({ ok: true })
    const { rerender } = render(<IssueHome />)
    const btn = await screen.findByRole('button', { name: 'Publish' })
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(btn)
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' })[0])
    await screen.findByRole('button', { name: 'Publishing…' })
    mockCurrentRun = currentRun({}, { runStatus: 'complete', issue: { held: false, published: false } })
    rerender(<IssueHome />)
    expect(await screen.findByText(/Published/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Publishing…' })).toBeNull()
  })

  it('shows the taking-longer notice after 75s, button still disabled', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    hoisted.publishChain.mockResolvedValue({ ok: true })
    render(<IssueHome />)
    const btn = await screen.findByRole('button', { name: 'Publish' })
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(btn)
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' })[0])
    await screen.findByRole('button', { name: 'Publishing…' })
    // The slow timer registers once publishChain resolves (publishOk), which
    // can trail the 'Publishing…' label under load — keep advancing until seen.
    for (let i = 0; i < 20 && !screen.queryByRole('status'); i++) {
      await act(async () => {
        await Promise.resolve()
        vi.advanceTimersByTime(75_000)
      })
    }
    expect(screen.getByRole('status').textContent).toContain(
      'Publishing is taking longer than usual — check Admin → Run Details.',
    )
    expect((screen.getByRole('button', { name: 'Publishing…' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('states', () => {
  it('failed run: its own sentence, no Publish, no chain call', async () => {
    mockCurrentRun = currentRun({}, { runStatus: 'failed' })
    render(<IssueHome />)
    expect(await screen.findByText(new RegExp(FAILED_SENTENCE))).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(hoisted.publishChain).not.toHaveBeenCalled()
  })

  it('failed run with a rejected draft fetch: no skeleton footer, no alert', async () => {
    hoisted.getDraft.mockRejectedValue(new ContentPatchError(409, 'no draft'))
    mockCurrentRun = currentRun({}, { runStatus: 'failed' })
    render(<IssueHome />)
    expect(await screen.findByText(new RegExp(FAILED_SENTENCE))).toBeTruthy()
    await act(async () => {})
    const footer = screen.getByRole('region', { name: 'Publish' })
    expect(footer.querySelector('[aria-busy="true"]')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
  })

  it('Gate 1 pause with a rejected draft fetch: gate sentence and link', async () => {
    hoisted.getDraft.mockRejectedValue(new ContentPatchError(409, 'no draft'))
    mockCurrentRun = currentRun({}, { runStatus: 'awaiting-review', runCompletedAt: undefined })
    render(<IssueHome />)
    expect(await screen.findByText(new RegExp(GATE1_SENTENCE))).toBeTruthy()
    expect(screen.getByText('Choose the charity →')).toBeTruthy()
    await act(async () => {})
    const footer = screen.getByRole('region', { name: 'Publish' })
    expect(footer.querySelector('[aria-busy="true"]')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
  })

  it('Collaborator: lock label and disabled Publish', async () => {
    hoisted.role.current = 'Collaborator'
    render(<IssueHome />)
    expect(await screen.findByText('Collaborators can review and comment, not publish.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('open voice error on game: Publish disabled and the story is named', async () => {
    const finding = {
      _id: 'q0',
      sectionName: 'game',
      severity: 'error',
      axis: 'voice',
      status: 'open',
      accepted: false,
    }
    mockCurrentRun = currentRun({ qaFindings: [finding] }, { qaFindings: [finding] as never })
    render(<IssueHome />)
    expect(await screen.findByText(/1 story has something to fix/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
