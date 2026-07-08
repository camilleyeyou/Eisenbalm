'use client'
/**
 * Phase 33 (GLY-04, Plan 33-05 Task 1) — the blockers-first decision rail.
 *
 * The design's 336px right column (bg `--color-rail` #f1f0ea) beside the
 * galley: the operator's "is anything unaccounted for" answer and the single
 * place the publish decision happens. Section order per the design (D-17):
 *
 *   1. Headline count line ("N blocker(s) to clear · M warning(s)")
 *   2. Blocking items — one jump-link row per OPEN error-severity finding
 *      (isOpenFinding, Pitfall 9 — same predicate as the galley/chips)
 *   3. Editor's memo — editor-final deliberationEvents payload; the memo key
 *      is `notes` (§33.6 — NOT editor_final_notes)
 *   4. Hook card — the run's selected pitch (D-12; Phase 37 upgrades in place)
 *   5. Verification — claims progress with an affirmative timestamp state
 *      (D-13: "checked Nm ago" / "not yet checked" / "No claims extracted
 *      yet" — never blank)
 *   6. Actions — Publish (gated, D-14 client half; the server 409 shipped in
 *      33-03), Hold, Re-run section ▾, Transcript (D-15)
 *   7. ResolvedFindingsList — the collapsed D-04 reopen surface (Task 2)
 *
 * Publish is disabled with a visible reason while blockers remain; if the
 * server still 409s `open_error_findings`, the message is surfaced
 * (belt-and-suspenders with the D-14 server gate).
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { publishIssue, rejectIssue, ReviewApiError } from '@/lib/reviewClient'
import { rerollAgent } from '@/lib/pipelineControlClient'
import { isOpenFinding } from '@/lib/galley/findingState'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import ResolvedFindingsList from './ResolvedFindingsList'

interface DecisionRailProps {
  runId: string
}

/** Minimal shape needed from a live `qaCorrections` row (matches page.tsx). */
interface QaCorrectionRow {
  _id: string
  findingId?: string
  sectionName: string
  severity: 'info' | 'warning' | 'error'
  reason: string
  accepted?: boolean
  resolution?: 'accepted' | 'dismissed'
}

interface ClaimCheckRow {
  claimIndex: number
  status: string
  checkedAt?: number
}

/**
 * Maps a galley section id to its DOM anchor — replicates page.tsx's
 * galleyAnchorFor (private there): `theme` has no galley anchor and the
 * deliberation section renders under `galley-deliberation`.
 */
function galleyAnchorFor(sectionId: string): string | null {
  if (sectionId === 'theme') return null
  if (sectionId === 'deliberation-conversation') return 'galley-deliberation'
  return `galley-${sectionId}`
}

/** The 7 re-rollable section-writer agent keys (API_CONTRACTS §3B). */
const RERUN_AGENT_KEYS = [
  'origin_story',
  'problem',
  'founder_bio',
  'case_study',
  'game',
  'bonus',
  'design',
] as const

const SECTION_LABELS: Record<string, string> = {
  origin_story: 'Origin story',
  problem: 'Problem',
  founder_bio: 'Founder bio',
  case_study: 'Case study',
  game: 'Game',
  bonus: 'Bonus',
  design: 'Design',
}

function formatAgo(ts: number): string {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60_000))
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const MICRO_LABEL =
  'font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]'

