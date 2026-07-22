'use client'
/**
 * Quick 260721-qdx — the single onboarding context/provider.
 *
 * Mounted ONCE in the dashboard shell (`app/(dashboard)/layout.tsx`), INSIDE
 * `<InspectorProvider>`. This provider is a sibling of, and completely
 * independent from, `WorkspaceStateProvider` (mounted separately, only
 * inside the Issue Workspace frame) — it writes NO WorkspaceStateProvider
 * state and reads none of its Convex subscriptions.
 *
 * The ONLY subscription here is a single `useQuery(api.userOnboarding.byClerkUserId, ...)`
 * — its result is referentially stable between renders (real Convex
 * behaviour), so it is exposed directly, never `.map`/re-wrapped (the
 * render-loop discipline learned in quick 260721-pmn/-ohu, applied
 * pre-emptively here even though this provider has no downstream
 * `setPanelContent`-style publish cycle to protect).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from 'convex/react'
import { useAuth } from '@clerk/nextjs'
import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'

export interface OnboardingContextValue {
  /** `undefined` while loading (or auth not yet resolved); `null` once
   * resolved with no row for this user yet. */
  onboarding: Doc<'user_onboarding'> | null | undefined
  isTourOpen: boolean
  launchTour: () => void
  closeTour: () => void
  /** `true` once the Issues-home "Start here" card has been dismissed. */
  cardDismissed: boolean
  /** `true` once the tour has been completed OR skipped. */
  tourCompleted: boolean
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()

  const onboarding = useQuery(
    api.userOnboarding.byClerkUserId,
    userId ? { workspace_id: DEFAULT_WORKSPACE_ID, clerkUserId: userId } : 'skip',
  )

  const [isTourOpen, setIsTourOpen] = useState(false)

  // One-shot auto-launch guard — fires at most once per mount. Never opens
  // while `onboarding` is still `undefined` (loading, or the query is
  // 'skip'-guarded because auth hasn't resolved yet).
  const autoLaunchedRef = useRef(false)
  useEffect(() => {
    if (autoLaunchedRef.current) return
    if (onboarding === undefined) return
    autoLaunchedRef.current = true
    if (onboarding === null || onboarding.tourCompletedAt == null) {
      setIsTourOpen(true)
    }
  }, [onboarding])

  const launchTour = useCallback(() => setIsTourOpen(true), [])
  const closeTour = useCallback(() => setIsTourOpen(false), [])

  const value = useMemo<OnboardingContextValue>(
    () => ({
      onboarding,
      isTourOpen,
      launchTour,
      closeTour,
      cardDismissed: onboarding?.cardDismissedAt != null,
      tourCompleted: onboarding?.tourCompletedAt != null,
    }),
    [onboarding, isTourOpen, launchTour, closeTour],
  )

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

/** Throws if used outside an `<OnboardingProvider>` — no silent `undefined` reads. */
export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext)
  if (ctx === null) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return ctx
}
