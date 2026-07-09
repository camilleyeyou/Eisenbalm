'use client'
/**
 * Voice Pass — auto-focus shell (Phase 36, VOX-01, Plan 36-04 Task 3).
 *
 * Replaces the Phase 30 PlaceholderScreen. Mirrors review-desk/page.tsx's
 * auto-focus pattern exactly (D-03b: Voice Pass is a peer destination to
 * the Review Desk) — single operator, one issue per week: this route
 * resolves the CURRENT awaiting-review run and routes straight to its
 * de-slop screen at /voice-pass/[runId]. No run id is ever hardcoded; the
 * awaiting-review run is read from the SAME Convex source Review Desk and
 * run-monitor's ReviewQueue use (`api.runs.listForWorkspace`, filtered to
 * status === 'awaiting-review').
 *
 * - Exactly one awaiting-review run -> redirect straight to its de-slop screen.
 * - Multiple awaiting-review runs (rare) -> render a minimal run switcher.
 * - None -> render an empty state using the 1c PlaceholderScreen-style chrome.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'

export default function VoicePassPage() {
  const router = useRouter()
  const runs = useQuery(api.runs.listForWorkspace, { workspace_id: DEFAULT_WORKSPACE_ID })
  const awaitingReview = runs?.filter(r => r.status === 'awaiting-review') ?? []

  const soleRunId = awaitingReview.length === 1 ? awaitingReview[0]?.runId : undefined

  useEffect(() => {
    if (soleRunId) {
      router.replace(`/voice-pass/${encodeURIComponent(soleRunId)}`)
    }
  }, [soleRunId, router])

  // Still loading the run list.
  if (runs === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-[color:var(--color-ink-soft)]">Loading…</p>
      </div>
    )
  }

  // Exactly one awaiting-review run — redirect is in flight (useEffect above).
  if (soleRunId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-[color:var(--color-ink-soft)]">Opening Voice Pass…</p>
      </div>
    )
  }

  // Multiple awaiting-review runs — minimal switcher.
  if (awaitingReview.length > 1) {
    return (
      <div className="flex min-h-[60vh] flex-col gap-4 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-10">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--color-ink)]">
          Multiple issues awaiting review
        </h1>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Pick which awaiting-review run to open in Voice Pass.
        </p>
        <ul role="list" className="flex flex-col gap-2">
          {awaitingReview.map(run => (
            <li key={run._id}>
              <Link
                href={`/voice-pass/${encodeURIComponent(run.runId)}`}
                className="flex min-h-[44px] items-center gap-2 rounded-[2px] border border-[color:var(--color-faint)] bg-white px-4 py-2 font-[family-name:var(--font-ui)] text-[13px] font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
              >
                Run {run.runId}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // No run awaiting review — empty state (1c PlaceholderScreen-style chrome).
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center gap-4 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-10">
      <span
        className="inline-block rounded-[2px] bg-[color:var(--color-marigold)] px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.08em] text-[color:var(--color-ink)]"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        no run awaiting review
      </span>
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[color:var(--color-ink)]">
        Voice Pass
      </h1>
      <p className="max-w-xl text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
        No issue is awaiting review. When the pipeline finishes a run and it
        lands in awaiting-review, it will open here automatically.
      </p>
    </div>
  )
}
