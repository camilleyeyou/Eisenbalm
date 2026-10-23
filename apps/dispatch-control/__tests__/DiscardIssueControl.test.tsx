import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const hoisted = vi.hoisted(() => ({ confirm: vi.fn() }))
vi.mock('@/components/ui/ConfirmDialog', () => ({ useConfirm: () => hoisted.confirm }))

import DiscardIssueControl from '@/app/(editorial)/_components/DiscardIssueControl'
import { COPY, EDITOR_BANNED_PATTERN } from '@/lib/editorState'

beforeEach(() => hoisted.confirm.mockReset())
afterEach(cleanup)

describe('DiscardIssueControl', () => {
  it('asks first, then discards when confirmed', async () => {
    hoisted.confirm.mockResolvedValueOnce(true)
    const onDiscard = vi.fn()
    render(<DiscardIssueControl onDiscard={onDiscard} issueLabel="Issue 48" busy={false} pending={false} />)
    const btn = screen.getByRole('button', { name: 'Discard this issue' })
    expect(btn.hasAttribute('data-primary')).toBe(false)
    fireEvent.click(btn)
    await waitFor(() => expect(onDiscard).toHaveBeenCalledTimes(1))
    const arg = hoisted.confirm.mock.calls[0]![0]
    expect(arg.title).toBe('Discard Issue 48?')
    expect(arg.body).toContain('deleted for good')
    expect(arg.body).toContain('will be Issue 48 again')
    expect(arg.confirmLabel).toBe('Discard it')
    expect(arg.cancelLabel).toBe('Keep this issue')
  })

  it('does nothing when cancelled', async () => {
    hoisted.confirm.mockResolvedValueOnce(false)
    const onDiscard = vi.fn()
    render(<DiscardIssueControl onDiscard={onDiscard} issueLabel="Issue 48" busy={false} pending={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Discard this issue' }))
    await waitFor(() => expect(hoisted.confirm).toHaveBeenCalled())
    expect(onDiscard).not.toHaveBeenCalled()
  })

  it('shows pending and error and disables while pending', () => {
    render(<DiscardIssueControl onDiscard={vi.fn()} issueLabel="Issue 48" busy={false} pending error="Nope." />)
    expect(screen.getByRole('status').textContent).toContain('Discarding Issue 48')
    expect(screen.getByRole('alert').textContent).toBe('Nope.')
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('new copy avoids banned words', () => {
    for (const [k, v] of Object.entries(COPY)) {
      if (k.startsWith('discardIssue')) expect(EDITOR_BANNED_PATTERN.test(String(v)), k).toBe(false)
    }
  })
})
