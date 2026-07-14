/**
 * Phase 40 Plan 40-01 (§40-UI-SPEC Copywriting Contract, ISS-04) — RED
 * scaffold for HoldDialog: a PRESENTATIONAL inline panel (not shadcn
 * Dialog). Props per Plan 40-07:
 *
 *   { issueNumber: number; onHold: (args: { reason: string; stopRun: boolean }) => void;
 *     onCancel: () => void; busy?: boolean }
 *
 * RED until Plan 40-07 implements
 * apps/dispatch-control/app/(dashboard)/issues/_components/HoldDialog.tsx.
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import HoldDialog from '../app/(dashboard)/issues/_components/HoldDialog'

afterEach(() => {
  cleanup()
})

describe('HoldDialog (§40-UI-SPEC, ISS-04)', () => {
  it('renders a reason textarea with the exact placeholder for Issue 7', () => {
    render(<HoldDialog issueNumber={7} onHold={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByPlaceholderText('Why are you holding Issue 7?')).toBeDefined()
  })

  it('the "Also stop the run in progress" checkbox is CHECKED by default (D-14)', () => {
    render(<HoldDialog issueNumber={7} onHold={vi.fn()} onCancel={vi.fn()} />)
    const checkbox = screen.getByRole('checkbox', {
      name: /Also stop the run in progress/i,
    }) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('empty-reason submit renders the validation error and calls neither onHold nor onCancel', () => {
    const onHold = vi.fn()
    const onCancel = vi.fn()
    render(<HoldDialog issueNumber={7} onHold={onHold} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Hold issue'))

    expect(screen.getByText('A reason is required to hold this issue.')).toBeDefined()
    expect(onHold).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('submitting a real reason calls onHold once with { reason, stopRun: true }', () => {
    const onHold = vi.fn()
    render(<HoldDialog issueNumber={7} onHold={onHold} onCancel={vi.fn()} />)

    const textarea = screen.getByPlaceholderText('Why are you holding Issue 7?')
    fireEvent.change(textarea, {
      target: { value: 'Charity site is down — verifying before publishing.' },
    })
    fireEvent.click(screen.getByText('Hold issue'))

    expect(onHold).toHaveBeenCalledTimes(1)
    expect(onHold).toHaveBeenCalledWith({
      reason: 'Charity site is down — verifying before publishing.',
      stopRun: true,
    })
  })

  it('unchecking the stop-run checkbox then submitting calls onHold with stopRun: false', () => {
    const onHold = vi.fn()
    render(<HoldDialog issueNumber={7} onHold={onHold} onCancel={vi.fn()} />)

    const textarea = screen.getByPlaceholderText('Why are you holding Issue 7?')
    fireEvent.change(textarea, { target: { value: 'Pausing to double-check a claim.' } })

    const checkbox = screen.getByRole('checkbox', {
      name: /Also stop the run in progress/i,
    })
    fireEvent.click(checkbox)

    fireEvent.click(screen.getByText('Hold issue'))

    expect(onHold).toHaveBeenCalledWith({
      reason: 'Pausing to double-check a claim.',
      stopRun: false,
    })
  })

  it('the confirm button reads "Hold issue" and the cancel button reads "Cancel"', () => {
    render(<HoldDialog issueNumber={7} onHold={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Hold issue')).toBeDefined()
    expect(screen.getByText('Cancel')).toBeDefined()
  })
})
