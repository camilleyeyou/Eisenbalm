'use client'
/**
 * Voice Pass de-slop screen (Phase 36, VOX-01/VOX-04, Plan 36-04 Task 3).
 *
 * Mounts the SAME promoted `<Galley>` (Task 1/2) scoped to `VOICE_AXES` —
 * Voice Pass's own lit reading surface, distinct from Review Desk's
 * `FACTUAL_AXES` surface (§36.3). The draft-load pattern mirrors
 * review-desk/[runId]/page.tsx's `getDraft`/`useAuth` flow exactly.
 *
 * The per-screen tell count (VOX-01) is computed from the SAME open-finding
 * predicate (`isOpenFinding`) + `VOICE_AXES` scoping the mounted Galley
 * itself applies, so the header count and the lit spans never disagree.
 *
 * "Run deep check" (VOX-04) POSTs `voice-recheck` (§36.4) — the existing
 * Opus judge re-run on demand. Convex reactivity surfaces the fresh
 * voice-axis findings once written; there is no manual findings refetch
 * here, only a status message. `reloadDraft` is reserved for accepted text
 * changes (EDT-06), which Plan 36-06 wires into the rewrite popover.
 *
 * `showProvenance` is OFF — Voice Pass is a voice-only surface; the
 * factual provenance wash (Phase 35) belongs on Review Desk only (D-02/D-03).
 *
 * Phase 36 (VOX-02/VOX-03, Plan 36-06 Task 1/2): the mounted `<Galley>` now
 * gets `labels={VOICE_LABELS}` — the voice-tell AnnotationMark variant
 * (Accept rewrite / Write my own / Keep (not a tell)) — and the right
 * column mounts `<VoicePassRail>` (machine-tells list + voice-law reference
 * + the server-gated "Sounds human" sign-off), mirroring Review Desk's
 * galley+rail two-column layout.
 *
 * Phase 36 (VOX-02, D-09, Plan 36-07 Task 2): `onEditSection`/"Write my own"
 * deep-links into the Review Desk's `?edit=<sectionId>[&finding=<findingId>]`
 * entry (Plan 36-07 Task 1) rather than building a second editor surface on
 * Voice Pass — the lowest-cost fix that satisfies D-09 with zero new editing
 * machinery.
 *
 * The default export is a thin `use(params)` wrapper around the named
 * `VoicePassScreen` component below — split out so tests can render the
 * screen directly with a plain `runId` string, without needing a Suspense
 * boundary around an async Next.js 15 `params` Promise.
 *
 * Phase 40 (ISS-02, D-07, Plan 40-06 Task 1): this component was copied
 * verbatim out of `page.tsx` into this co-located non-route file so
 * `page.tsx` could become a redirect-only Server Component (Task 3) while
 * `/issues/[issueNumber]/voice` (Task 2) mounts the named `VoicePassScreen`
 * export directly with a plain `runId`. Every relative import below is
 * unchanged — this file lives in the SAME directory `page.tsx` used to
 * occupy.
 *
 * Phase 44 (INS-01, Plan 44-07 Task 1): the mounted `<Galley>` now gets
 * `onInspect` — the voice finding entry point into the shared "Inspect how
 * this was made" panel (`useInspector().openInspector`, mounted once at the
 * `(dashboard)` root layout). Same `AnnotationMark` component as Review
 * Desk's draft-passage entry point — one prop covers both.
 *
 * Phase 45 (REV-01/REV-04, D-18, Plan 45-05 Task 2): the mounted `<Galley>`
 * now also gets `onRevise`/`onRelatedFacts` — wired to the SAME
 * `revisePassage`/`requestRevision`/`clearRevisePassage` channel the
 * `InspectorProvider` context exposes (shared with Review Desk AND the
 * Phase-44 inspector footer's "Ask agent to revise", Plan 45-05 Task 3) —
 * one `RevisionFlow`, every surface (D-18). Applying reloads the draft
 * (`reloadDraft`), which re-fetches from Sanity so any revoked "Sounds
 * human" sign-off surfaces immediately on this screen. "Related facts &
 * sources" reuses the SAME `claimChecks.listByRunId` query the shared
 * galley already subscribes to internally (Convex dedupes the identical
 * subscription — no new backend query).
 *
 * quick 260722-tv1: the two-column stage row now uses `globals.css`'s
 * `.voice-canvas`/`.voice-stage-row`/`.voice-stage-rail` container-query
 * classes instead of `min-h-[70vh]`/`lg:flex-row`/`lg:w-[336px]` — those
 * viewport breakpoints starved the galley in the narrow Issue-Workspace
 * canvas mount even though the standalone route is plenty wide.
 */
