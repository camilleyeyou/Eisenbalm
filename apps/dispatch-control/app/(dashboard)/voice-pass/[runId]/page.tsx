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
 * `onEditSection` is a safe no-op stub for this plan — Plan 36-06 finalizes
 * the rewrite/edit-inline actions for voice tells.
 *
 * The default export is a thin `use(params)` wrapper around the named
 * `VoicePassScreen` component below — split out so tests can render the
 * screen directly with a plain `runId` string, without needing a Suspense
 * boundary around an async Next.js 15 `params` Promise.
 */
import { use, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import Galley from '@/components/galley/Galley'
import { getDraft, ContentPatchError, type DraftResponse } from '@/lib/contentPatchClient'
import { isOpenFinding } from '@/lib/galley/findingState'
import { VOICE_AXES } from '@/lib/galley/axisPartition'
import { recheck, VoicePassApiError } from '@/lib/voicePassClient'

interface VoicePassRunPageProps {
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

export default function VoicePassRunPage({ params }: VoicePassRunPageProps) {
  const { runId: rawRunId } = use(params)
  const runId = decodeURIComponent(rawRunId)
  return <VoicePassScreen runId={runId} />
}

export function VoicePassScreen({ runId }: { runId: string }) {
  const { getToken } = useAuth()

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
  }, [runId, getToken])

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
   * Safe no-op stub — Voice Pass's Galley mount requires onEditSection, but
   * this plan does not wire an edit destination for voice tells yet. Plan
   * 36-06 finalizes the rewrite popover / edit-inline action.
   */
  function handleEditSection() {
    // Intentionally inert.
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <div className="flex flex-col gap-1 border-b border-[color:var(--color-faint)] pb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--color-ink)]">
            Voice Pass — Run {runId}
          </h1>
          <span
            aria-label="Tell count"
            className="font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink)]"
          >
            {tellCount} tell{tellCount === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          De-slop it: machine-tells and voice violations lit inline over the
          draft prose.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={checking}
          onClick={() => void handleRunDeepCheck()}
          className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {checking ? 'Running deep check…' : 'Run deep check'}
        </button>
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
        <Galley
          runId={runId}
          draft={draft}
          revisionId={draft.revisionId}
          reloadDraft={reloadDraft}
          onEditSection={handleEditSection}
          showProvenance={false}
          includeAxes={VOICE_AXES}
        />
      )}
    </div>
  )
}
