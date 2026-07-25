/**
 * Quick 260724-x4b (Fix 2, LD-2) — DraftReadyBanner tests.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, vi, afterEach, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('../app/(dashboard)/issues/_components/WorkspaceStateProvider', () => ({
  useWorkspaceState: vi.fn(),
}))

import { useWorkspaceState } from '../app/(dashboard)/issues/_components/WorkspaceStateProvider'
import DraftReadyBanner from '../app/(dashboard)/issues/[issueNumber]/_components/DraftReadyBanner'

function mockRunStatus(runStatus: string | undefined) {
  ;(useWorkspaceState as unknown as Mock).mockReturnValue({ runStatus })
}

afterEach(() => {
  cleanup()
})

describe('DraftReadyBanner (LD-2)', () => {
  it('shows the CTA link to the Draft desk when awaiting-review on a non-Draft stage', () => {
    mockRunStatus('awaiting-review')
    render(<DraftReadyBanner issueNumber={12} currentStageSegment="story" />)

    expect(screen.getByText(/the draft is ready/i)).toBeDefined()
    const link = screen.getByRole('link', { name: /draft desk/i })
    expect(link.getAttribute('href')).toBe('/issues/12/draft')
  })

  it('renders null on the Draft stage even while awaiting-review', () => {
    mockRunStatus('awaiting-review')
    const { container } = render(
      <DraftReadyBanner issueNumber={12} currentStageSegment="draft" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders null when the run is not awaiting-review (e.g. running)', () => {
    mockRunStatus('running')
    const { container } = render(
      <DraftReadyBanner issueNumber={12} currentStageSegment="story" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('hides the banner for the session once dismissed', () => {
    mockRunStatus('awaiting-review')
    render(<DraftReadyBanner issueNumber={12} currentStageSegment="story" />)

    expect(screen.getByText(/the draft is ready/i)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/the draft is ready/i)).toBeNull()
  })
})
