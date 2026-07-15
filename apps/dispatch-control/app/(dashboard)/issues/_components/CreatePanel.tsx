'use client'
/**
 * Phase 40 Plan 40-05 (§40-UI-SPEC, ISS-01, D-28) — the ONE Create path
 * this phase ships: "Find a story with agents".
 *
 * Placed AFTER the lists (Visual Hierarchy) — the fallback path when
 * nothing is in progress, not a competing primary action. In the empty
 * state (no in-progress issue), the PAGE promotes this panel to the focal
 * point (Display heading, card surface) per the Visual-Hierarchy inversion
 * — this component itself renders identically either way; the page decides
 * placement/prominence.
 *
 * Layout reserves a second grid cell for Phase 48's "Start from my brief"
 * — that slot is simply ABSENT this phase, never a disabled/dead button
 * (D-28's "no dead button in the primary CTA" locked decision).
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { triggerRun } from '@/lib/pipelineControlClient'
import { issueHref } from '@/lib/issueRouteResolver'

export interface CreatePanelProps {
  nextIssueNumber: number
}

export default function CreatePanel({ nextIssueNumber }: CreatePanelProps) {
  const router = useRouter()
  const { getToken } = useAuth()
  const ensureByNumber = useMutation(api.issues.ensureByNumber)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await ensureByNumber({
        workspace_id: DEFAULT_WORKSPACE_ID,
        issueNumber: nextIssueNumber,
      })
      const token = await getToken()
      await triggerRun({ issueNumber: nextIssueNumber }, token)
      router.push(issueHref(nextIssueNumber))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col items-start gap-3 rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-6">
        <h2 className="font-[family-name:var(--font-display)] text-[16px] font-semibold text-[color:var(--color-ink)]">
          Find a story
        </h2>
        <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
          The agents scout, argue, and land on this week&rsquo;s charity — you decide at
          Gate 1.
        </p>
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy}
          className="mt-1 flex min-h-[44px] items-center justify-center rounded-[2px] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Find a story with agents
        </button>
        {error && (
          <p className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-vermilion)]">
            {error}
          </p>
        )}
      </div>
      {/* Second Create-path slot (Phase 48, "Start from my brief") —
          intentionally absent this phase, not a disabled/dead button. */}
    </div>
  )
}
