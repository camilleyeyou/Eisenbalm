'use client'
/**
 * Phase 33 (GLY-04, Plan 33-05 Task 1) — the blockers-first decision rail.
 * Phase 41 (WSP-05/WSP-06, Plan 41-09) — Stage 5 (Approval) IS this rail;
 * see the updated section order and the publish-preview interstitial below.
 *
 * Mounted full-width as the Workspace's Stage 5 canvas (previously the
 * design's 336px right column beside the galley): the operator's "is
 * anything unaccounted for" answer and the single place the publish
 * decision happens. Section order (D-14/D-17, blockers-first, WSP-05
 * "blockers -> readiness board -> agent recommendation"):
 *
 *   1. Headline count line ("N blocker(s) to clear · M warning(s)")
 *   2. Blocking items — one jump-link row per OPEN error-severity finding
 *      (isOpenFinding, Pitfall 9 — same predicate as the galley/chips)
 *   3. Readiness board (WSP-05, net-new) — a scannable label+state summary:
 *      Fact check / Voice / Hook & peg / Organization verification (not
 *      tracked yet this phase) / Open decisions. Never blank, never
 *      color-alone.
 *   4. Agent editor's recommendation — editor-final deliberationEvents
 *      payload; the memo key is `notes` (§33.6 — NOT editor_final_notes).
 *      Relabeled from "Editor's memo" (D-16/SC-4 — "editor" unqualified is
 *      reserved for the human; this is explicitly the agent's judgment).
 *   5. Hook card — the run's selected pitch (D-12; Phase 37 upgrades in place)
 *   6. Verification — claims progress with an affirmative timestamp state
 *      (D-13: "checked Nm ago" / "not yet checked" / "No claims extracted
 *      yet" — never blank), plus the Phase 35 (PRV-04) source index:
 *      unsourced claims pinned on top, sourced claims grouped by galley
 *      section below — see `SourceIndex.tsx`
 *   7. Actions — Publish (gated, D-14 client half + D-15 `held` term; the
 *      server 409 shipped in 33-03), Hold, Re-run section ▾, Transcript
 *   8. ResolvedFindingsList — the collapsed D-04 reopen surface (Task 2)
 *
 * Publish is disabled with a visible reason while blockers remain, either
 * sign-off is missing, or the issue is held (D-15); the unlock condition is
 * also written out next to the control ("Unlocks when: ..."). If the
 * server still 409s `open_error_findings`, the message is surfaced
 * (belt-and-suspenders with the D-14 server gate).
 *
 * WSP-06 (D-15): clicking Publish (when enabled) opens `PublishPreviewDialog`
 * — an exact preview (destination/title/time/consequences) + one
 * confirmation click — rather than calling `handlePublish` directly. There
 * is NO typed-confirmation step anywhere in this flow (41-RESEARCH Pitfall 1
 * — this is net-new UI, not a removal); the dialog's confirm calls the SAME
 * unchanged `handlePublish`/`publishIssue(token, runId)`.
 *
 * Phase 36 (§36.3/§36.7, Plan 36-04 Task 4): the blockers/warnings/infos
 * counts, the blocking-items jump-link list, and the "Facts cleared" gate
 * are all further scoped to `FACTUAL_AXES` (a finding whose `axis` is
 * `undefined` still counts as factual, per §36.3) — this mirrors 36-02's
 * server-side `facts-cleared` narrowing so a voice/machine-tell error can
 * never block or clutter this rail; it belongs to Voice Pass's own
 * "Sounds human" surface instead.
 *
 * quick 260722-tv1: this rail is mounted as the Approval stage, which never
 * mounts a galley — `handleTranscript`/`jumpToFinding` used to silently
 * no-op if invoked here without a Draft-stage galley already in the DOM.
 * Both now fall back to routing to `issueDraftHref(issueNumber)#anchor` when
 * the anchor element is absent AND `issueNumber` is known (legacy standalone
 * `/review-desk/[runId]` mounts, where `issueNumber` is undefined, keep the
 * old attempt-scroll-only behavior). `issueNumber` is also now threaded down
 * to the mounted `SourceIndex` so its own jump links get the same fallback.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { publishIssue, rejectIssue, ReviewApiError } from '@/lib/reviewClient'
import { rerollAgent } from '@/lib/pipelineControlClient'
import { recordSignOff, SignOffApiError, type SignOffKind } from '@/lib/signOffClient'
import { isOpenFinding } from '@/lib/galley/findingState'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import { FACTUAL_AXES } from '@/lib/galley/axisPartition'
import { issueDraftHref } from '@/lib/issueRouteResolver'
// Phase 44 Plan 44-08 (INS-01, §44.6) — the single shared inspector opener.
import { useInspector } from '@/components/inspector/InspectorProvider'
import ResolvedFindingsList from './ResolvedFindingsList'
import SourceIndex from './SourceIndex'
import PublishPreviewDialog from './PublishPreviewDialog'
import SchedulePublishDialog from './SchedulePublishDialog'
import { useRole } from '@/lib/role'
import { LockedControl } from '@/components/LockedControl'
import HelpTip from '@/components/ui/HelpTip'
import { HELP_COPY } from '@/components/help/helpCopy'
import { SkeletonLine } from '@/components/ui/Skeleton'

interface DecisionRailProps {
  runId: string
  /**
   * Phase 41 (Plan 41-09, D-13) — set when this rail is mounted as the
   * Workspace's Stage 5 (Approval) canvas. Used only to compose the
   * publish-preview title ("Issue {n} — {charityName}"). Optional so the
   * component still works standalone (legacy `/review-desk/[runId]` route,
   * tests) without an issue number.
   */
  issueNumber?: number
  /**
   * Phase 41 (Plan 41-09, D-15) — the issue's held state, read by the caller
   * from `useWorkspaceState()` (never re-queried here — Pitfall 3). When
   * `true`, Publish is additionally disabled regardless of blockers/sign-offs.
   */
  held?: boolean
}

