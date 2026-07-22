'use client'
/**
 * Quick 260721-qdx — the in-house first-run step tour overlay.
 *
 * No new npm dependency (no react-joyride etc.) — a dim fixed backdrop plus
 * a single centered step card. Pixel-perfect spotlight cutouts are not
 * required (Claude's discretion, CONTEXT.md).
 *
 * Renders nothing when the tour isn't open. `Next` on the last step and
 * `Skip tour` both call `api.userOnboarding.completeTour` then `closeTour()`
 * — both are terminal (the tour never re-auto-launches once either fires).
 * Esc closes the tour (= skip).
 */
import { useEffect, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import { useOnboarding } from './OnboardingProvider'
import { TOUR_STEPS } from './onboardingCopy'

const SKIP_BUTTON_CLASS =
  'flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]'
const SECONDARY_BUTTON_CLASS =
  'flex min-h-[44px] items-center rounded-[2px] px-3 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]'
const PRIMARY_BUTTON_CLASS =
  'flex min-h-[44px] items-center rounded-[2px] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]'

export default function OnboardingTour() {
  const { isTourOpen, closeTour } = useOnboarding()
  const completeTour = useMutation(api.userOnboarding.completeTour)
  const [stepIndex, setStepIndex] = useState(0)

  // Reset to the first step every time the tour (re-)opens (e.g. replayed
  // from How to use / the Start-here card after a prior completion).
  useEffect(() => {
    if (isTourOpen) setStepIndex(0)
  }, [isTourOpen])

  async function finish() {
    try {
      await completeTour({})
    } finally {
      closeTour()
    }
  }

  useEffect(() => {
    if (!isTourOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        void finish()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // finish() closes over the current completeTour/closeTour references,
    // which are stable (useMutation / useCallback) — safe to omit here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTourOpen])

  if (!isTourOpen) return null

  const step = TOUR_STEPS[stepIndex]
  if (!step) return null
  const isLast = stepIndex === TOUR_STEPS.length - 1

  async function handleNext() {
    if (isLast) {
      await finish()
      return
    }
    setStepIndex(i => i + 1)
  }

  function handleBack() {
    setStepIndex(i => Math.max(0, i - 1))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-ink)]/70"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guided tour"
        className="mx-4 flex w-full max-w-[420px] flex-col gap-4 rounded-[2px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-6"
      >
        <span className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-ink-soft)]">
          Step {stepIndex + 1} of {TOUR_STEPS.length}
        </span>
        <h2 className="font-[family-name:var(--font-display)] text-[20px] text-[color:var(--color-ink)]">
          {step.title}
        </h2>
        <p className="font-[family-name:var(--font-body)] text-[14px] leading-relaxed text-[color:var(--color-ink-soft)]">
          {step.body}
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <button type="button" onClick={() => void finish()} className={SKIP_BUTTON_CLASS}>
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              disabled={stepIndex === 0}
              className={SECONDARY_BUTTON_CLASS}
            >
              Back
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => void handleNext()}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
