/** Phase 56-04 -- RewriteThisPart client-side Keep / Go back. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  rerollAgent: vi.fn(async () => ({})),
  patchSection: vi.fn(async () => ({})),
  patchBonus: vi.fn(async () => ({})),
}))

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 't' }) }))
vi.mock('@/lib/pipelineControlClient', () => ({ rerollAgent: h.rerollAgent }))
vi.mock('@/lib/contentPatchClient', async (orig) => ({
  ...(await orig<typeof import('@/lib/contentPatchClient')>()),
  patchSection: h.patchSection,
  patchBonus: h.patchBonus,
}))

import RewriteThisPart from '../app/(editorial)/s/[section]/_components/RewriteThisPart'
import type { ContentBlock } from '@/lib/contentPatchClient'
import { ToastProvider } from '@/components/ui/Toast'

const old: ContentBlock[] = [{ type: 'paragraph', text: 'Old text.' }]

function setup(over: Partial<React.ComponentProps<typeof RewriteThisPart>> = {}) {
  const onRewritten = vi.fn()
  const utils = render(
    <RewriteThisPart
      runId="r1"
      sectionId="originStory"
      published={false}
      currentBlocks={old}
      getRevisionId={() => 'rev-2'}
      onRewritten={onRewritten}
      {...over}
    />,
  )
  return { onRewritten, ...utils }
}

beforeEach(() => {
  h.rerollAgent.mockClear().mockResolvedValue({})
  h.patchSection.mockClear().mockResolvedValue({})
  h.patchBonus.mockClear().mockResolvedValue({})
})
afterEach(cleanup)

describe('RewriteThisPart', () => {
  it('renders a non-primary ghost button', () => {
    setup()
    const b = screen.getByText('Rewrite this part')
    expect(b.hasAttribute('data-primary')).toBe(false)
  })

  it('rewrites, reloads, then offers Keep / Go back', async () => {
    let release!: () => void
    h.rerollAgent.mockImplementationOnce(() => new Promise((r) => { release = () => r({}) }))
    const { onRewritten } = setup()
    fireEvent.click(screen.getByText('Rewrite this part'))
    expect(screen.getByText('Rewriting this part…')).toBeTruthy()
    expect(screen.queryByText('Rewrite this part')).toBeNull()
    await waitFor(() => expect(h.rerollAgent).toHaveBeenCalledWith('r1', 'origin_story', 't'))
    release()
    await screen.findByText('Here is the new version. Keep it or go back to the old one.')
    expect(onRewritten).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Keep this version')).toBeTruthy()
  })

  it('Keep makes no patch call', async () => {
    setup()
    fireEvent.click(screen.getByText('Rewrite this part'))
    fireEvent.click(await screen.findByText('Keep this version'))
    expect(screen.queryByText('Keep this version')).toBeNull()
    expect(h.patchSection).not.toHaveBeenCalled()
  })

  it('Go back re-applies the pre-reroll snapshot', async () => {
    const { onRewritten } = setup()
    fireEvent.click(screen.getByText('Rewrite this part'))
    fireEvent.click(await screen.findByText('Go back to the old one'))
    await waitFor(() => expect(onRewritten).toHaveBeenCalledTimes(2))
    expect(h.patchSection).toHaveBeenCalledWith('r1', 'originStory', { ifRevisionID: 'rev-2', blocks: old }, 't')
  })

  it('Go back uses patchBonus for specAd bonus', async () => {
    setup({ sectionId: 'bonus', bonusType: 'specAd' })
    fireEvent.click(screen.getByText('Rewrite this part'))
    fireEvent.click(await screen.findByText('Go back to the old one'))
    await waitFor(() => expect(h.patchBonus).toHaveBeenCalledTimes(1))
    expect(h.patchBonus.mock.calls[0][1]).toMatchObject({ ifRevisionID: 'rev-2', body: old })
    expect(h.patchSection).not.toHaveBeenCalled()
  })

  it('reroll failure shows inline error and never patches', async () => {
    h.rerollAgent.mockRejectedValueOnce(new Error('409'))
    setup()
    fireEvent.click(screen.getByText('Rewrite this part'))
    expect((await screen.findByRole('alert')).textContent).toBe(
      "We couldn't rewrite this part just now. Wait a minute and press Rewrite this part again.",
    )
    expect(h.patchSection).not.toHaveBeenCalled()
  })

  it.each([
    ['game', {}],
    ['theme', {}],
    ['deliberation', {}],
    ['podcast', {}],
    ['bonus', { bonusType: 'jingle' }],
    ['originStory', { published: true }],
    ['originStory', { runStatus: 'running' }],
  ])('renders nothing for %s %j', (sectionId, extra) => {
    const { container } = setup({ sectionId, ...extra })
    expect(container.innerHTML).toBe('')
  })
})

describe('RewriteThisPart toasts (quick 261023-1i8)', () => {
  it('a successful rewrite shows the new-version toast', async () => {
    render(
      <ToastProvider>
        <RewriteThisPart
          runId="r1"
          sectionId="originStory"
          published={false}
          currentBlocks={old}
          getRevisionId={() => 'rev-2'}
          onRewritten={vi.fn()}
        />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('Rewrite this part'))
    expect(await screen.findByText('This part has a new version.')).toBeTruthy()
  })
})
