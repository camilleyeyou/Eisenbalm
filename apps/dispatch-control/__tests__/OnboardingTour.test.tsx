/**
 * Quick 260721-qdx (Task 2) — OnboardingTour (+ OnboardingProvider, whose
 * auto-launch logic this test exercises through the real provider).
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom). Mocks
 * `@clerk/nextjs` `useAuth`, `convex/react` `useQuery`/`useMutation`, and
 * `@convex/_generated/api` — mirrors the `CreatePanel.test.tsx` scaffolding.
 *
 * Onboarding row fixtures are module-level consts returned BY REFERENCE from
 * the mocked `useQuery` (not fresh objects per call) so the "real Convex
 * useQuery result is referentially stable between renders" contract
 * `OnboardingProvider` relies on actually holds in this test.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ userId: 'user_1' }),
}))

const completeTourMock = vi.fn(async () => undefined)
vi.mock('convex/react', () => ({
  useQuery: () => onboardingQueryResult,
  useMutation: () => (...args: unknown[]) => completeTourMock(...args),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    userOnboarding: {
      byClerkUserId: 'userOnboarding:byClerkUserId',
      completeTour: 'userOnboarding:completeTour',
    },
  },
}))

import { OnboardingProvider } from '../components/onboarding/OnboardingProvider'
import OnboardingTour from '../components/onboarding/OnboardingTour'
import { TOUR_STEPS } from '../components/onboarding/onboardingCopy'

// Module-level fixtures — returned BY REFERENCE from the mocked useQuery.
const ROW_TOUR_NOT_COMPLETED = {
  _id: 'row_1',
  tourCompletedAt: undefined,
  cardDismissedAt: undefined,
  dismissedStageHints: undefined,
}

let onboardingQueryResult: typeof ROW_TOUR_NOT_COMPLETED | null | undefined =
  ROW_TOUR_NOT_COMPLETED

function renderTour() {
  return render(
    <OnboardingProvider>
      <OnboardingTour />
    </OnboardingProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  onboardingQueryResult = ROW_TOUR_NOT_COMPLETED
})

afterEach(() => {
  cleanup()
})

describe('OnboardingTour', () => {
  it('auto-opens once the onboarding query resolves with tourCompletedAt == null', () => {
    renderTour()
    expect(screen.getByRole('dialog', { name: /guided tour/i })).toBeDefined()
    expect(screen.getByText(TOUR_STEPS[0]!.title)).toBeDefined()
  })

  it('does not auto-open while the onboarding query is still loading (undefined)', () => {
    onboardingQueryResult = undefined
    renderTour()
    expect(screen.queryByRole('dialog', { name: /guided tour/i })).toBeNull()
  })

  it('does not auto-open once tourCompletedAt is already set', () => {
    onboardingQueryResult = { ...ROW_TOUR_NOT_COMPLETED, tourCompletedAt: 1700000000000 }
    renderTour()
    expect(screen.queryByRole('dialog', { name: /guided tour/i })).toBeNull()
  })

  it('"Next" advances through the steps', () => {
    renderTour()
    expect(screen.getByText(TOUR_STEPS[0]!.title)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    expect(screen.getByText(TOUR_STEPS[1]!.title)).toBeDefined()
  })

  it('"Skip tour" calls the completeTour mutation and closes the overlay', async () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: /skip tour/i }))

    await waitFor(() => {
      expect(completeTourMock).toHaveBeenCalledWith({})
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /guided tour/i })).toBeNull()
    })
  })

  it('"Next"/"Done" on the final step calls the completeTour mutation and closes the overlay', async () => {
    renderTour()
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    }
    expect(screen.getByRole('button', { name: /^done$/i })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))

    await waitFor(() => {
      expect(completeTourMock).toHaveBeenCalledWith({})
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /guided tour/i })).toBeNull()
    })
  })
})