/** Minimal shape needed from a live `qaCorrections` row (matches page.tsx). */
interface QaCorrectionRow {
  _id: string
  findingId?: string
  sectionName: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
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

export default function DecisionRail({ runId, issueNumber, held }: DecisionRailProps) {
  const { getToken } = useAuth()
  const router = useRouter()
  // Phase 44 Plan 44-08 (INS-01, §44.6) — the single shared inspector
  // opener, mounted once at the (dashboard) root layout.
  const { openInspector } = useInspector()
  // ROL-03 (D-09): presentation-only client hint — the server
  // `_require_editor` dependency (Plan 49-03) is the authoritative gate.
  const isLocked = useRole() !== 'Editor-in-chief'

  // ── Data ──────────────────────────────────────────────────────────────────
  const rawFindings =
    (useQuery(api.qaCorrections.byRunId, { runId }) as QaCorrectionRow[] | undefined) ?? []
  // Pitfall 9: the ONE shared open-finding predicate — the rail must agree
  // with the galley and chip counts on what "open" means.
  const openFindings = rawFindings.filter(isOpenFinding)
  // Phase 36 (§36.3/§36.7): this factual rail only ever blocks/counts
  // FACTUAL_AXES findings — undefined axis = factual (legacy rows still
  // block, per §36.3's conservative default). Voice/machine-tell errors
  // belong to Voice Pass's "Sounds human" gate, never this one.
  const factualOpen = openFindings.filter(f => f.axis === undefined || FACTUAL_AXES.has(f.axis))
  const blockers = factualOpen.filter(f => f.severity === 'error')
  const warnings = factualOpen.filter(f => f.severity === 'warning').length
  const infos = factualOpen.filter(f => f.severity === 'info').length

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

  // Sign-offs (D-01/D-05/D-06, §34.2 live subscription) — affirmative state,
  // never blank. A kind absent from `active` = not signed (or revoked).
  const active = useQuery(api.signOffs.activeByRunId, { runId }) as
    | Record<SignOffKind, { actorId: string; signedAt: number }>
    | undefined
  const factsActive = !!active?.['facts-cleared']
  const humanActive = !!active?.['sounds-human']

  // ── Actions state ─────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [rerunKey, setRerunKey] = useState<string>(RERUN_AGENT_KEYS[0])
  const [signOffBusy, setSignOffBusy] = useState<SignOffKind | null>(null)
  // WSP-06 (D-15): the exact-preview interstitial — Publish opens this
  // instead of calling handlePublish directly; its confirm calls the SAME
  // unchanged handlePublish below.
  const [showPreview, setShowPreview] = useState(false)
  // finish-phase-34-retirement Task 2 — ported schedule-for-later dialog,
  // gated identically to Publish (same publishDisabled derivation below).
  const [showSchedule, setShowSchedule] = useState(false)

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

  async function handleSignOff(kind: SignOffKind) {
    setSignOffBusy(kind)
    setActionMessage(null)
    try {
      const token = await getToken()
      await recordSignOff(token, runId, kind)
      setActionMessage(
        kind === 'facts-cleared' ? 'Facts cleared.' : 'Sounds human — signed.',
      )
    } catch (e) {
      setActionMessage(
        e instanceof SignOffApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Sign-off failed.',
      )
    } finally {
      setSignOffBusy(null)
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
    const anchor = 'galley-deliberation'
    const el = document.getElementById(anchor)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (issueNumber != null) {
      router.push(issueDraftHref(issueNumber) + '#' + anchor)
    }
  }

  function jumpToFinding(finding: QaCorrectionRow) {
    const galleyId = qaSectionToGalleyId(finding.sectionName)
    if (!galleyId) return
    const anchor = galleyAnchorFor(galleyId)
    if (!anchor) return
    const el = document.getElementById(anchor)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (issueNumber != null) {
      router.push(issueDraftHref(issueNumber) + '#' + anchor)
    }
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

      {/* 2 — Must fix items checklist (D-10, D-11b) */}
      <section aria-label="Must fix items">
        <h3 className={MICRO_LABEL}>Must fix items</h3>
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

      {/* 3 — Readiness board (WSP-05, net-new): a scannable label+state
          summary rendered BEFORE the recommendation, per D-14's
          blockers -> readiness board -> recommendation order. Every row is
          label + state, never blank, never color-alone; a signal with no
          data source this phase (organization verification) still renders
          an explicit "Not tracked yet" — never a blank or a fake green. */}
      <section aria-label="Readiness board">
        <div className="flex items-center gap-1.5">
          <h3 className={MICRO_LABEL}>Readiness board</h3>
          <HelpTip text={HELP_COPY.approval.twoSignOff} label="Explain publish readiness" />
        </div>
        <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[13px] text-[color:var(--color-ink)]">
          <dt className="text-[color:var(--color-ink-soft)]">Fact check</dt>
          <dd>
            {claims === undefined
              ? 'Loading…'
              : totalClaims === 0
                ? 'No claims yet'
                : `${done.length}/${totalClaims} checked`}
          </dd>
          <dt className="text-[color:var(--color-ink-soft)]">Voice</dt>
          <dd className={humanActive ? 'text-[color:var(--color-green,#148a52)]' : undefined}>
            {humanActive ? 'Sounds human — signed' : 'Not signed yet'}
          </dd>
          <dt className="text-[color:var(--color-ink-soft)]">Hook &amp; peg</dt>
          <dd>
            {pitch === undefined
              ? 'Loading…'
              : pitch === null
                ? 'None selected yet'
                : 'Selected'}
          </dd>
          <dt className="text-[color:var(--color-ink-soft)]">Organization verification</dt>
          <dd className="italic text-[color:var(--color-ink-soft)]">Not tracked yet</dd>
          <dt className="text-[color:var(--color-ink-soft)]">Open decisions</dt>
          <dd>
            {blockers.length} blocker{blockers.length === 1 ? '' : 's'}
          </dd>
        </dl>
      </section>

      {/* 4 — Agent editor's recommendation (D-16/SC-4, §33.6 key `notes`) —
          relabeled from "Editor's memo": same editor-final data source, but
          explicitly labeled as the AGENT's judgment. "Editor" unqualified
          stays reserved for the human. */}
      <section aria-label="Agent editor's recommendation">
        <h3 className={MICRO_LABEL}>Agent editor&rsquo;s recommendation</h3>
        {memo ? (
          <>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[color:var(--color-ink)]">
              {memo}
            </p>
            {/* Phase 44 Plan 44-08 (INS-01) — resolves to editor_final
                (§44.1: `rec` locator is always ''); only rendered when a
                recommendation exists. */}
            <button
              type="button"
              onClick={() => openInspector({ type: 'rec', runId, locator: '' })}
              className="mt-2 min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
            >
              Inspect how this was made
            </button>
          </>
        ) : (
          <p className="mt-1 text-[13px] italic text-[color:var(--color-ink-soft)]">
            No agent editor&rsquo;s recommendation for this run
          </p>
        )}
      </section>

      {/* 5 — Hook card (D-12: selected pitch stands in until Phase 37) */}
      <section aria-label="Hook">
        <h3 className={MICRO_LABEL}>Hook</h3>
        {pitch === undefined ? (
          <SkeletonLine className="mt-1 h-4 w-40" />
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

      {/* 6 — Verification block (D-13 — affirmative state, never blank) */}
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
        {/* Phase 35 (PRV-04, D-12/D-13/D-14) — the source index: unsourced
            claims pinned on top, sourced claims grouped by galley section
            below, each with check/skip + jump link. Reads/writes the SAME
            claim_checks table this section's summary above already reads;
            the facts-cleared gate contract is untouched. */}
        <SourceIndex runId={runId} issueNumber={issueNumber} />
      </section>

      {/* 6b — Sign-offs (Phase 34, D-01/D-05/D-06): two independent greens,
          both required to publish (PUB-01). Affirmative state, never blank. */}
      <section aria-label="Sign-offs">
        <h3 className={MICRO_LABEL}>Sign-offs</h3>
        <div className="mt-1 flex flex-col gap-2">
          {factsActive ? (
            <p className="text-[13px] text-[color:var(--color-green,#148a52)]">
              Facts cleared — signed {formatAgo(active!['facts-cleared'].signedAt)}
            </p>
          ) : (
            <button
              type="button"
              disabled={blockers.length > 0 || signOffBusy !== null}
              onClick={() => handleSignOff('facts-cleared')}
              className="min-h-[44px] w-full border border-[color:var(--color-faint)] bg-white px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] font-medium uppercase tracking-[.06em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sign: Facts cleared
            </button>
          )}
          {humanActive ? (
            <p className="text-[13px] text-[color:var(--color-green,#148a52)]">
              Sounds human — signed {formatAgo(active!['sounds-human'].signedAt)}
            </p>
          ) : (
            <button
              type="button"
              disabled={signOffBusy !== null}
              onClick={() => handleSignOff('sounds-human')}
              className="min-h-[44px] w-full border border-[color:var(--color-faint)] bg-white px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] font-medium uppercase tracking-[.06em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sign: Sounds human
            </button>
          )}
        </div>
      </section>

      {/* 7 — Actions (D-15: all four wired to existing backends) */}
      <section aria-label="Actions" className="flex flex-col gap-2">
        <h3 className={MICRO_LABEL}>Actions</h3>
        {(() => {
          const publishDisabled =
            blockers.length > 0 || !factsActive || !humanActive || !!held || busy
          return (
            <>
              <LockedControl
                isLocked={isLocked}
                lockedLabel="Collaborators can review and comment, not publish."
              >
                <button
                  type="button"
                  disabled={publishDisabled}
                  onClick={() => setShowPreview(true)}
                  className="min-h-[44px] w-full bg-[color:var(--color-ink)] px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-paper,#f4f2ec)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Publish
                </button>
              </LockedControl>
              <p className="mt-0.5 text-[11px] text-[color:var(--color-ink-soft)]">
                {HELP_COPY.approval.publish}
              </p>
              {blockers.length > 0 ? (
                <p className="text-[11px] text-[color:var(--color-vermilion)]">{blockerReason}</p>
              ) : (!factsActive || !humanActive) ? (
                <p className="text-[11px] text-[color:var(--color-vermilion)]">
                  Both sign-offs required to publish.
                </p>
              ) : held ? (
                <p className="text-[11px] text-[color:var(--color-vermilion)]">
                  This issue is held — release the hold to publish.
                </p>
              ) : null}
              {/* WSP-06 (D-15): the unlock condition written next to the
                  control — shown whenever Publish is disabled for any of
                  the three (or four, with held) gating reasons. */}
              {publishDisabled && !busy && (
                <p className="text-[11px] text-[color:var(--color-ink-soft)]">
                  Unlocks when: Must fix = 0 · Fact Check complete · Voice approved current
                  {held ? ' · Not held' : ''}
                </p>
              )}
              {showPreview && (
                <PublishPreviewDialog
                  issueNumber={issueNumber}
                  charityName={pitch?.charityName}
                  busy={busy}
                  onConfirm={() => {
                    setShowPreview(false)
                    void handlePublish()
                  }}
                  onCancel={() => setShowPreview(false)}
                />
              )}
              {/* finish-phase-34-retirement Task 2: ported schedule-for-later
                  action — gated identically to Publish (SAME publishDisabled
                  derivation) so the two enable/disable together. Secondary
                  control (border, not filled) so Publish stays the single
                  primary CTA. */}
              <button
                type="button"
                disabled={publishDisabled}
                onClick={() => setShowSchedule(true)}
                className="min-h-[44px] w-full border border-[color:var(--color-faint)] bg-white px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] font-medium uppercase tracking-[.06em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Schedule for later
              </button>
              {showSchedule && (
                <SchedulePublishDialog
                  runId={runId}
                  onScheduled={at => {
                    setShowSchedule(false)
                    setActionMessage(`Scheduled for ${new Date(at).toLocaleString()}.`)
                  }}
                  onCancel={() => setShowSchedule(false)}
                />
              )}
            </>
          )
        })()}
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

      {/* 8 — Resolved findings (D-04: the only surface where they reappear) */}
      <ResolvedFindingsList runId={runId} />
    </aside>
  )
}
