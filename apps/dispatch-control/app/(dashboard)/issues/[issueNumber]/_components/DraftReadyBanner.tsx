'use client'
/**
 * Quick 260724-x4b (LD-2) — the dismissible draft-ready banner.
 *
 * Mounted once in `layout.tsx` (FrameChrome), immediately after the stage-tab
 * `<nav>` and before the content grid. Carries the operator forward once the
 * run has landed on the Andrew gate (`runStatus === 'awaiting-review'`) but
 * they aren't already looking at the Draft desk — never shown mid-run, never
 * shown while already on the Draft stage, and hidden for the rest of the
 * session once dismissed (no persistence — a fresh page load resets it,
 * matching the STRICT SCOPE lock: no banner-dismissal persistence).
 */
import { useState } from 'react'
import Link from 'next/link'
import { issueDraftHref } from '@/lib/issueRouteResolver'
import { useWorkspaceState } from '../../_components/WorkspaceStateProvider'

interface DraftReadyBannerProps {
  issueNumber: number
  currentStageSegment: string | undefined
}

export default function DraftReadyBanner({
  issueNumber,
  currentStageSegment,
}: DraftReadyBannerProps) {
  const { runStatus } = useWorkspaceState()
  const [dismissed, setDismissed] = useState(false)

  if (runStatus !== 'awaiting-review' || currentStageSegment === 'draft' || dismissed) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border border-[color:var(--color-faint)] border-l-[3px] border-l-[color:var(--color-marigold)] bg-[color:var(--color-card)] px-4 py-2.5">
      <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)]">
        The draft is ready — nine stories are waiting.
      </p>
      <Link
        href={issueDraftHref(issueNumber)}
        className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)] hover:text-[color:var(--color-cobalt-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-cobalt)]"
      >
        Go to the Draft desk &rarr;
      </Link>
      <button
        type="button"
        aria-label="Dismiss draft-ready notice"
        onClick={() => setDismissed(true)}
        className="ml-auto flex min-h-[44px] min-w-[44px] items-center justify-center font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-faint)] hover:text-[color:var(--color-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-cobalt)]"
      >
        &#10005;
      </button>
    </div>
  )
}
