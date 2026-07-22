'use client'
/**
 * Quick 260721-qdx — dismissible "Start here" checklist card, mounted at
 * the TOP of the Issues home content column (`issues/page.tsx`).
 *
 * Maps the weekly loop's 5 stages to their workspace routes for the current
 * in-progress issue (when `inProgressIssueNumber` is `null`, the rows render
 * as plain text — never a dead `/issues/null/...` link). "Take the 1-min
 * tour" replays the shell-level tour via `useOnboarding()`; `Dismiss`/`✕`
 * both call `api.userOnboarding.dismissCard` directly (this card is NOT
 * onboarding-context state itself, only a reader of `cardDismissed`).
 */
import Link from 'next/link'
import { useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { STAGE_SUMMARIES, type StageSegment } from '@/components/onboarding/onboardingCopy'
import {
  issueStoryHref,
  issueDraftHref,
  issueFactCheckHref,
  issueVoiceHref,
  issueApprovalHref,
} from '@/lib/issueRouteResolver'

const STAGE_HREF_FOR: Record<StageSegment, (n: number) => string> = {
  story: issueStoryHref,
  draft: issueDraftHref,
  'fact-check': issueFactCheckHref,
  voice: issueVoiceHref,
  approval: issueApprovalHref,
}

export interface StartHereCardProps {
  inProgressIssueNumber: number | null
}

export default function StartHereCard({ inProgressIssueNumber }: StartHereCardProps) {
  const { cardDismissed, launchTour } = useOnboarding()
  const dismissCard = useMutation(api.userOnboarding.dismissCard)

  if (cardDismissed) return null

  function handleDismiss() {
    void dismissCard({})
  }

  return (
    <div className="relative flex flex-col gap-4 rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-6">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
      >
        ✕
      </button>

      <h2 className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[color:var(--color-ink)]">
        Start here
      </h2>

      <ol className="flex flex-col gap-2.5">
        {STAGE_SUMMARIES.map((stage, i) => (
          <li key={stage.segment} className="flex items-start gap-3">
            <span className="font-[family-name:var(--font-display)] text-[15px] leading-[1.4] text-[color:var(--color-cobalt)]">
              {i + 1}
            </span>
            <div className="flex flex-col">
              {inProgressIssueNumber !== null ? (
                <Link
                  href={STAGE_HREF_FOR[stage.segment](inProgressIssueNumber)}
                  className="font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
                >
                  {stage.label}
                </Link>
              ) : (
                <span className="font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink)]">
                  {stage.label}
                </span>
              )}
              <span className="font-[family-name:var(--font-ui)] text-[12.5px] text-[color:var(--color-ink-soft)]">
                {stage.body}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={launchTour}
          className="flex min-h-[44px] items-center rounded-[2px] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
        >
          Take the 1-min tour
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex min-h-[44px] items-center px-3 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
