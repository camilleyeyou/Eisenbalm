'use client'
/**
 * Phase 47 Plan 47-06 (BRF-04) — NeedsYourDecisionCard: the "Needs your
 * decision" two-option side-by-side adjudication card.
 *
 * The human-facing label is LITERALLY "Needs your decision" — never the
 * internal `requiresHumanInput` flag (CONTEXT D-07, state model §105-110).
 * The top two options (by `advocateScore`, reconstructed client-side via
 * `joinCandidates` — §37.4(b); `editor_gate_1`'s interrupt payload computes
 * `topTwoScores` server-side, but the dashboard does not read the interrupt
 * payload directly, per 47-RESEARCH BRF-04) render side by side with four
 * comparison rows: what each makes possible, evidence quality, risk, burden.
 *
 * "Choose this story" is disabled until a rationale is entered. Submitting
 * calls the UNCHANGED Phase-37 resume bridge —
 * `adjudicateGate1(runId, { selection: { charityName }, reason }, token)` —
 * the SAME client `AdjudicationPanel.tsx` uses. This component adapts
 * `AdjudicationPanel.tsx` to a richer two-column comparison layout; the
 * resume machinery itself is untouched (D-02/D-08 — no second resume path).
 *
 * The header "⏸ Paused for you" System-activity chip (`components/Masthead.tsx`)
 * derives independently from the run's own status/completedAt subscription —
 * it flips away automatically once `adjudicateGate1` resumes the run and the
 * run's status changes; no coupling from this component is needed or added.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { adjudicateGate1 } from '@/lib/pipelineControlClient'
import {
  joinCandidates,
  type PitchLogRow,
  type AdvocateArgumentRow,
} from '../../signal-desk/_components/CandidateSlate'

export interface VerificationRecordRow {
  candidateId: string
  candidateName: string
  domainLive: boolean
  registrationVerified: boolean
  pressHits: number
  obscurityVerdict: string
  checkedAt: number
  // quick 260719-w6o (F2) — the runtime Convex row already carries these
  // (verificationRecords schema, convex/schema.ts:572-574); this LOCAL type
  // just hadn't declared them yet.
  killed?: boolean
  killReason?: string
}

export interface NeedsYourDecisionCardProps {
  runId: string
  pitchRows: PitchLogRow[]
  advocateRows: AdvocateArgumentRow[]
  verificationRecords?: VerificationRecordRow[]
}

function findVerification(
  records: VerificationRecordRow[],
  charityId: string | undefined,
  charityName: string,
): VerificationRecordRow | undefined {
  if (charityId) {
    const byId = records.find(r => r.candidateId === charityId)
    if (byId) return byId
  }
  return records.find(r => r.candidateName === charityName)
}

/** "Evidence quality" — the real Phase-46 verification record, not fabricated copy. */
function describeEvidenceQuality(record: VerificationRecordRow | undefined): string {
  if (!record) return 'Verification not yet complete.'
  return (
    `${record.domainLive ? 'Domain live' : 'Domain not confirmed live'}, ` +
    `${record.registrationVerified ? 'registration verified' : 'registration not verified'}, ` +
    `${record.pressHits} press hit${record.pressHits === 1 ? '' : 's'} (${record.obscurityVerdict}).`
  )
}

/** "Burden" — outstanding verification work remaining, derived from the same record. */
function describeBurden(record: VerificationRecordRow | undefined): string {
  if (!record) return 'Outstanding verification work before this org can proceed.'
  const gaps: string[] = []
  if (!record.domainLive) gaps.push('confirm the domain is live')
  if (!record.registrationVerified) gaps.push('verify registration')
  if (gaps.length === 0) return 'No outstanding verification burden.'
  return `Still needs to: ${gaps.join('; ')}.`
}

export function NeedsYourDecisionCard({
  runId,
  pitchRows,
  advocateRows,
  verificationRecords = [],
}: NeedsYourDecisionCardProps) {
  const { getToken } = useAuth()

  const [pick, setPick] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const topTwo = joinCandidates(pitchRows, advocateRows)
    .slice()
    .sort((a, b) => (b.advocateScore ?? -Infinity) - (a.advocateScore ?? -Infinity))
    .slice(0, 2)

  const canSubmit = pick !== null && reason.trim().length > 0 && !busy

  async function handleChoose() {
    if (!pick) return
    setBusy(true)
    setMessage(null)
    try {
      const token = await getToken()
      await adjudicateGate1(runId, { selection: { charityName: pick }, reason }, token)
      setMessage(`Resumed the run with ${pick}.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Adjudication failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Needs your decision"
      className="border border-[color:var(--color-vermilion)] bg-[color:var(--color-card)] p-4"
    >
      <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[.09em] text-[color:var(--color-vermilion)]">
        Needs your decision
      </h2>
      <p className="mt-1 text-[13px] text-[color:var(--color-ink-soft)]">
        The agents could not confidently choose. Compare the top two options and pick one, with a
        reason.
      </p>

      <div
        role="radiogroup"
        aria-label="Choose this story"
        className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {topTwo.map(candidate => {
          const pitchRow = pitchRows.find(p => p.charityName === candidate.charityName)
          const verification = findVerification(
            verificationRecords,
            pitchRow?.charityId,
            candidate.charityName,
          )

          return (
            <label
              key={candidate.charityName}
              data-testid={`decision-option-${candidate.charityName}`}
              className="flex flex-col gap-2 border border-[color:var(--color-faint)] bg-white p-3"
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`needs-your-decision-${runId}`}
                  value={candidate.charityName}
                  checked={pick === candidate.charityName}
                  onChange={() => setPick(candidate.charityName)}
                />
                <h3 className="font-[family-name:var(--font-display)] text-[16px] font-semibold text-[color:var(--color-ink)]">
                  {candidate.charityName}
                </h3>
              </div>

              <div>
                <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
                  What this makes possible
                </span>
                <p
                  data-testid={`decision-possible-${candidate.charityName}`}
                  className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
                >
                  {candidate.scoutSummary}
                </p>
              </div>

              <div>
                <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
                  Evidence quality
                </span>
                <p
                  data-testid={`decision-evidence-${candidate.charityName}`}
                  className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
                >
                  {describeEvidenceQuality(verification)}
                </p>
              </div>

              <div>
                <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-vermilion)]">
                  Risk
                </span>
                <p
                  data-testid={`decision-risk-${candidate.charityName}`}
                  className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
                >
                  {verification?.killed
                    ? `Verification killed this candidate: ${verification.killReason || 'unspecified'}`
                    : candidate.primaryConcern || 'No concern flagged.'}
                </p>
              </div>

              <div>
                <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
                  Burden
                </span>
                <p
                  data-testid={`decision-burden-${candidate.charityName}`}
                  className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
                >
                  {describeBurden(verification)}
                </p>
              </div>
            </label>
          )
        })}
      </div>

      <label
        className="mt-3 block font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.06em] text-[color:var(--color-ink)]"
        htmlFor={`decision-reason-${runId}`}
      >
        Rationale (required)
      </label>
      <textarea
        id={`decision-reason-${runId}`}
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={3}
        className="mt-1 w-full border border-[color:var(--color-faint)] bg-white p-2 text-[13px] text-[color:var(--color-ink)]"
      />

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleChoose}
        className="mt-3 min-h-[44px] bg-[color:var(--color-ink)] px-4 py-2 font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-masthead-text)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Choosing…' : 'Choose this story'}
      </button>

      {message && (
        <p role="status" className="mt-2 text-[13px] text-[color:var(--color-ink)]">
          {message}
        </p>
      )}
    </section>
  )
}
