/**
 * Quick 261021-j83 (D-2) — Hold / Release on the front door, every role.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const hoisted = vi.hoisted(() => ({ hold: vi.fn(), reopen: vi.fn(), cancelRun: vi.fn() }))
vi.mock('convex/react', () => ({
  useMutation: (ref: string) => (ref === 'issues:hold' ? hoisted.hold : hoisted.reopen),
}))
vi.mock('@convex/_generated/api', () => ({
  api: { issues: { hold: 'issues:hold', reopen: 'issues:reopen' } },
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: vi.fn(async () => 'tok') }) }))
vi.mock('@/lib/pipelineControlClient', () => ({ cancelRun: hoisted.cancelRun }))

import HoldControl from '../app/(editorial)/_components/HoldControl'

const base = { footerKind: 'ready' as const, issueNumber: 7, runId: 'run_1', held: false }

beforeEach(() => {
  hoisted.hold.mockReset().mockResolvedValue(undefined)
  hoisted.reopen.mockReset().mockResolvedValue(undefined)
  hoisted.cancelRun.mockReset().mockResolvedValue({})
})
afterEach(cleanup)

describe('HoldControl', () => {
  it.each(['none', 'loading', 'published'] as const)('is hidden when footer is %s', kind => {
    const { container } = render(<HoldControl {...base} footerKind={kind} />)
    expect(container.firstChild).toBeNull()
  })

  it('holds with a reason and stops the run when asked', async () => {
    render(<HoldControl {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hold issue' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Founder asked us to wait' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hold issue' }))
    await waitFor(() => expect(hoisted.hold).toHaveBeenCalled())
    await waitFor(() => expect(hoisted.cancelRun).toHaveBeenCalledWith('run_1', 'tok'))
    expect(hoisted.hold.mock.calls[0][0]).toMatchObject({ issueNumber: 7, reason: 'Founder asked us to wait' })
  })

  it('still holds when the cancel call fails', async () => {
    hoisted.cancelRun.mockRejectedValue(new Error('nope'))
    render(<HoldControl {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hold issue' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'why' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hold issue' }))
    await waitFor(() => expect(hoisted.hold).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(hoisted.cancelRun).toHaveBeenCalledWith('run_1', 'tok'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the held row and releases with one click', async () => {
    render(<HoldControl {...base} held={true} heldReason="Waiting on founder" heldBy="Andrew" heldAt={Date.now()} />)
    expect(screen.getByText(/Held · Waiting on founder · Andrew · just now/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Release hold' }))
    await waitFor(() => expect(hoisted.reopen).toHaveBeenCalledWith({ workspace_id: expect.any(String), issueNumber: 7 }))
  })
})
