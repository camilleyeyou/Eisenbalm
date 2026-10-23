/** Phase 56-04 -- SectionArticle / ParagraphRow in-place paragraph editing. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  patchSection: vi.fn(async () => ({})),
  patchBonus: vi.fn(async () => ({})),
  confirm: vi.fn(async () => true),
}))

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 't' }) }))
vi.mock('@/lib/contentPatchClient', async (orig) => ({
  ...(await orig<typeof import('@/lib/contentPatchClient')>()),
  patchSection: h.patchSection,
  patchBonus: h.patchBonus,
}))
vi.mock('@/components/ui/ConfirmDialog', () => ({ useConfirm: () => h.confirm }))

import SectionArticle from '../app/(editorial)/s/[section]/_components/SectionArticle'
import type { ContentBlock } from '@/lib/contentPatchClient'

const blocks: ContentBlock[] = [
  { type: 'h2', text: 'Heading' },
  { type: 'paragraph', text: 'First words.' },
  { type: 'paragraph', text: 'Second words.' },
  { type: 'blockquote', text: 'Quoted.' },
]
const FAIL = "We couldn't save that change. Your words are still in the box. Press Save to try again."

function setup(over: Partial<React.ComponentProps<typeof SectionArticle>> = {}) {
  const onSaved = vi.fn()
  render(
    <SectionArticle
      runId="r1"
      sectionId="originStory"
      blocks={blocks}
      getRevisionId={() => 'rev-fresh'}
      readOnly={false}
      onSaved={onSaved}
      {...over}
    />,
  )
  return { onSaved }
}

beforeEach(() => {
  h.patchSection.mockClear().mockResolvedValue({})
  h.patchBonus.mockClear().mockResolvedValue({})
  h.confirm.mockClear().mockResolvedValue(true)
})
afterEach(cleanup)

describe('SectionArticle', () => {
  it('renders focusable rows for paragraphs and blockquotes, headings plain', () => {
    setup()
    expect(screen.getAllByRole('group')).toHaveLength(3)
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeTruthy()
    for (const g of screen.getAllByRole('group')) expect(g.getAttribute('tabindex')).toBe('0')
  })

  it('opens from text click, pencil, and Enter', () => {
    setup()
    fireEvent.click(screen.getByText('First words.'))
    expect((screen.getByLabelText('Editing paragraph 1') as HTMLTextAreaElement).value).toBe('First words.')
    cleanup()
    setup()
    fireEvent.click(screen.getAllByLabelText('Edit this paragraph')[1])
    expect(screen.getByLabelText('Editing paragraph 2')).toBeTruthy()
    cleanup()
    setup()
    fireEvent.keyDown(screen.getByLabelText('Paragraph 3'), { key: 'Enter' })
    expect(screen.getByLabelText('Editing paragraph 3')).toBeTruthy()
  })

  it('saves only the edited index with the fresh revision id', async () => {
    const { onSaved } = setup()
    fireEvent.click(screen.getByText('Second words.'))
    fireEvent.change(screen.getByLabelText('Editing paragraph 2'), { target: { value: 'New.' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const expected = blocks.map((b, i) => (i === 2 ? { ...b, text: 'New.' } : b))
    expect(h.patchSection).toHaveBeenCalledWith('r1', 'originStory', { ifRevisionID: 'rev-fresh', blocks: expected }, 't')
    expect(h.patchBonus).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByLabelText('Editing paragraph 2')).toBeNull())
    expect(screen.getByText('Saved')).toBeTruthy()
  })

  it('uses patchBonus for the bonus part', async () => {
    const { onSaved } = setup({ sectionId: 'bonus' })
    fireEvent.click(screen.getByText('First words.'))
    fireEvent.change(screen.getByLabelText('Editing paragraph 1'), { target: { value: 'B.' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(h.patchBonus).toHaveBeenCalledTimes(1)
    expect(h.patchBonus.mock.calls[0][1]).toMatchObject({ ifRevisionID: 'rev-fresh' })
    expect(h.patchSection).not.toHaveBeenCalled()
  })

  it('keeps typed words and shows the error when save fails', async () => {
    h.patchSection.mockRejectedValueOnce(new Error('boom 500'))
    setup()
    fireEvent.click(screen.getByText('First words.'))
    fireEvent.change(screen.getByLabelText('Editing paragraph 1'), { target: { value: 'Typed' } })
    fireEvent.click(screen.getByText('Save'))
    expect((await screen.findByRole('alert')).textContent).toBe(FAIL)
    expect((screen.getByLabelText('Editing paragraph 1') as HTMLTextAreaElement).value).toBe('Typed')
  })

  it('Escape and Cancel close without patching and refocus the row', async () => {
    setup()
    fireEvent.click(screen.getByText('First words.'))
    fireEvent.keyDown(screen.getByLabelText('Editing paragraph 1'), { key: 'Escape' })
    expect(screen.queryByLabelText('Editing paragraph 1')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Paragraph 1')))
    fireEvent.click(screen.getByText('First words.'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByLabelText('Editing paragraph 1')).toBeNull()
    expect(h.patchSection).not.toHaveBeenCalled()
  })

  it('asks before leaving a dirty paragraph; declining keeps it open', async () => {
    setup()
    fireEvent.click(screen.getByText('First words.'))
    fireEvent.change(screen.getByLabelText('Editing paragraph 1'), { target: { value: 'dirty' } })
    h.confirm.mockResolvedValueOnce(false)
    fireEvent.click(screen.getByText('Second words.'))
    await waitFor(() => expect(h.confirm).toHaveBeenCalled())
    expect(h.confirm.mock.calls[0][0]).toMatchObject({ title: 'Leave without saving?' })
    expect(screen.getByLabelText('Editing paragraph 1')).toBeTruthy()
    expect(screen.queryByLabelText('Editing paragraph 2')).toBeNull()
  })

  it('read-only has no pencils and clicking does nothing', () => {
    setup({ readOnly: true })
    expect(screen.queryAllByLabelText('Edit this paragraph')).toHaveLength(0)
    fireEvent.click(screen.getByText('First words.'))
    expect(screen.queryByLabelText('Editing paragraph 1')).toBeNull()
  })
})
