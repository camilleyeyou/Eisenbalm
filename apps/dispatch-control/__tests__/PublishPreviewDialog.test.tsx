/**
 * Phase 41 Plan 41-09 (WSP-06, D-15) — PublishPreviewDialog tests.
 *
 * The exact-preview interstitial: destination / title / time / consequences,
 * one "Publish now" confirm + one Cancel, and NO typed-confirmation input
 * anywhere (41-RESEARCH Pitfall 1 — this is net-new UI, not a removal of an
 * existing typed-confirmation step).
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import PublishPreviewDialog from '../app/(dashboard)/review-desk/[runId]/_components/PublishPreviewDialog'

afterEach(() => {
  cleanup()
})

describe('PublishPreviewDialog (WSP-06)', () => {
  it('renders the four exact-preview fields: destination, title, time, consequences', () => {
    render(
      <PublishPreviewDialog
        issueNumber={12}
        charityName="The Quiet Foundation"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText(/the public dispatch site/i)).toBeDefined()
    expect(screen.getByText('Issue 12 — The Quiet Foundation')).toBeDefined()
    expect(screen.getByText(/now.*publishes immediately/i)).toBeDefined()
    expect(
      screen.getByText(/publishes issue 12 to the live site and locks further edits/i),
    ).toBeDefined()
  })

  it('falls back to an honest placeholder charity name when none is available yet', () => {
    render(<PublishPreviewDialog issueNumber={3} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Issue 3 — (charity)')).toBeDefined()
  })

  it('has exactly one confirm control ("Publish now") and one Cancel — no typed-confirmation input', () => {
    const { container } = render(
      <PublishPreviewDialog issueNumber={1} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /^publish now$/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDefined()
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('textarea')).toBeNull()
  })

  it('calls onConfirm exactly once when Publish now is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <PublishPreviewDialog
        issueNumber={1}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^publish now$/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    render(<PublishPreviewDialog issueNumber={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables both actions while busy', () => {
    render(
      <PublishPreviewDialog issueNumber={1} onConfirm={vi.fn()} onCancel={vi.fn()} busy={true} />,
    )
    expect(
      (screen.getByRole('button', { name: /^publish now$/i }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect((screen.getByRole('button', { name: /^cancel$/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('exposes an accessible dialog role labeled "Publish preview"', () => {
    render(<PublishPreviewDialog issueNumber={1} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: /publish preview/i })).toBeDefined()
  })
})
