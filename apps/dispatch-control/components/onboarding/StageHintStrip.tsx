'use client'
/**
 * Quick 260721-qdx (Task 3) — a one-time dismissible hint strip mounted
 * above the stage canvas in the Issue Workspace frame
 * (`issues/[issueNumber]/layout.tsx`), one per stage segment.
 *
 * CRITICAL (render-loop discipline, learned 260721-pmn/-ohu): this
 * component MUST NOT import or call `useWorkspaceState` and MUST NOT call
 * `setPanelContent`. It only reads the shell-level `useOnboarding()` context
 * (mounted in `app/(dashboard)/layout.tsx`, a completely separate provider
 * from the Issue Workspace's `WorkspaceStateProvider`) and fires its own
 * `dismissStageHint` mutation — it can never feed the
 * `WorkspaceStateProvider` `setPanelContent` publish cycle. No
 * setState-in-effect; handlers are plain functions (no unstable deps).
 */
import { useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import { useOnboarding } from './OnboardingProvider'
import { STAGE_HINTS, type StageSegment } from './onboardingCopy'

export interface StageHintStripProps {
  issueNumber: number
  stage: StageSegment
}

export default function StageHintStrip({ issueNumber, stage }: StageHintStripProps) {
  const { onboarding } = useOnboarding()
  const dismissStageHint = useMutation(api.userOnboarding.dismissStageHint)

  const dismissed = onboarding?.dismissedStageHints?.includes(stage) ?? false
  if (dismissed) return null

  const hint = STAGE_HINTS[stage]

  function handleDismiss() {
    void dismissStageHint({ stage })
  }

  return (
    <div
      data-testid="stage-hint-strip"
      data-issue-number={issueNumber}
      className="flex items-center justify-between gap-3 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-4 py-2"
    >
      <p className="font-[family-name:var(--font-ui)] text-[12.5px] text-[color:var(--color-ink-soft)]">
        <span className="font-semibold text-[color:var(--color-ink)]">{hint.label}</span> —{' '}
        {hint.body}
      </p>
      <div className="flex flex-none items-center gap-1">
        <button
          type="button"
          onClick={handleDismiss}
          className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[12.5px] font-semibold text-[color:var(--color-cobalt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss hint"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center font-[family-name:var(--font-ui)] text-[14px] text-[color:var(--color-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
