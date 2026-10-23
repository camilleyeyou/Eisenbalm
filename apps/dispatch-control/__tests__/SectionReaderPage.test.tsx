/**
 * Phase 56-06 -- the rebuilt Section page: slab, breadcrumb, paragraph editing,
 * Rewrite, read-only published state, exempt parts, prev/next, error and 404.
 * Runs in jsdom (environmentMatchGlobs *.test.tsx).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import type { DraftResponse } from '@/lib/contentPatchClient'
import { EDITOR_BANNED_PATTERN, RUN_ID_PATTERN } from '@/lib/editorState'

const h = vi.hoisted(() => ({
  getDraft: vi.fn(),
  patchSection: vi.fn(),
  patchBonus: vi.fn(),
  notFound: vi.fn(),
  currentRunOpts: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: vi.fn(async () => 'tok') }) }))
vi.mock('@/components/ui/ConfirmDialog', () => ({ useConfirm: () => vi.fn(async () => true) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  notFound: h.notFound,
}))
vi.mock('@/lib/contentPatchClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/contentPatchClient')>('@/lib/contentPatchClient')
  return { ...actual, getDraft: h.getDraft, patchSection: h.patchSection, patchBonus: h.patchBonus }
})
vi.mock('@/components/galley/Galley', () => ({
  default: ({ sections }: { sections: string[] }) => <div data-testid="galley">galley {sections.join(',')}</div>,
}))

function runWith(over: { runStatus?: string; issuePublished?: boolean } = {}) {
  const runStatus = over.runStatus ?? 'awaiting-review'
  return {
    state: { kind: 'run' as const },
    runId: 'run-1',
    issueNumber: 48,
    title: 'Kumasi Roofless Schools Trust',
    qaFindings: [],
    claimRows: [],
    derivationInputs: {
      issueNumber: 48,
      runId: 'run-1',
      issue: { held: false, published: over.issuePublished ?? false },
      signOffs: {},
      claimRows: [],
      qaFindings: [],
      pitchRows: [],
      runStatus,
      runStartedAt: 1,
      runCompletedAt: 2,
    },
  }
}

// eslint-disable-next-line prefer-const
let mockRun: Record<string, unknown> = runWith()
vi.mock('@/lib/useCurrentRun', () => ({
  useCurrentRun: (opts?: unknown) => {
    h.currentRunOpts(opts)
    return mockRun
  },
}))

const para = (text: string) => ({ type: 'paragraph' as const, text })
const draft: DraftResponse = {
  revisionId: 'rev_1',
  sections: {
    originStory: { headline: 'A Quiet Beginning', blocks: [para('One.'), para('Two.')], lossy: false },
    problemStatement: { headline: 'The Problem', blocks: [para('Prob.')], lossy: false },
    founderBio: {
      headline: 'The Founder',
      blocks: [para('Alpha words.'), para('Beta words.'), para('Gamma words.')],
      lossy: false,
    },
    caseStudy: { headline: 'The Case', blocks: [para('Case.')], lossy: false },
  },
  theme: { fontDisplay: 'Newsreader', fontBody: 'Lora' },
  game: { headline: 'Play', description: 'd', embedCode: '<canvas></canvas>' },
  bonus: { headline: 'Spec Ad', body: [para('Imagine lip balm.')] },
  bonusType: 'specAd',
  podcast: { transcript: 'Host: hello.' },
  conversation: [{ speaker: 'Scout', text: 'Found one.' }],
}

async function renderSection(section: string, searchParams?: { run?: string }) {
  const { default: Page } = await import('../app/(editorial)/s/[section]/page')
  return render(<Page params={{ section }} searchParams={searchParams} />)
}

beforeEach(() => {
  mockRun = runWith()
  h.getDraft.mockReset().mockResolvedValue(draft)
  h.patchSection.mockReset().mockResolvedValue({ revisionId: 'rev_2' })
  h.patchBonus.mockReset().mockResolvedValue({ revisionId: 'rev_2' })
  h.notFound.mockReset()
  h.currentRunOpts.mockReset()
})
afterEach(cleanup)

describe('Section page', () => {
  it('shows the slab, breadcrumb, part label and toolbar helper with no primary button', async () => {
    const { container } = await renderSection('founderBio')
    await screen.findByText('Alpha words.')
    expect(screen.getByText('Read this part and change any words you like. Then go back to the issue to publish it.')).toBeTruthy()
    const back = screen.getAllByText('Back to the issue')[0]!.closest('a')
    expect(back?.getAttribute('href')).toBe('/')
    expect(container.querySelectorAll('[data-primary]').length).toBe(0)
    expect(screen.getByText('Issue 48 · Kumasi Roofless Schools Trust')).toBeTruthy()
    expect(screen.getByText('Part 3 of 9 · Founder')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('The Founder')
    expect(
      screen.getByText('Click any paragraph to change the words. Changes save to this issue straight away.'),
    ).toBeTruthy()
    expect(screen.getByText('Rewrite this part')).toBeTruthy()
  })

  it('keeps ?run= on the back link when pinned', async () => {
    await renderSection('founderBio', { run: 'run-1' })
    await screen.findByText('Alpha words.')
    expect(h.currentRunOpts).toHaveBeenCalledWith({ runId: 'run-1' })
    const back = screen.getAllByText('Back to the issue')[0]!.closest('a')
    expect(back?.getAttribute('href')).toBe('/?run=run-1')
  })

  it('saves an edited paragraph through patchSection with the draft revision', async () => {
    await renderSection('founderBio')
    fireEvent.click(await screen.findByText('Beta words.'))
    fireEvent.change(screen.getByLabelText('Editing paragraph 2'), { target: { value: 'Changed.' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(h.patchSection).toHaveBeenCalled())
    expect(h.patchSection).toHaveBeenCalledWith(
      'run-1',
      'founderBio',
      {
        ifRevisionID: 'rev_1',
        blocks: [para('Alpha words.'), para('Changed.'), para('Gamma words.')],
      },
      'tok',
    )
  })

  it('saves the specAd bonus through patchBonus, never patchSection', async () => {
    await renderSection('bonus')
    fireEvent.click(await screen.findByText('Imagine lip balm.'))
    fireEvent.change(screen.getByLabelText('Editing paragraph 1'), { target: { value: 'New ad.' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(h.patchBonus).toHaveBeenCalled())
    expect(h.patchBonus.mock.calls[0]![1]).toEqual({ ifRevisionID: 'rev_1', body: [para('New ad.')] })
    expect(h.patchSection).not.toHaveBeenCalled()
  })

  it.each([
    ['game', 'This part is a small game readers play on the website.'],
    ['podcast', "This part is the week's audio."],
  ])('%s has no Rewrite and no pencil, and shows its note', async (id, note) => {
    await renderSection(id)
    await screen.findByTestId('galley')
    expect(screen.queryByText('Rewrite this part')).toBeNull()
    expect(screen.queryByLabelText('Edit this paragraph')).toBeNull()
    expect(screen.getByText(new RegExp(note))).toBeTruthy()
  })

  it('a published issue is read-only with the published helper', async () => {
    mockRun = runWith({ runStatus: 'complete', issuePublished: true })
    await renderSection('founderBio')
    await screen.findByText('Alpha words.')
    expect(screen.queryByLabelText('Edit this paragraph')).toBeNull()
    expect(screen.queryByText('Rewrite this part')).toBeNull()
    expect(screen.getByText('This issue is published. Changes after publishing need a new issue.')).toBeTruthy()
  })

  it('links to the neighbouring parts', async () => {
    await renderSection('founderBio')
    await screen.findByText('Alpha words.')
    expect(screen.getByText('Previous · Part 2')).toBeTruthy()
    expect(screen.getByText('Next · Part 4')).toBeTruthy()
    expect(screen.getByText('All nine parts')).toBeTruthy()
    cleanup()
    await renderSection('originStory')
    await screen.findByText('One.')
    expect(screen.queryByText(/^Previous/)).toBeNull()
  })

  it('shows the plain load error with a reload button', async () => {
    h.getDraft.mockRejectedValue(new Error('boom'))
    await renderSection('founderBio')
    expect(await screen.findByText("This page didn't load. Check your connection, then press Reload this page.")).toBeTruthy()
    expect(screen.getByText('Reload this page')).toBeTruthy()
  })

  it('404s on an unknown part', async () => {
    await renderSection('nonsense')
    expect(h.notFound).toHaveBeenCalled()
  })

  it('has no jargon, run ids or inspector entry point', async () => {
    const { container } = await renderSection('founderBio')
    await screen.findByText('Alpha words.')
    const text = container.textContent ?? ''
    expect(text).not.toMatch(EDITOR_BANNED_PATTERN)
    expect(text).not.toMatch(RUN_ID_PATTERN)
    expect(text).not.toContain('Inspect how this was made')
  })
})
