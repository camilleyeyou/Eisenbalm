'use client'
/**
 * Phase 37 (SIG-01, Plan 37-05 Task 1) — CandidateSlate: the Gate 1 candidate
 * slate, a CLIENT-SIDE JOIN of `pitchLog` (scout data) with `deliberationEvents`
 * `advocate-argument` rows (advocate data) — Research Pitfall 3: `pitchLog`
 * does NOT carry `advocateScore`/`advocateArgument`/`primaryConcern`; those
 * live only in the advocate's `deliberationEvents` payload, keyed by
 * `charityId` (fallback: match on the payload's own `charityName`, since
 * `advocate.py` has documented name-matching fragility — prefer charityId
 * where both rows have it).
 *
 * `primaryConcern` (and the expanded `advocateArgument`) render ALWAYS
 * visible / IN FULL — the roadmap/DECISIONS.md rule against clipping long
 * text. No clamping/ellipsis utility class is used anywhere in this file.
 *
 * A pitchLog row with no matching advocate row still renders (scoutSummary
 * always shown; advocateScore/advocateArgument simply absent; primaryConcern
 * degrades to an empty-state dash rather than crashing).
 */
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

export interface PitchLogRow {
  charityId?: string
  charityName: string
  charityLocation: string
  scoutSummary: string
  selected: boolean
}

export interface AdvocateArgumentRow {
  charityId?: string
  payload: string
}

interface AdvocatePayload {
  charityName?: string
  score?: number
  argument?: string
  keyStrengths?: string[]
  primaryConcern?: string
}

export interface Candidate {
  charityName: string
  charityLocation: string
  scoutSummary: string
  selected: boolean
  advocateScore?: number
  advocateArgument?: string
  primaryConcern: string
  keyStrengths?: string[]
}

/** Defensive JSON.parse — a malformed advocate payload must never crash the slate. */
function parseAdvocatePayload(raw: string): AdvocatePayload {
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as AdvocatePayload) : {}
  } catch {
    return {}
  }
}

/**
 * The SIG-01 join: for each pitchLog row, find the advocate row sharing its
 * `charityId` (primary key), falling back to matching the advocate payload's
 * own `charityName` when `charityId` is absent on either side.
 */
export function joinCandidates(
  pitchRows: PitchLogRow[],
  advocateRows: AdvocateArgumentRow[],
): Candidate[] {
  // Pre-parse once so the charityName fallback match doesn't re-parse per pitch row.
  const parsedAdvocates = advocateRows.map(row => ({
    charityId: row.charityId,
    payload: parseAdvocatePayload(row.payload),
  }))

  return pitchRows.map(pitch => {
    let match = pitch.charityId
      ? parsedAdvocates.find(a => a.charityId != null && a.charityId === pitch.charityId)
      : undefined

    if (!match) {
      match = parsedAdvocates.find(a => a.payload.charityName === pitch.charityName)
    }

    const payload = match?.payload ?? {}

    return {
      charityName: pitch.charityName,
      charityLocation: pitch.charityLocation,
      scoutSummary: pitch.scoutSummary,
      selected: pitch.selected,
      advocateScore: payload.score,
      advocateArgument: payload.argument,
      // Always a string — the empty state renders a dash, never
      // `undefined`/a crash, and is never clipped.
      primaryConcern: payload.primaryConcern ?? '',
      keyStrengths: payload.keyStrengths,
    }
  })
}

export interface CandidateSlateProps {
  runId: string
}

export function CandidateSlate({ runId }: CandidateSlateProps) {
  const pitchRows = useQuery(api.pitchLog.byRunId, { runId }) as PitchLogRow[] | undefined
  const advocateRows = useQuery(api.deliberationEvents.byRunIdAndType, {
    runId,
    eventType: 'advocate-argument',
  }) as AdvocateArgumentRow[] | undefined

  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  return (
    <section
      aria-label="Candidate slate"
      className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4"
    >
      <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]">
        Candidate Slate
      </h2>

      {pitchRows === undefined || advocateRows === undefined ? (
        <p className="mt-2 text-[13px] text-[color:var(--color-ink-soft)]">Loading…</p>
      ) : pitchRows.length === 0 ? (
        <p className="mt-2 text-[13px] italic text-[color:var(--color-ink-soft)]">
          No candidates yet
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {joinCandidates(pitchRows, advocateRows).map(candidate => {
            const isExpanded = expandedKey === candidate.charityName

            return (
              <li
                key={candidate.charityName}
                data-testid={`candidate-${candidate.charityName}`}
                className="border border-[color:var(--color-faint)] bg-white p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-[family-name:var(--font-display)] text-[16px] font-semibold text-[color:var(--color-ink)]">
                    {candidate.charityName}
                  </h3>
                  {candidate.selected && (
                    <span
                      data-testid={`selected-badge-${candidate.charityName}`}
                      className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-green)]"
                    >
                      Selected
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-soft)]">
                  {candidate.charityLocation}
                </p>

                <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]">
                  {candidate.scoutSummary}
                </p>

                {candidate.advocateScore != null && (
                  <p
                    data-testid={`advocate-score-${candidate.charityName}`}
                    className="mt-1.5 font-[family-name:var(--font-ui)] text-[12px] font-semibold text-[color:var(--color-cobalt)]"
                  >
                    Advocate score: {candidate.advocateScore}/10
                  </p>
                )}

                {candidate.advocateArgument && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => setExpandedKey(isExpanded ? null : candidate.charityName)}
                      className="font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.06em] text-[color:var(--color-cobalt)]"
                    >
                      {isExpanded ? 'Hide argument' : 'Show argument'}
                    </button>
                    {isExpanded && (
                      <p
                        data-testid={`advocate-argument-${candidate.charityName}`}
                        className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
                      >
                        {candidate.advocateArgument}
                      </p>
                    )}
                  </div>
                )}

                {/* primaryConcern — ALWAYS visible, rendered in FULL, never clipped. */}
                <div className="mt-2 border-t border-[color:var(--color-faint)] pt-1.5">
                  <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-vermilion)]">
                    Primary concern
                  </span>
                  <p
                    data-testid={`primary-concern-${candidate.charityName}`}
                    className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
                  >
                    {candidate.primaryConcern || '—'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
