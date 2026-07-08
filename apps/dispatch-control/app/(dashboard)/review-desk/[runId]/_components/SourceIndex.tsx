'use client'
/**
 * Phase 35 (PRV-04, Plan 35-06) — the decision rail's source index.
 *
 * Upgrades the Verification block's plain checklist into a source-bound
 * index (D-13): one surface merging the checklist and the source list.
 * Unsourced claims (no `claimId`) pin on top, grouped; sourced claims
 * (`claimId` present) group below by galley section in reading order (D-14),
 * each showing its `sourceUrl`. Every row — sourced or not — carries a
 * check/skip control writing the SAME `claimChecks:setStatus` mutation the
 * galley popover uses (D-11), and a jump link to its galley span when a
 * known `sectionName` is present.
 *
 * D-12: a source existing ≠ verified — checking a claim never revokes
 * sign-offs (setStatus is a plain Convex mutation, not in the FastAPI revoke
 * list; nothing here routes through a pipeline endpoint). The Phase 34
 * facts-cleared prerequisite keeps reading this same `claim_checks` state
 * unchanged.
 *
 * Legacy rows (pre-Phase-35, all five provenance fields absent) degrade
 * honestly: no `claimId` => rendered in the Unsourced group; no
 * `sectionName` => no jump link. Never hidden, never crashes (D-03).
 */
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

interface SourceIndexProps {
  runId: string
}

/** Minimal shape needed from a live `claim_checks` row (§35.4). */
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

// D-14: sourced claims group by section in this fixed galley reading order —
// the same order the galley itself renders (Galley.tsx LONG_READ_SECTIONS +
// bonus). Mirrors the galley's `galley-<id>` DOM anchors exactly.
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

/**
 * Maps a claim_checks `sectionName` to its galley DOM anchor id — identical
 * vocabulary to `Galley.tsx`/`GallerySection.tsx`'s `galley-${sectionId}`.
 * Unknown/absent `sectionName` (legacy rows, non-prose sections) => no
 * anchor, never a guessed target (D-14 jump-link honesty).
 */
function galleyAnchorId(sectionName: string | undefined): string | null {
  if (!sectionName || !(sectionName in SECTION_LABELS)) return null
  return `galley-${sectionName}`
}

function statusLabel(status: string): string {
  if (status === 'checked') return 'Checked'
  if (status === 'skipped') return 'Skipped'
  return 'Pending'
}

export default function SourceIndex({ runId }: SourceIndexProps) {
  const rows =
    (useQuery(api.claimChecks.listByRunId, { runId }) as ClaimCheckRow[] | undefined) ?? []
  const setStatus = useMutation(api.claimChecks.setStatus)

  async function handleSetStatus(claimIndex: number, status: 'checked' | 'skipped') {
    await setStatus({ runId, claimIndex, status })
  }

  function handleJump(sectionName: string | undefined) {
    const anchor = galleyAnchorId(sectionName)
    if (!anchor) return
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (rows.length === 0) return null

  // claimId present => sourced (marigold); absent => unsourced (rust) — the
  // §35.4 invariant. Legacy rows (no claimId) land in unsourced honestly.
  const unsourced = rows.filter(r => !r.claimId)
  const sourced = rows.filter(r => !!r.claimId)

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
  // Sourced rows with an unrecognized/absent sectionName never disappear —
  // they land in a trailing group rather than being silently dropped.
  const otherSourced = sourced.filter(
    r => !r.sectionName || !knownSections.has(r.sectionName),
  )
  if (otherSourced.length > 0) {
    sourcedGroups.push({ key: 'other', label: 'Other sourced claims', rows: otherSourced })
  }

  function renderRow(row: ClaimCheckRow) {
    const anchor = galleyAnchorId(row.sectionName)
    return (
      <li
        key={row.claimIndex}
        data-testid={`source-index-row-${row.claimIndex}`}
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
          {anchor && (
            <button
              type="button"
              aria-label={`Jump to claim ${row.claimIndex}`}
              onClick={() => handleJump(row.sectionName)}
              className="min-h-[44px] px-1 text-[12px] font-medium text-[color:var(--color-cobalt,#253ad4)] hover:underline"
            >
              Jump to section
            </button>
          )}
          <button
            type="button"
            aria-label={`Check claim ${row.claimIndex}`}
            disabled={row.status === 'checked'}
            onClick={() => handleSetStatus(row.claimIndex, 'checked')}
            className="min-h-[44px] min-w-[44px] border border-[color:var(--color-faint)] bg-white px-2 text-[12px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Check
          </button>
          <button
            type="button"
            aria-label={`Skip claim ${row.claimIndex}`}
            disabled={row.status === 'skipped'}
            onClick={() => handleSetStatus(row.claimIndex, 'skipped')}
            className="min-h-[44px] min-w-[44px] border border-[color:var(--color-faint)] bg-white px-2 text-[12px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Skip
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      {unsourced.length > 0 && (
        <div>
          <h4 className={`${MICRO_LABEL} text-[color:var(--color-vermilion)]`}>Unsourced</h4>
          <ul className="mt-1 flex flex-col gap-1.5">{unsourced.map(renderRow)}</ul>
        </div>
      )}
      {sourcedGroups.map(group => (
        <div key={group.key}>
          <h4 className={`${MICRO_LABEL} text-[color:var(--color-ink-soft)]`}>{group.label}</h4>
          <ul className="mt-1 flex flex-col gap-1.5">{group.rows.map(renderRow)}</ul>
        </div>
      ))}
    </div>
  )
}
