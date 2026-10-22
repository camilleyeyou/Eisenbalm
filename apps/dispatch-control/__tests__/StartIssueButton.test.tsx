/**
 * Quick 261021-j83 (D-5) — Start issue on the front door.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const hoisted = vi.hoisted(() => ({ triggerRun: vi.fn() }))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: vi.fn(async () => 'tok') }) }))
vi.mock('@/lib/pipelineControlClient', () => ({ triggerRun: hoisted.triggerRun }))

import StartIssueButton, { START_BUSY_REASON, START_CONFLICT_MESSAGE } from '../app/(editorial)/_components/StartIssueButton'

beforeEach(() => hoisted.triggerRun.mockReset())
afterEach(cleanup)

describe('StartIssueButton', () => {
  it.each(['none', 'published', 'failed', 'stopped'] as const)('is enabled when footer is %s', kind => {
    render(<StartIssueButton footerKind={kind} held={false} />)
    expect((screen.getByRole('button', { name: 'Start issue' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it.each(['running', 'ready', 'gate1'] as const)('is disabled with a plain reason when footer is %s', kind => {
    render(<StartIssueButton footerKind={kind} held={false} />)
    expect((screen.getByRole('button', { name: 'Start issue' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(START_BUSY_REASON)).toBeTruthy()
  })

  it('is enabled when the current issue is held', () => {
    render(<StartIssueButton footerKind="ready" held={true} />)
    expect((screen.getByRole('button', { name: 'Start issue' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('confirms inline then triggers exactly one run', async () => {
    let resolve!: (v: { runId: string }) => void
    hoisted.triggerRun.mockReturnValue(new Promise(r => (resolve = r)))
    render(<StartIssueButton footerKind="none" held={undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start issue' }))
    expect(screen.getByText('Start a new issue now?')).toBeTruthy()
    expect(hoisted.triggerRun).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(hoisted.triggerRun).toHaveBeenCalledTimes(1))
    expect(hoisted.triggerRun).toHaveBeenCalledWith({}, 'tok')
    const busy = screen.getByRole('button', { name: 'Starting…' }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    fireEvent.click(busy)
    expect(hoisted.triggerRun).toHaveBeenCalledTimes(1)
    resolve({ runId: 'r' })
    await waitFor(() => expect(screen.queryByText('Start a new issue now?')).toBeNull())
  })

  it('cancel closes the confirm without calling the pipeline', () => {
    render(<StartIssueButton footerKind="none" held={undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start issue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(hoisted.triggerRun).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Start issue' })).toBeTruthy()
  })

  it('maps a 409 to the plain message plus the server detail', async () => {
    hoisted.triggerRun.mockRejectedValueOnce(new Error('trigger-run failed (409): run already in progress'))
    render(<StartIssueButton footerKind="published" held={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start issue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(START_CONFLICT_MESSAGE)
    expect(alert.textContent).toContain('run already in progress')
  })

  it('renders nothing while loading', () => {
    const { container } = render(<StartIssueButton footerKind="loading" held={undefined} />)
    expect(container.firstChild).toBeNull()
  })
})
