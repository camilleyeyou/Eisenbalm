'use client'
/**
 * Phase 37 (MON-03, D-05/D-06/D-07) — WriterExpansion: the 7-writers node
 * expanded into per-section strength rows.
 *
 * Renders one row per re-rollable section-writer agentKey (origin_story,
 * problem, founder_bio, case_study, game, bonus — `design` is excluded here;
 * it is always-shown/dimmed on the spine per Phase 23 Pitfall 4 but is not
 * QA-scored the same way as the 6 narrative/structured writers). Section IDs
 * map 1:1 to writer agentKeys (Research Pattern 2) — `qaCorrections.sectionName`
 * is used directly as the rerun endpoint's `{agent_key}` path param, no new
 * lookup needed.
 *
 * Each row shows:
 *   - a deterministic 0-100 strength bar (`strengthScore` over that section's
 *     OPEN qaCorrections findings only, colored by `bandFor`)
 *   - open flag counts by severity (`flagCounts`)
 *   - a "Re-run" button that calls the existing `rerollAgent` client
 *     (POST /runs/{runId}/agents/{sectionName}/rerun — Phase 25 RUN-05,
 *     the same call site the Phase 33 decision rail uses). Disabled while
 *     `runStatus === 'running'` (mirrors the endpoint's 409 guard).
 *
 * A section with zero qaCorrections rows shows 100/green (no findings yet
 * means nothing has flagged it).
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { strengthScore, flagCounts, bandFor, type QaFindingRow } from '@/lib/runMonitor/strengthScore'
import { rerollAgent } from '@/lib/pipelineControlClient'

/** The 6 re-rollable writer sections (design excluded — see file header). */
export const WRITER_SECTIONS: string[] = [
  'origin_story',
  'problem',
  'founder_bio',
  'case_study',
  'game',
  'bonus',
]

const SECTION_LABELS: Record<string, string> = {
  origin_story: 'Origin Story',
  problem: 'Problem',
  founder_bio: 'Founder Bio',
  case_study: 'Case Study',
  game: 'Game',
  bonus: 'Bonus',
}

const BAND_BAR_CLASS: Record<'green' | 'amber' | 'red', string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

const BAND_TEXT_CLASS: Record<'green' | 'amber' | 'red', string> = {
  green: 'text-green-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
}

interface QaCorrectionRow extends QaFindingRow {
  sectionName: string
}

export interface WriterExpansionProps {
  runId: string
  runStatus?: string
}

export function WriterExpansion({ runId, runStatus }: WriterExpansionProps) {
  const { getToken } = useAuth()
  const rows = useQuery(api.qaCorrections.byRunId, { runId }) as
    | QaCorrectionRow[]
    | undefined

  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const isRunning = runStatus === 'running'

  async function handleRerun(sectionName: string) {
    setBusyKey(sectionName)
    setMessage(null)
    try {
      const token = await getToken()
      await rerollAgent(runId, sectionName, token)
      setMessage(`Re-run queued for ${SECTION_LABELS[sectionName] ?? sectionName}.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Re-run failed.')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div
      className="p-3 space-y-2 bg-white border border-neutral-200 rounded-lg shadow-lg"
      role="region"
      aria-label="7-writers strength expansion"
    >
      <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
        Section Strength
      </h3>

      {rows === undefined ? (
        <p className="text-[11px] text-neutral-400">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {WRITER_SECTIONS.map(sectionName => {
            const sectionRows = rows.filter(r => r.sectionName === sectionName)
            const score = strengthScore(sectionRows)
            const flags = flagCounts(sectionRows)
            const band = bandFor(score)
            const label = SECTION_LABELS[sectionName] ?? sectionName

            return (
              <li key={sectionName} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[11px] font-medium text-neutral-700">
                  {label}
                </span>

                {/* Strength bar (MON-03) */}
                <div
                  className="flex-1 h-2 rounded bg-neutral-100 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${label} strength`}
                >
                  <div
                    data-testid={`strength-bar-${sectionName}`}
                    data-band={band}
                    className={`h-full ${BAND_BAR_CLASS[band]}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span
                  data-testid={`strength-score-${sectionName}`}
                  className={`w-8 shrink-0 text-right text-[11px] font-semibold ${BAND_TEXT_CLASS[band]}`}
                >
                  {score}
                </span>

                {/* Flag counts (D-07) */}
                <span
                  className="shrink-0 flex gap-1 text-[10px]"
                  data-testid={`flag-counts-${sectionName}`}
                >
                  <span className="rounded bg-red-100 px-1 text-red-700" title="Open errors">
                    E:{flags.error}
                  </span>
                  <span className="rounded bg-amber-100 px-1 text-amber-700" title="Open warnings">
                    W:{flags.warning}
                  </span>
                  <span className="rounded bg-neutral-100 px-1 text-neutral-600" title="Open info">
                    I:{flags.info}
                  </span>
                </span>

                {/* Re-run (D-06) — disabled while the run is still going. */}
                <button
                  type="button"
                  onClick={() => handleRerun(sectionName)}
                  disabled={isRunning || busyKey === sectionName}
                  className="shrink-0 rounded border border-neutral-300 bg-white px-2 py-1 text-[10px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busyKey === sectionName ? 'Re-running…' : 'Re-run'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {message && <p className="text-[10px] text-neutral-500">{message}</p>}
    </div>
  )
}