export default function DecisionRail({ runId }: DecisionRailProps) {
  const { getToken } = useAuth()

  // ── Data ──────────────────────────────────────────────────────────────────
  const rawFindings =
    (useQuery(api.qaCorrections.byRunId, { runId }) as QaCorrectionRow[] | undefined) ?? []
  // Pitfall 9: the ONE shared open-finding predicate — the rail must agree
  // with the galley and chip counts on what "open" means.
  const openFindings = rawFindings.filter(isOpenFinding)
  const blockers = openFindings.filter(f => f.severity === 'error')
  const warnings = openFindings.filter(f => f.severity === 'warning').length
  const infos = openFindings.filter(f => f.severity === 'info').length

  // Editor memo: the editor-final event stream (payload is a JSON STRING; the
  // memo key is `notes` — §33.6). Take the latest row if several exist.
  const editorFinalRows = useQuery(api.deliberationEvents.byRunIdAndType, {
    runId,
    eventType: 'editor-final',
  }) as Array<{ payload: string }> | undefined
  let memo: string | null = null
  const lastEditorFinal =
    editorFinalRows && editorFinalRows.length > 0
      ? editorFinalRows[editorFinalRows.length - 1]
      : null
  if (lastEditorFinal) {
    try {
      const parsed = JSON.parse(lastEditorFinal.payload) as { notes?: unknown }
      if (typeof parsed?.notes === 'string' && parsed.notes.trim().length > 0) {
        memo = parsed.notes
      }
    } catch {
      // Malformed payload — fall through to the honest fallback (never crash).
    }
  }

  // Hook card (D-12): the run's selected pitch.
  const pitch = useQuery(api.pitchLog.selectedByRunId, { runId }) as
    | { charityName: string; scoutSummary: string }
    | null
    | undefined

  // Verification (D-13).
  const claims = useQuery(api.claimChecks.listByRunId, { runId }) as
    | ClaimCheckRow[]
    | undefined
  const done = claims?.filter(c => c.status !== 'pending') ?? []
  const totalClaims = claims?.length ?? 0
  const lastChecked = Math.max(0, ...done.map(c => c.checkedAt ?? 0))

  // ── Actions state ─────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [rerunKey, setRerunKey] = useState<string>(RERUN_AGENT_KEYS[0])

  async function handlePublish() {
    setBusy(true)
    setActionMessage(null)
    try {
      const token = await getToken()
      await publishIssue(token, runId)
      setActionMessage('Published.')
    } catch (e) {
      setActionMessage(
        e instanceof ReviewApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Publish failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleHold() {
    setBusy(true)
    setActionMessage(null)
    try {
      const token = await getToken()
      await rejectIssue(token, runId)
      setActionMessage('Run held — it stays awaiting review.')
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Hold failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRerun() {
    setBusy(true)
    setActionMessage(null)
    try {
      const token = await getToken()
      await rerollAgent(runId, rerunKey, token)
      setActionMessage(`Re-run queued for ${SECTION_LABELS[rerunKey] ?? rerunKey}.`)
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Re-run failed.')
    } finally {
      setBusy(false)
    }
  }

  function handleTranscript() {
    document
      .getElementById('galley-deliberation')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function jumpToFinding(finding: QaCorrectionRow) {
    const galleyId = qaSectionToGalleyId(finding.sectionName)
    if (!galleyId) return
    const anchor = galleyAnchorFor(galleyId)
    if (!anchor) return
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const blockerReason = `${blockers.length} blocker${blockers.length === 1 ? '' : 's'} to clear`

  return (
    <aside
      aria-label="Decision rail"
      className="flex w-full flex-col gap-5 border border-[color:var(--color-faint)] bg-[color:var(--color-rail)] p-4"
    >
      {/* 1 — Headline count line (D-17) */}
      <p className="font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink)]">
        {blockerReason} · {warnings} warning{warnings === 1 ? '' : 's'}
        {infos > 0 && (
          <span className="font-normal text-[color:var(--color-faint)]"> · {infos} info</span>
        )}
      </p>

      {/* 2 — Blocking items checklist (D-10, D-11b) */}
      <section aria-label="Blocking items">
        <h3 className={MICRO_LABEL}>Blocking items</h3>
        {blockers.length === 0 ? (
          <p className="mt-1 text-[13px] text-[color:var(--color-green,#148a52)]">
            No blockers — clear to publish.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {blockers.map(finding => (
              <li key={finding._id}>
                <button
                  type="button"
                  onClick={() => jumpToFinding(finding)}
                  className="min-h-[44px] w-full border-l-2 border-[color:var(--color-vermilion)] bg-white px-2 py-1.5 text-left text-[13px] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
                >
                  <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-vermilion)]">
                    {finding.sectionName}
                  </span>{' '}
                  {finding.reason.length > 90
                    ? `${finding.reason.slice(0, 90)}…`
                    : finding.reason}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3 — Editor's memo (D-16, §33.6 key `notes`) */}
      <section aria-label="Editor's memo">
        <h3 className={MICRO_LABEL}>Editor&rsquo;s memo</h3>
        {memo ? (
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[color:var(--color-ink)]">
            {memo}
          </p>
        ) : (
          <p className="mt-1 text-[13px] italic text-[color:var(--color-ink-soft)]">
            No editor memo for this run
          </p>
        )}
      </section>

      {/* 4 — Hook card (D-12: selected pitch stands in until Phase 37) */}
      <section aria-label="Hook">
        <h3 className={MICRO_LABEL}>Hook</h3>
        {pitch === undefined ? (
          <p className="mt-1 text-[13px] text-[color:var(--color-ink-soft)]">Loading…</p>
        ) : pitch === null ? (
          <p className="mt-1 text-[13px] italic text-[color:var(--color-ink-soft)]">
            No charity selected yet
          </p>
        ) : (
          <div className="mt-1 border border-[color:var(--color-faint)] bg-white p-2">
            <p className="font-[family-name:var(--font-display,inherit)] text-[15px] font-semibold text-[color:var(--color-ink)]">
              {pitch.charityName}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-[color:var(--color-ink-soft)]">
              {pitch.scoutSummary}
            </p>
          </div>
        )}
      </section>

      {/* 5 — Verification block (D-13 — affirmative state, never blank) */}
      <section aria-label="Verification">
        <h3 className={MICRO_LABEL}>Verification</h3>
        {claims === undefined ? (
          <p className="mt-1 text-[13px] text-[color:var(--color-ink-soft)]">Loading…</p>
        ) : totalClaims === 0 ? (
          <p className="mt-1 text-[13px] italic text-[color:var(--color-ink-soft)]">
            No claims extracted yet
          </p>
        ) : (
          <div className="mt-1 text-[13px] text-[color:var(--color-ink)]">
            <p>
              {done.length}/{totalClaims} claims checked
              <span className="text-[color:var(--color-ink-soft)]">
                {' '}
                · {openFindings.length} open
              </span>
            </p>
            {lastChecked > 0 ? (
              <p className="text-[color:var(--color-green,#148a52)]">
                checked {formatAgo(lastChecked)}
              </p>
            ) : (
              <p className="text-[color:var(--color-ink-soft)]">not yet checked</p>
            )}
          </div>
        )}
      </section>

      {/* 6 — Actions (D-15: all four wired to existing backends) */}
      <section aria-label="Actions" className="flex flex-col gap-2">
        <h3 className={MICRO_LABEL}>Actions</h3>
        <button
          type="button"
          disabled={blockers.length > 0 || busy}
          onClick={handlePublish}
          className="min-h-[44px] w-full bg-[color:var(--color-ink)] px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-paper,#f4f2ec)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Publish
        </button>
        {blockers.length > 0 && (
          <p className="text-[11px] text-[color:var(--color-vermilion)]">{blockerReason}</p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={handleHold}
          className="min-h-[44px] w-full border border-[color:var(--color-faint)] bg-white px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] font-medium uppercase tracking-[.06em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:opacity-40"
        >
          Hold
        </button>
        <div className="flex items-stretch gap-1">
          <label className="sr-only" htmlFor={`rerun-section-${runId}`}>
            Section to re-run
          </label>
          <select
            id={`rerun-section-${runId}`}
            value={rerunKey}
            onChange={e => setRerunKey(e.target.value)}
            className="min-h-[44px] flex-1 border border-[color:var(--color-faint)] bg-white px-2 font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-ink)]"
          >
            {RERUN_AGENT_KEYS.map(key => (
              <option key={key} value={key}>
                {SECTION_LABELS[key] ?? key}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={handleRerun}
            className="min-h-[44px] border border-[color:var(--color-faint)] bg-white px-3 font-[family-name:var(--font-ui)] text-[12px] font-medium uppercase tracking-[.06em] text-[color:var(--color-cobalt,#253ad4)] hover:bg-[color:var(--color-card-alt)] disabled:opacity-40"
          >
            Re-run
          </button>
        </div>
        <button
          type="button"
          onClick={handleTranscript}
          className="min-h-[44px] w-full border border-[color:var(--color-faint)] bg-white px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] font-medium uppercase tracking-[.06em] text-[color:var(--color-cobalt,#253ad4)] hover:bg-[color:var(--color-card-alt)]"
        >
          Transcript
        </button>
        {actionMessage && (
          <p role="status" className="text-[12px] text-[color:var(--color-ink)]">
            {actionMessage}
          </p>
        )}
      </section>

      {/* 7 — Resolved findings (D-04: the only surface where they reappear) */}
      <ResolvedFindingsList runId={runId} />
    </aside>
  )
}
