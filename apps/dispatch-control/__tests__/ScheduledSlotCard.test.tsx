/**
 * Phase 40 Plan 40-01 (§40-UI-SPEC, ISS-03) — RED scaffold for
 * ScheduledSlotCard: renders "Start #{n} early", renders the repetition
 * note verbatim (or nothing when null), and calls triggerRun with the
 * reserved issueNumber on click. Props per Plan 40-05:
 *
 *   { issueNumber: number; scheduledForLabel: string; note: string | null }
 *
 * RED until Plan 40-05 implements
 * apps/dispatch-control/app/(dashboard)/issues/_components/ScheduledSlotCard.tsx.
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
}))

vi.mock('@/lib/pipelineControlClient', () => ({
  triggerRun: vi.fn(async () => ({ runId: 'run-new' })),
}))

import { triggerRun } from '@/lib/pipelineControlClient'
import ScheduledSlotCard from '../app/(dashboard)/issues/_components/ScheduledSlotCard'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ScheduledSlotCard (§40-UI-SPEC, ISS-03)', () => {
  it('renders "Start #8 early" for issueNumber=8', () => {
    render(<ScheduledSlotCard issueNumber={8} scheduledForLabel="Monday 6:00" note={null} />)
    expect(screen.getByText(/Start #8 early/)).toBeDefined()
  })

  it('renders the repetition note verbatim when present', () => {
    render(
      <ScheduledSlotCard
        issueNumber={8}
        scheduledForLabel="Monday 6:00"
        note="avoid US-SE · avoid weather"
      />,
    )
    expect(screen.getByText('avoid US-SE · avoid weather')).toBeDefined()
  })

  it('renders no "avoid"-shaped text and no empty placeholder chip when note is null', () => {
    const { container } = render(
      <ScheduledSlotCard issueNumber={8} scheduledForLabel="Monday 6:00" note={null} />,
    )
    expect(screen.queryByText(/avoid/i)).toBeNull()
    expect(container.textContent).not.toMatch(/avoid/i)
  })

  it('ISS-03: clicking "Start #8 early" calls triggerRun once with the reserved issueNumber', async () => {
    render(<ScheduledSlotCard issueNumber={8} scheduledForLabel="Monday 6:00" note={null} />)

    fireEvent.click(screen.getByText(/Start #8 early/))

    await waitFor(() => {
      expect(triggerRun).toHaveBeenCalledTimes(1)
    })
    expect(triggerRun).toHaveBeenCalledWith(expect.objectContaining({ issueNumber: 8 }), 'tok')
  })
})
