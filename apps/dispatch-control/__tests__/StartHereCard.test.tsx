/**
 * Quick 260721-qdx (Task 2) — StartHereCard.
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom). Mocks
 * `useOnboarding()` directly (StartHereCard's only onboarding-context read is
 * `cardDismissed`/`launchTour`) and `convex/react`'s `useMutation` +
 * `@convex/_generated/api` (the `Dismiss`/`✕` buttons call
 * `api.userOnboarding.dismissCard` directly, not through the context) —
 * mirrors the `CreatePanel.test.tsx` mock scaffolding.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

// ── Module mocks ─────────────────────────────────────────────────────────

const dismissCardMock = vi.fn(async () => ({ ok: true }))
vi.mock('convex/react', () => ({
  useMutation: () => (...args: unknown[]) => dismissCardMock(...args),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    userOnboarding: {
      dismissCard: 'userOnboarding:dismissCard',
    },
  },
}))

const launchTourMock = vi.fn()
let cardDismissed = false
vi.mock('@/components/onboarding/OnboardingProvider', () => ({
  useOnboarding: () => ({
    cardDismissed,
    launchTour: launchTourMock,
  }),
}))

import StartHereCard from '../app/(dashboard)/issues/_components/StartHereCard'

beforeEach(() => {
  vi.clearAllMocks()
  cardDismissed = false
})

afterEach(() => {
  cleanup()
})

describe('StartHereCard', () => {
  it('renders 5 stage rows with correct hrefs for a given in-progress issue number', () => {
    render(<StartHereCard inProgressIssueNumber={7} />)

    expect(screen.getByRole('link', { name: 'Story' })).toHaveProperty(
      'href',
      expect.stringContaining('/issues/7/story'),
    )
    expect(screen.getByRole('link', { name: 'Draft' })).toHaveProperty(
      'href',
      expect.stringContaining('/issues/7/draft'),
    )
    expect(screen.getByRole('link', { name: 'Fact Check' })).toHaveProperty(
      'href',
      expect.stringContaining('/issues/7/fact-check'),
    )
    expect(screen.getByRole('link', { name: 'Voice' })).toHaveProperty(
      'href',
      expect.stringContaining('/issues/7/voice'),
    )
    expect(screen.getByRole('link', { name: 'Approval' })).toHaveProperty(
      'href',
      expect.stringContaining('/issues/7/approval'),
    )
  })

  it('renders stage labels as plain text (no dead link) when no issue is in progress', () => {
    render(<StartHereCard inProgressIssueNumber={null} />)

    expect(screen.queryByRole('link', { name: 'Story' })).toBeNull()
    expect(screen.getByText('Story')).toBeDefined()
  })

  it('clicking "Take the 1-min tour" calls launchTour', () => {
    render(<StartHereCard inProgressIssueNumber={7} />)
    fireEvent.click(screen.getByRole('button', { name: /take the 1-min tour/i }))
    expect(launchTourMock).toHaveBeenCalledTimes(1)
  })

  it('clicking "Dismiss" and the ✕ close both call the dismissCard mutation (both share the accessible name "Dismiss")', () => {
    render(<StartHereCard inProgressIssueNumber={7} />)
    const dismissButtons = screen.getAllByRole('button', { name: /^dismiss$/i })
    expect(dismissButtons).toHaveLength(2)

    fireEvent.click(dismissButtons[0]!)
    expect(dismissCardMock).toHaveBeenCalledWith({})

    fireEvent.click(dismissButtons[1]!)
    expect(dismissCardMock).toHaveBeenCalledTimes(2)
  })

  it('renders nothing once the onboarding row has cardDismissedAt set (cardDismissed === true)', () => {
    cardDismissed = true
    const { container } = render(<StartHereCard inProgressIssueNumber={7} />)
    expect(container.firstChild).toBeNull()
  })
})