import { use, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import Galley from '@/components/galley/Galley'
import { useInspector } from '@/components/inspector/InspectorProvider'
import VoicePassRail from './_components/VoicePassRail'
import { getDraft, ContentPatchError, type DraftResponse } from '@/lib/contentPatchClient'
import { isOpenFinding } from '@/lib/galley/findingState'
import { VOICE_AXES } from '@/lib/galley/axisPartition'
import { recheck, VoicePassApiError } from '@/lib/voicePassClient'
import { RevisionFlow } from '@/components/revision/RevisionFlow'
import ClaimProvenanceCard from '@/components/provenance/ClaimProvenanceCard'
import type { PassageSelection } from '@/components/galley/PassageToolbar'

/** Phase 36 (VOX-02, D-10) — the voice-tell AnnotationMark label variant. */
const VOICE_LABELS = {
  accept: 'Accept rewrite',
  editInline: 'Write my own',
  dismiss: 'Keep (not a tell)',
  dismissReasonDefault: 'not a tell',
} as const

interface VoicePassRunViewProps {
  params: Promise<{ runId: string }>
}

/** Minimal shape needed from a live `qaCorrections` row (matches Galley/DecisionRail). */
interface QaCorrectionRow {
  _id: string
  sectionName: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  accepted?: boolean
  resolution?: 'accepted' | 'dismissed'
}

/**
 * Minimal shape needed from a live `claim_checks` row (Phase 45, D-16 —
 * "Related facts & sources"). Mirrors `Galley.tsx`'s own internal
 * `ClaimCheckRow` (this app duplicates "minimal shape needed from a row"
 * interfaces per-surface today, matching `QaCorrectionRow` above).
 */
interface ClaimCheckRow {
  claimIndex: number
  text: string
  status: string
  claimId?: string
  sourceUrl?: string
  retrievedAt?: number
  sectionName?: string
  blockIndexHint?: number
  importance?: 'Load-bearing' | 'Supporting' | 'Incidental'
  context?: string
}

export default function VoicePassRunView({ params }: VoicePassRunViewProps) {
  const { runId: rawRunId } = use(params)
  const runId = decodeURIComponent(rawRunId)
  return <VoicePassScreen runId={runId} />
}

export function VoicePassScreen({ runId }: { runId: string }) {
  const { getToken } = useAuth()
  const router = useRouter()
  const { openInspector, revisePassage, requestRevision, clearRevisePassage } = useInspector()

  // Phase 45 (REV-01, D-16) — "Related facts & sources" selection; local to
  // this surface (unlike revisePassage) since only ONE entry point (the
  // galley toolbar) can ever set it.
  const [relatedFacts, setRelatedFacts] = useState<PassageSelection | null>(null)
  // The SAME claim_checks query Galley.tsx already subscribes to
  // internally — Convex dedupes the identical subscription, so this is not
  // a new backend query, just a second reader of the existing one.
  const claimRows =
    (useQuery(api.claimChecks.listByRunId, { runId }) as ClaimCheckRow[] | undefined) ?? []
  const relatedClaim = relatedFacts
    ? claimRows.find(
        (row) => row.sectionName === relatedFacts.sectionId && row.blockIndexHint === relatedFacts.blockIndex,
      )
    : undefined

  const [draft, setDraft] = useState<DraftResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Loads (or re-loads) the draft — mirrors review-desk/[runId]/page.tsx's
   * reloadDraft exactly, so the Galley mount's EDT-06 refetch-on-accept
   * behaves identically on both screens.
   */
  const reloadDraft = useCallback(async () => {
    setError(null)
    try {
      const token = await getToken()
      const result = await getDraft(runId, token)
      setDraft(result)
    } catch (e) {
      setError(
        e instanceof ContentPatchError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to load draft.',
      )
    }
    // getToken (Clerk) is a stable accessor called FRESH inside the try block
    // and always returns a current token regardless of which reference was
    // captured; including its identity here caused an infinite
    // refetch/re-render loop on CONTENT runs when getToken's reference
    // churns — quick 260721-ohu. Same chosen approach as
    // ReviewDeskRunView.tsx: drop getToken from THIS useCallback's deps
    // (rather than the mount effect below, which depends on [reloadDraft])
    // so reloadDraft stays stable per-runId, preserving Pitfall 1 (reused as
    // a prop after accept / revision_mismatch — see reloadDraft={reloadDraft}
    // / onApplied={reloadDraft} below). Depend on runId ONLY. The SECOND
    // getToken usage further down (deep-check re-run) is untouched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      await reloadDraft()
      if (!cancelled) setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reloadDraft])

  // VOX-01 per-screen tell count — the SAME isOpenFinding + VOICE_AXES
  // scoping the mounted Galley below applies (row.axis present AND a
  // member of VOICE_AXES), so the header count and the lit spans agree.
  const rawFindings =
    (useQuery(api.qaCorrections.byRunId, { runId }) as QaCorrectionRow[] | undefined) ?? []
  const tellCount = rawFindings.filter(
    row => isOpenFinding(row) && row.axis !== undefined && VOICE_AXES.has(row.axis),
  ).length

  // "Run deep check" (VOX-04) — on-demand Opus judge re-run.
  const [checking, setChecking] = useState(false)
  const [checkMessage, setCheckMessage] = useState<string | null>(null)

  async function handleRunDeepCheck() {
    setChecking(true)
    setCheckMessage(null)
    try {
      const token = await getToken()
      const result = await recheck(runId, token)
      setCheckMessage(
        `Deep check complete — ${result.findingCount} finding${result.findingCount === 1 ? '' : 's'}.`,
      )
    } catch (e) {
      setCheckMessage(
        e instanceof VoicePassApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Deep check failed.',
      )
    } finally {
      setChecking(false)
    }
  }

  /**
   * "Write my own" (VOX-02, D-09, Plan 36-07 Task 2) — deep-links into the
   * Review Desk's section editor for this tell's section, carrying the
   * finding id when present so the editor can keep its reason visible
   * (mirrors review-desk/[runId]/page.tsx's own handleEditSection contract).
   */
  function handleEditSection(sectionId: string, findingId?: string) {
    const q = new URLSearchParams({ edit: sectionId })
    if (findingId) q.set('finding', findingId)
    router.push('/review-desk/' + encodeURIComponent(runId) + '?' + q.toString())
  }

  /**
   * Phase 44 (INS-01) — the voice finding entry point. Same `AnnotationMark`
   * component Review Desk's draft-passage entry point uses; opens the
   * shared inspector on this section's `founder` artifact.
   */
  function handleInspect(sectionId: string) {
    openInspector({ type: 'founder', runId, locator: sectionId })
  }

  return (
    <div className="voice-canvas flex flex-col gap-4">
      {/* Phase 41 (D-07, Plan 41-07 Task 3): the standalone "Voice Pass —
          Run {runId}" header + advisory paragraph were removed here — the
          Issue Workspace frame's Voice tab + status mark is now the single
          chrome for this stage (mirrors the Stage-2 strip). The tellCount
          badge is an in-canvas content signal, not page chrome, so it is
          preserved below, relocated into the retained controls/toolbar
          row. No capability lost. */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={checking}
          onClick={() => void handleRunDeepCheck()}
          className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {checking ? 'Running deep check…' : 'Run deep check'}
        </button>
        <span
          aria-label="Tell count"
          className="font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink)]"
        >
          {tellCount} tell{tellCount === 1 ? '' : 's'}
        </span>
        {checkMessage && (
          <p role="status" className="text-[12px] text-[color:var(--color-ink)]">
            {checkMessage}
          </p>
        )}
      </div>

      {loading && (
        <p className="text-sm text-[color:var(--color-ink-soft)]">Loading draft…</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[color:var(--color-vermilion)]">
          {error}
        </p>
      )}

      {!loading && !error && draft && (
        <div className="voice-stage-row flex-1 gap-4">
          {/* LEFT — the VOICE_AXES-scoped galley, voice-tell labels (D-10). */}
          <div className="flex flex-1 flex-col gap-3">
            <Galley
              runId={runId}
              draft={draft}
              revisionId={draft.revisionId}
              reloadDraft={reloadDraft}
              onEditSection={handleEditSection}
              onInspect={handleInspect}
              onRevise={requestRevision}
              onRelatedFacts={setRelatedFacts}
              showProvenance={false}
              includeAxes={VOICE_AXES}
              labels={VOICE_LABELS}
            />

            {/* Phase 45 (REV-01/REV-04, D-18) — the shared "Ask agent to
                revise" flow, scoped to whichever passage was selected
                (galley toolbar) OR requested (inspector footer). Applying
                reloads the draft, so a revoked "Sounds human" sign-off
                surfaces immediately via VoicePassRail's own subscription. */}
            {revisePassage && (
              <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-[family-name:var(--font-ui)] text-[13px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)]">
                    Ask agent to revise — {revisePassage.sectionName}
                  </h3>
                  <button
                    type="button"
                    onClick={clearRevisePassage}
                    className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
                  >
                    Close
                  </button>
                </div>
                <RevisionFlow
                  runId={runId}
                  passage={revisePassage}
                  onApplied={reloadDraft}
                  onClose={clearRevisePassage}
                />
              </div>
            )}

            {/* Phase 45 (REV-01, D-16) — "Related facts & sources": the
                shared ClaimProvenanceCard for a tracked claim intersecting
                the selected block, or an honest "no tracked claims" state. */}
            {relatedFacts && (
              <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-[family-name:var(--font-ui)] text-[13px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)]">
                    Related facts &amp; sources
                  </h3>
                  <button
                    type="button"
                    onClick={() => setRelatedFacts(null)}
                    className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
                  >
                    Close
                  </button>
                </div>
                {relatedClaim ? (
                  <ClaimProvenanceCard
                    claim={{
                      text: relatedClaim.text,
                      importance: relatedClaim.importance,
                      status: relatedClaim.status,
                      sourceUrl: relatedClaim.sourceUrl,
                      supportingPassage: relatedClaim.context,
                      retrievedAt: relatedClaim.retrievedAt,
                      sectionName: relatedClaim.sectionName,
                    }}
                  />
                ) : (
                  <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">
                    No tracked claims in this passage.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — the Voice Pass rail (VOX-03): machine-tells, voice law,
              the server-gated "Sounds human" sign-off. Mirrors Review Desk's
              336px decision-rail column. */}
          <div className="voice-stage-rail shrink-0">
            <VoicePassRail runId={runId} />
          </div>
        </div>
      )}
    </div>
  )
}
