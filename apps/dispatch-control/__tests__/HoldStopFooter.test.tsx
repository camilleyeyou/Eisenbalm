import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const hoisted = vi.hoisted(() => ({ confirm: vi.fn() }))
vi.mock('@/components/ui/ConfirmDialog', () => ({ useConfirm: () => hoisted.confirm }))

import HoldStopFooter from '@/app/(editorial)/_components/HoldStopFooter'

beforeEach(() => hoisted.confirm.mockReset())
afterEach(cleanup)

describe('HoldStopFooter', () => {
  it('stop: asks first, then stops only when confirmed', async () => {
    hoisted.confirm.mockResolvedValueOnce(true)
    const onStop = vi.fn()
    render(<HoldStopFooter mode="stop" onStop={onStop} busy={false} issueLabel="Issue 48" />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop writing this issue' }))
    await waitFor(() => expect(onStop).toHaveBeenCalledTimes(1))
    expect(hoisted.confirm.mock.calls[0]![0].title).toBe('Stop writing this issue?')
    expect(hoisted.confirm.mock.calls[0]![0].body).toContain('Issue 48')
  })

  it('stop: cancelled confirm does nothing', async () => {
    hoisted.confirm.mockResolvedValueOnce(false)
    const onStop = vi.fn()
    render(<HoldStopFooter mode="stop" onStop={onStop} busy={false} issueLabel="Issue 48" />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop writing this issue' }))
    await waitFor(() => expect(hoisted.confirm).toHaveBeenCalled())
    expect(onStop).not.toHaveBeenCalled()
  })

  it('hold: calls onHold directly with no confirm', () => {
    const onHold = vi.fn()
    render(<HoldStopFooter mode="hold" onHold={onHold} busy={false} issueLabel="Issue 48" error="That didn't go through." />)
    fireEvent.click(screen.getByRole('button', { name: 'Hold this issue' }))
    expect(onHold).toHaveBeenCalledTimes(1)
    expect(hoisted.confirm).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain("didn't go through")
  })
})
