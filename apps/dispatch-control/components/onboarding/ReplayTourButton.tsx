'use client'
/**
 * Quick 260721-qdx — small client island for `how-to-use/page.tsx` (which
 * stays a Server Component). Calls `launchTour()` from the shell-level
 * `OnboardingProvider` context.
 */
import { useOnboarding } from './OnboardingProvider'

export default function ReplayTourButton() {
  const { launchTour } = useOnboarding()

  return (
    <button
      type="button"
      onClick={launchTour}
      className="flex min-h-[44px] items-center rounded-[2px] border border-[color:var(--color-ink)]/[.2] bg-[color:var(--color-card)] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
    >
      Replay the tour
    </button>
  )
}
