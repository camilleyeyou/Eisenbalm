'use client'
/**
 * Phase 41 (WSP-07, D-11/D-12, Plan 41-07 Task 2) — Stage 3 (Fact Check)
 * first-class placeholder.
 *
 * The real Fact Check stage (Phase 42) does not exist yet — that stage will
 * add affirmative filters, `importance`, and a claim-detail provenance card.
 * This is NOT a blank stub: it composes the SAME read-only `claim_checks`
 * coverage the Review Desk `DecisionRail`'s Verification block already reads
 * (D-13's "checked X/Y / not yet checked / No claims extracted yet" — never
 * blank) into an honest "arrives next" surface, plus a read-only listing of
 * every claim (mirroring `SourceIndex`'s unsourced/sourced-by-section
 * grouping, with the Check/Skip write actions removed — those belong to the
 * real stage, not this interim read-only one; WSP-07 discipline).
 *
 * This component must NEVER assert a verified state the data doesn't back:
 * zero claims -> "No claims extracted yet" (never "verified"/"complete");
 * zero checked -> "not yet checked" (never blank).
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

interface FactCheckPlaceholderProps {
  runId: string
}

/** Minimal shape needed from a live `claim_checks` row (mirrors SourceIndex). */
interface ClaimCheckRow {
  claimIndex: number
  text: string
  status: string
  checkedAt?: number
  claimId?: string
  sourceUrl?: string
  retrievedAt?: number
  sectionName?: string
}

const MICRO_LABEL =
  'font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.09em]'

// Same fixed galley reading order SourceIndex groups by (§35.4/D-14).
const GALLEY_SECTION_ORDER = [
  'originStory',
  'problemStatement',
  'founderBio',
  'caseStudy',
  'bonus',
] as const

const SECTION_LABELS: Record<string, string> = {
  originStory: 'Origin story',
  problemStatement: 'The problem',
  founderBio: 'Founder bio',
  caseStudy: 'Case study',
  bonus: 'Bonus',
}

function formatAgo(ts: number): string {
  const deltaMs = Date.now() - ts
  const minutes = Math.floor(deltaMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function statusLabel(status: string): string {
  if (status === 'checked') return 'Checked'
  if (status === 'skipped') return 'Skipped'
  return 'Pending'
}

export default function FactCheckPlaceholder({ runId }: FactCheckPlaceholderProps) {
  const claims = useQuery(api.claimChecks.listByRunId, { runId }) as
    | ClaimCheckRow[]
    | undefined

  const totalClaims = claims?.length ?? 0
  const done = claims?.filter(c => c.status !== 'pending') ?? []
  const openCount = totalClaims - done.length
  const lastChecked = Math.max(0, ...done.map(c => c.checkedAt ?? 0))

  const unsourced = (claims ?? []).filter(r => !r.claimId)
  const sourced = (claims ?? []).filter(r => !!r.claimId)
  const knownSections = new Set<string>(GALLEY_SECTION_ORDER)
  const sourcedGroups: Array<{ key: string; label: string; rows: ClaimCheckRow[] }> = []
  for (const sectionName of GALLEY_SECTION_ORDER) {
    const group = sourced.filter(r => r.sectionName === sectionName)
    if (group.length > 0) {
      sourcedGroups.push({
        key: sectionName,
        label: SECTION_LABELS[sectionName] ?? sectionName,
        rows: group,
      })
    }
  }
  const otherSourced = sourced.filter(r => !r.sectionName || !knownSections.has(r.sectionName))
  if (otherSourced.length > 0) {
    sourcedGroups.push({ key: 'other', label: 'Other sourced claims', rows: otherSourced })
  }

  function renderRow(row: ClaimCheckRow) {
    return (
      <li
        key={row.claimIndex}
        data-testid={`fact-check-row-${row.claimIndex}`}
        className="border border-[color:var(--color-faint)] bg-white p-2"
      >
        <p className="text-[13px] leading-snug text-[color:var(--color-ink)]">{row.text}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={`${MICRO_LABEL} ${
              row.status === 'checked'
                ? 'text-[color:var(--color-green,#148a52)]'
                : row.status === 'skipped'
                  ? 'text-[color:var(--color-ink-soft)]'
                  : 'text-[color:var(--color-vermilion)]'
            }`}
          >
            {statusLabel(row.status)}
          </span>
          {row.sourceUrl && (
            <a
              href={row.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium text-[color:var(--color-marigold-text)] underline"
            >
              Open source
            </a>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col gap-4 p-6">
      <div className="flex flex-col items-start gap-2 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-6">
        <span
          className="inline-block rounded-[2px] bg-[color:var(--color-marigold)] px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.08em] text-[color:var(--color-ink)]"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          arrives next — Phase 42
        </span>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--color-ink)]">
          Fact Check
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
          The full Fact Check stage — affirmative coverage summary, filters, and a claim-detail
          provenance card — arrives next. Here is what is checked so far.
        </p>
      </div>

      <section
        aria-label="Claim coverage"
        className="border border-[color:var(--color-faint)] bg-white p-4"
      >
        <h2 className={MICRO_LABEL}>Coverage</h2>
        {claims === undefined ? (
          <p className="mt-1 text-[13px] text-[color:var(--color-ink-soft)]">Loading…</p>
        ) : totalClaims === 0 ? (
          <p className="mt-1 text-[13px] italic text-[color:var(--color-ink-soft)]">
            No claims extracted yet
          </p>
        ) : (
          <div className="mt-1 text-[13px] text-[color:var(--color-ink)]">
            <p>
              checked {done.length} of {totalClaims}
              <span className="text-[color:var(--color-ink-soft)]"> · {openCount} unchecked</span>
            </p>
            {lastChecked > 0 ? (
              <p className="text-[color:var(--color-green,#148a52)]">
                last verified {formatAgo(lastChecked)}
              </p>
            ) : (
              <p className="text-[color:var(--color-ink-soft)]">not yet checked</p>
            )}
          </div>
        )}
      </section>

      {totalClaims > 0 && (
        <section aria-label="Claims" className="flex flex-col gap-3">
          {unsourced.length > 0 && (
            <div>
              <h3 className={`${MICRO_LABEL} text-[color:var(--color-vermilion)]`}>Unsourced</h3>
              <ul className="mt-1 flex flex-col gap-1.5">{unsourced.map(renderRow)}</ul>
            </div>
          )}
          {sourcedGroups.map(group => (
            <div key={group.key}>
              <h3 className={`${MICRO_LABEL} text-[color:var(--color-ink-soft)]`}>{group.label}</h3>
              <ul className="mt-1 flex flex-col gap-1.5">{group.rows.map(renderRow)}</ul>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
