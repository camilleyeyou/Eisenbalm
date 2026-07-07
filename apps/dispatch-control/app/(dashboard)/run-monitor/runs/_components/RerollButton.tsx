'use client'
/**
 * Phase 25 (RUN-05) — Per-section Re-roll button for the Run detail table.
 *
 * Renders ONLY for the 7 re-rollable section writers. For all other agentKeys,
 * returns null (empty cell).
 *
 * Disabled while run is in progress (D-04): shows grayed "Re-roll" with a
 * tooltip explaining availability.
 *
 * One-step confirmation via window.confirm() (accessible by default in all
 * browsers; no custom modal needed for this low-frequency operation).
 *
 * On success: shows "Re-rolled ✓" inline (green) for 3 seconds, then clears.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { rerollAgent } from '@/lib/pipelineControlClient'

/** The 7 section writers that can be re-rolled (D-03). */
const SECTION_WRITERS = [
  'origin_story',
  'problem',
  'founder_bio',
  'case_study',
  'game',
  'bonus',
  'design',
]

/** Human-readable labels for the confirm dialog. */
const SECTION_LABELS: Record<string, string> = {
  origin_story: 'origin story',
  problem: 'problem',
  founder_bio: 'founder bio',
  case_study: 'case study',
  game: 'game',
  bonus: 'bonus',
  design: 'design',
}

interface RerollButtonProps {
  runId: string
  agentKey: string
  runStatus: string
}

export default function RerollButton({ runId, agentKey, runStatus }: RerollButtonProps) {
  const { getToken } = useAuth()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Only section writers get a Re-roll button; all others get an empty cell.
  if (!SECTION_WRITERS.includes(agentKey)) return null

  const isRunning = runStatus === 'running'
  const sectionLabel = SECTION_LABELS[agentKey] ?? agentKey

  async function handleReroll() {
    const confirmed = window.confirm(
      `Re-roll ${sectionLabel}? This will regenerate just this section and rewrite the Sanity draft. All other sections are unchanged.`,
    )
    if (!confirmed) return

    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      await rerollAgent(runId, agentKey, token)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <span className="text-xs text-green-600">Re-rolled ✓</span>
    )
  }

  if (error) {
    return (
      <span className="text-xs text-red-600">{error}</span>
    )
  }

  if (isRunning) {
    return (
      <button
        type="button"
        disabled
        title="Re-roll is available only after the run completes (D-04)."
        aria-label={`Re-roll ${sectionLabel}`}
        className="text-xs text-neutral-300 cursor-not-allowed underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
      >
        Re-roll
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleReroll}
      disabled={loading}
      aria-label={`Re-roll ${sectionLabel}`}
      className="text-xs text-neutral-500 underline hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
    >
      Re-roll
    </button>
  )
}
