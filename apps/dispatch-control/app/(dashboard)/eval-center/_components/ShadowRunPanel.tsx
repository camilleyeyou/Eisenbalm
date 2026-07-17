'use client'
/**
 * ShadowRunPanel — read-only "Preview next run" affordance (Phase 38,
 * EVL-05, D-11/D-13; Phase 50 WBN-05 renamed from "Shadow run"). Design
 * brief §Eval Center: "Shadow run card (runs scenario 1 against this week's
 * real news before paying for a live run)".
 *
 * Triggers `POST /eval/shadow-run` (via lib/shadowRunClient's `runShadow`) on
 * an EXPLICIT button click only — never on mount — and renders the returned
 * candidates inline. The call hits LIVE search (real cost/time, same as a
 * real Scout discovery step) but writes NOTHING to run state: no
 * pipelineRuns/pitchLog/charities row, no Sanity `write_charity`. Isolation is
 * a server-side proven contract (packages/pipeline/tests/api/test_shadow_run.py,
 * D-12) — this panel is a thin, read-only trigger + inline preview.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { runShadow, type ShadowCandidate } from '@/lib/shadowRunClient'

type ShadowStatus = 'idle' | 'running' | 'done' | 'error'

export default function ShadowRunPanel() {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<ShadowStatus>('idle')
  const [candidates, setCandidates] = useState<ShadowCandidate[]>([])
  const [featuredKeysCount, setFeaturedKeysCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRunShadow() {
    if (status === 'running') return
    setStatus('running')
    setError(null)
    try {
      const token = await getToken()
      const result = await runShadow(token)
      setCandidates(result.candidates)
      setFeaturedKeysCount(result.featuredKeysCount)
      setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }

  return (
    <section
      aria-label="Preview next run"
      className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]">
          Preview next run
        </h2>
        <span className="font-[family-name:var(--font-ui)] text-[10px] font-medium uppercase tracking-[.06em] text-[color:var(--color-marigold-text)]">
          Read-only preview
        </span>
      </div>

      <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--color-ink-soft)]">
        Runs the discovery scenario against this week&apos;s real news before
        paying for a live run. Writes nothing to run state — no pipeline run,
        pitch, or registry row is created.
      </p>

      <button
        type="button"
        onClick={handleRunShadow}
        disabled={status === 'running'}
        className="mt-3 min-h-[44px] rounded-[2px] bg-[color:var(--color-ink)] px-3 py-2 font-[family-name:var(--font-ui)] text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-2"
      >
        {status === 'running' ? 'Previewing next run…' : 'Preview next run'}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-[12px] text-[color:var(--color-vermilion)]">
          {error}
        </p>
      )}

      {status === 'done' && (
        <div className="mt-3" data-testid="shadow-run-results">
          <p className="text-[12px] text-[color:var(--color-ink-soft)]">
            {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} surfaced
            {featuredKeysCount != null ? ` · ${featuredKeysCount} already featured` : ''}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {candidates.map(candidate => (
              <li
                key={candidate.name}
                data-testid={`shadow-candidate-${candidate.name}`}
                className="border border-[color:var(--color-faint)] bg-white p-3"
              >
                <h3 className="font-[family-name:var(--font-display)] text-[14px] font-semibold text-[color:var(--color-ink)]">
                  {candidate.name}
                </h3>
                <p className="text-[11px] text-[color:var(--color-ink-soft)]">
                  {candidate.focusArea}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--color-ink)]">
                  {candidate.scoutSummary}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
