'use client'
/**
 * Phase 47 Plan 47-06 (BRF-03) — OrgOptionSlate: organization options grouped
 * under the chosen (one-active) lead.
 *
 * Adapts `signal-desk/_components/CandidateSlate.tsx` (Phase 37) verbatim for
 * the join (`joinCandidates` — pitchLog + `deliberationEvents`
 * advocate-argument rows, imported not reimplemented) and extends it with two
 * more client-side joins on the SAME `charityId`/`candidateId`
 * (`charity-{slugify(name)}`, confirmed identical across `pitchLog`,
 * `verification_records`, and `agentVotes` — 47-RESEARCH §Code Examples):
 *
 *   - `verificationRecords:byRunId` (Phase 46) — reused from
 *     `useWorkspaceState().verificationRecords` (Plan 47-05's centralized
 *     subscription, no new query) — the verification record WITH DATES.
 *   - `charities:listByWorkspace` (Phase 26/39) — one new subscription (not
 *     centralized on the provider) — the prior-coverage warning source.
 *
 * `pitchRows` also come from `useWorkspaceState()`; only the advocate rows
 * (`deliberationEvents:byRunIdAndType`) need a new subscription here, mirroring
 * `CandidateSlate`'s own query for the same data (SIG-01, §37.4(b)).
 *
 * One-active-lead-per-run (47-RESEARCH Pitfall 1 — no lead<->org join key
 * exists): ALL of the run's surviving org options are grouped under the
 * single active lead — the operator-Required lead if one exists, else the
 * Signal Editor's `recommended` lead, else the first lead. This is a safe,
 * honest simplification (exactly one Scout pass per run today), not a
 * workaround.
 *
 * The main concern (`primaryConcern`) renders ALWAYS visible, IN FULL — the
 * SAME never-truncated discipline as `CandidateSlate.tsx:197-208`. No
 * clamping/ellipsis utility class is used anywhere in this file.
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { useWorkspaceState } from '@/app/(dashboard)/issues/_components/WorkspaceStateProvider'
import {
  joinCandidates,
  type PitchLogRow,
  type AdvocateArgumentRow,
} from '../../signal-desk/_components/CandidateSlate'
import type { StoryLead } from './LeadCard'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'

export interface VerificationRecordRow {
  candidateId: string
  candidateName: string
  domainLive: boolean
  registrationId?: string
  registrationVerified: boolean
  pressHits: number
  obscurityVerdict: string
  status: 'pass' | 'fail' | 'unverified'
  killed: boolean
  killReason?: string
  checkedAt: number
}

export interface RegistryCharityRow {
  name: string
  status: string
}

/** Deterministic formatted date — the "verification record WITH DATES" requirement. */
function formatCheckedAt(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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

/** Prior coverage = this charity has previously been featured (Phase 39 registry). */
function findPriorCoverage(
  registry: RegistryCharityRow[],
  charityName: string,
): RegistryCharityRow | undefined {
  const needle = charityName.trim().toLowerCase()
  return registry.find(r => r.status === 'featured' && r.name.trim().toLowerCase() === needle)
}

/** One-active-lead-per-run (47-RESEARCH Pitfall 1): Required > recommended > first. */
export function selectActiveLead(leads: StoryLead[]): StoryLead | undefined {
  return (
    leads.find(l => l.status === 'required') ??
    leads.find(l => l.recommended) ??
    leads[0]
  )
}

export function OrgOptionSlate() {
  const { runId, pitchRows, verificationRecords, storyLeads } = useWorkspaceState()

  const advocateRows = useQuery(
    api.deliberationEvents.byRunIdAndType,
    runId ? { runId, eventType: 'advocate-argument' } : 'skip',
  ) as AdvocateArgumentRow[] | undefined

  const registry = useQuery(api.charities.listByWorkspace, {
    workspace_id: DEFAULT_WORKSPACE_ID,
  }) as RegistryCharityRow[] | undefined

  const activeLead = selectActiveLead((storyLeads ?? []) as unknown as StoryLead[])

  return (
    <section
      aria-label="Organization options"
      className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4"
    >
      <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]">
        Organization options
      </h2>
      <p
        data-testid="org-options-active-lead"
        className="mt-0.5 text-[13px] text-[color:var(--color-ink-soft)]"
      >
        {activeLead ? `Grouped under: ${activeLead.premise}` : 'No active lead yet'}
      </p>

      {pitchRows === undefined || advocateRows === undefined ? (
        <p className="mt-2 text-[13px] text-[color:var(--color-ink-soft)]">Loading…</p>
      ) : pitchRows.length === 0 ? (
        <p className="mt-2 text-[13px] italic text-[color:var(--color-ink-soft)]">
          No organization options yet
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {joinCandidates(pitchRows as PitchLogRow[], advocateRows).map(candidate => {
            const pitchRow = (pitchRows as PitchLogRow[]).find(
              p => p.charityName === candidate.charityName,
            )
            const verification = findVerification(
              (verificationRecords ?? []) as unknown as VerificationRecordRow[],
              pitchRow?.charityId,
              candidate.charityName,
            )
            const priorCoverage = findPriorCoverage(registry ?? [], candidate.charityName)

            return (
              <li
                key={candidate.charityName}
                data-testid={`org-option-${candidate.charityName}`}
                className="border border-[color:var(--color-faint)] bg-white p-3"
              >
                <h3 className="font-[family-name:var(--font-display)] text-[16px] font-semibold text-[color:var(--color-ink)]">
                  {candidate.charityName}
                </h3>

                {/* mechanism / fit — Scout's summary of how this org's work fits the story. */}
                <div className="mt-1">
                  <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
                    Mechanism
                  </span>
                  <p
                    data-testid={`org-mechanism-${candidate.charityName}`}
                    className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
                  >
                    {candidate.scoutSummary}
                  </p>
                </div>

                {/* verification record WITH DATES */}
                {verification ? (
                  <div
                    data-testid={`org-verification-${candidate.charityName}`}
                    className="mt-1.5"
                  >
                    <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
                      Verification
                    </span>
                    <p
                      data-testid={`org-verification-date-${candidate.charityName}`}
                      className="mt-0.5 text-[13px] text-[color:var(--color-ink)]"
                    >
                      Checked {formatCheckedAt(verification.checkedAt)} — domain{' '}
                      {verification.domainLive ? 'live' : 'not live'}, registration{' '}
                      {verification.registrationVerified ? 'verified' : 'unverified'},{' '}
                      {verification.pressHits} press hit
                      {verification.pressHits === 1 ? '' : 's'} ({verification.obscurityVerdict})
                    </p>
                  </div>
                ) : (
                  <p
                    data-testid={`org-verification-missing-${candidate.charityName}`}
                    className="mt-1.5 text-[13px] italic text-[color:var(--color-ink-soft)]"
                  >
                    No verification record yet
                  </p>
                )}

                {/* quick 260719-w6o (F2) — a killed candidate must render AS
                    killed, with its killReason (BriefOrgCard.tsx:93-101
                    pattern). Advisory only: it does not remove the org from
                    the slate. */}
                {verification?.killed && (
                  <p
                    data-testid={`org-killed-${candidate.charityName}`}
                    className="mt-1.5 text-[13px] font-semibold text-[color:var(--color-marigold-text)]"
                  >
                    Verification flagged a concern: {verification.killReason || 'unspecified'}.
                  </p>
                )}

                {/* agent case + confidence */}
                {candidate.advocateScore != null && (
                  <p
                    data-testid={`org-confidence-${candidate.charityName}`}
                    className="mt-1.5 font-[family-name:var(--font-ui)] text-[12px] font-semibold text-[color:var(--color-cobalt)]"
                  >
                    Confidence: {candidate.advocateScore}/10
                  </p>
                )}
                {candidate.advocateArgument && (
                  <p
                    data-testid={`org-agent-case-${candidate.charityName}`}
                    className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
                  >
                    {candidate.advocateArgument}
                  </p>
                )}

                {/* prior-coverage warning */}
                {priorCoverage && (
                  <p
                    data-testid={`org-prior-coverage-${candidate.charityName}`}
                    className="mt-1.5 text-[13px] font-semibold text-[color:var(--color-marigold-text)]"
                  >
                    Prior coverage: this organization has already been featured.
                  </p>
                )}

                {/* main concern — ALWAYS visible, rendered in FULL, never clipped. */}
                <div className="mt-2 border-t border-[color:var(--color-faint)] pt-1.5">
                  <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-vermilion)]">
                    Main concern
                  </span>
                  <p
                    data-testid={`main-concern-${candidate.charityName}`}
                    className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
                  >
                    {verification?.killed
                      ? verification.killReason || candidate.primaryConcern || '—'
                      : candidate.primaryConcern || '—'}
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
