'use client'
/**
 * Phase 48 Plan 48-06 (ENT-01/ENT-04, D-11 — 48-RESEARCH Pattern 4 /
 * Open Question 3) — BriefOrgCard: the brief-mode single-org card.
 *
 * A brief run seeds `candidates=[human org]`, so `verify_candidates`
 * persists EXACTLY ONE `VerificationRecord` — this card renders that single
 * record instead of `OrgOptionSlate`'s Scout/Advocate/pitchLog-joined slate
 * (which stays permanently empty for a brief run, RESEARCH Pattern 4). A
 * wholly separate component (not a branch inside `OrgOptionSlate`) per
 * 48-RESEARCH Open Question 3 — `OrgOptionSlate`'s `joinCandidates` logic is
 * Scout/pitchLog-shaped and does not apply here.
 *
 * D-11 (advisory verification): the record's concerns are surfaced
 * PROMINENTLY and NEVER TRUNCATED (the Phase 37/47 discipline, reused
 * verbatim from `OrgOptionSlate`'s "Main concern" `border-t` treatment) but
 * a killed/failed check never removes the org or halts the run — the
 * operator sees the concern and proceeds knowingly (or uses Hold issue).
 *
 * `formatCheckedAt` and the `VerificationRecordRow` shape are copied from
 * `OrgOptionSlate.tsx` (not imported — `formatCheckedAt` is a private helper
 * there; `VerificationRecordRow` IS exported and imported directly below).
 */
import { useWorkspaceState } from '@/app/(dashboard)/issues/_components/WorkspaceStateProvider'
import type { VerificationRecordRow } from './OrgOptionSlate'

/** Deterministic formatted date — copied from OrgOptionSlate.tsx verbatim. */
function formatCheckedAt(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function BriefOrgCard() {
  const { verificationRecords } = useWorkspaceState()

  return (
    <section
      aria-label="Organization"
      className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4"
    >
      <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]">
        Organization
      </h2>

      {verificationRecords === undefined ? (
        <p
          data-testid="brief-org-loading"
          className="mt-2 text-[13px] text-[color:var(--color-ink-soft)]"
        >
          Loading the organization you supplied…
        </p>
      ) : verificationRecords.length === 0 ? (
        <p
          data-testid="brief-org-verifying"
          className="mt-2 text-[13px] italic text-[color:var(--color-ink-soft)]"
        >
          Verifying the organization you supplied…
        </p>
      ) : (
        (() => {
          const record = verificationRecords[0] as unknown as VerificationRecordRow
          return (
            <div
              data-testid={`brief-org-${record.candidateName}`}
              className="mt-2 border border-[color:var(--color-faint)] bg-white p-3"
            >
              <h3 className="font-[family-name:var(--font-display)] text-[16px] font-semibold text-[color:var(--color-ink)]">
                {record.candidateName}
              </h3>

              {/* verification record WITH DATES — copies OrgOptionSlate's exact wording. */}
              <div data-testid={`brief-org-verification-${record.candidateName}`} className="mt-1.5">
                <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
                  Verification
                </span>
                <p
                  data-testid={`brief-org-verification-date-${record.candidateName}`}
                  className="mt-0.5 text-[13px] text-[color:var(--color-ink)]"
                >
                  Checked {formatCheckedAt(record.checkedAt)} — domain{' '}
                  {record.domainLive ? 'live' : 'not live'}, registration{' '}
                  {record.registrationVerified ? 'verified' : 'unverified'}, {record.pressHits}{' '}
                  press hit
                  {record.pressHits === 1 ? '' : 's'} ({record.obscurityVerdict})
                </p>
              </div>

              {/* D-11: advisory only — surfaced prominently, never removes the org
                  or halts the run. */}
              {record.killed && (
                <p
                  data-testid={`brief-org-killed-${record.candidateName}`}
                  className="mt-1.5 text-[13px] font-semibold text-[color:var(--color-marigold-text)]"
                >
                  Verification flagged a concern: {record.killReason || 'unspecified'}. The run
                  continues — you supplied this organization directly.
                </p>
              )}

              {/* Main concern — ALWAYS visible, rendered in FULL, never clipped
                  (Phase 37/47 discipline, reused verbatim from OrgOptionSlate). */}
              <div className="mt-2 border-t border-[color:var(--color-faint)] pt-1.5">
                <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-vermilion)]">
                  Main concern
                </span>
                <p
                  data-testid={`brief-org-main-concern-${record.candidateName}`}
                  className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
                >
                  {record.killed
                    ? record.killReason || '—'
                    : `Verification: ${record.status}`}
                </p>
              </div>
            </div>
          )
        })()
      )}
    </section>
  )
}
