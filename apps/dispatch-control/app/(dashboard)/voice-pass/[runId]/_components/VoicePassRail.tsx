'use client'
/**
 * Phase 36 (VOX-03, Plan 36-06 Task 2) — the Voice Pass right rail.
 *
 * Mirrors `review-desk/[runId]/_components/DecisionRail.tsx`'s
 * blockers-first structure, scoped to `VOICE_AXES` (§36.3) instead of
 * `FACTUAL_AXES`:
 *
 *   1. Machine-tells — a jump-link list of OPEN voice-axis error findings,
 *      using the SAME `isOpenFinding` predicate the mounted Galley itself
 *      applies (Pitfall 9) — the rail and the lit spans never disagree.
 *   2. Voice law — a short reference to `voice_constraints` (the prompt
 *      library's house-voice rules), NOT a restatement of it.
 *   3. Sign-offs — the server-gated "Sounds human" sign-off (§36.7,
 *      D-12/D-14): disabled while any open voice-axis error remains, with a
 *      belt-and-suspenders 409 (`open_voice_findings`) surfaced if the
 *      client-side gate is ever stale.
 *
 * `DecisionRail.tsx` already subscribes to the SAME `api.signOffs.
 * activeByRunId` query and renders the "Sounds human" green once this rail's
 * sign-off succeeds — no DecisionRail change is needed; the two rails are
 * independent readers/writers of the same `sign_offs` row (Review Desk's own
 * "Sign: Sounds human" button, shipped interim/ungated in Phase 34, is now
 * ALSO subject to the same server-side §36.7 gate — unchanged here).
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { recordSignOff, SignOffApiError } from '@/lib/signOffClient'
import { isOpenFinding } from '@/lib/galley/findingState'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import { VOICE_AXES } from '@/lib/galley/axisPartition'

interface VoicePassRailProps {
  runId: string
}

/** Minimal shape needed from a live `qaCorrections` row (matches Galley). */
interface QaCorrectionRow {
  _id: string
  sectionName: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  accepted?: boolean
  resolution?: 'accepted' | 'dismissed'
}

/** Mirrors DecisionRail's galleyAnchorFor — see that file for the exceptions. */
function galleyAnchorFor(sectionId: string): string | null {
  if (sectionId === 'theme') return null
  if (sectionId === 'deliberation-conversation') return 'galley-deliberation'
  return `galley-${sectionId}`
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

export default function VoicePassRail({ runId }: VoicePassRailProps) {
  const { getToken } = useAuth()

  // ── Data ──────────────────────────────────────────────────────────────────
  const rawFindings =
    (useQuery(api.qaCorrections.byRunId, { runId }) as QaCorrectionRow[] | undefined) ?? []
  // Pitfall 9: the ONE shared open-finding predicate.
  const openFindings = rawFindings.filter(isOpenFinding)
  // §36.3: this rail only ever lists/blocks VOICE_AXES findings — an
  // axis-less row is factual by DecisionRail's conservative default and
  // never appears here.
  const voiceOpen = openFindings.filter(f => f.axis !== undefined && VOICE_AXES.has(f.axis))
  const voiceBlockers = voiceOpen.filter(f => f.severity === 'error')
  const voiceWarnings = voiceOpen.filter(f => f.severity === 'warning').length

  // Sign-offs (§34.2 live subscription, shared with DecisionRail) —
  // affirmative state, never blank.
  const active = useQuery(api.signOffs.activeByRunId, { runId }) as
    | Record<'facts-cleared' | 'sounds-human', { actorId: string; signedAt: number }>
    | undefined
  const humanActive = !!active?.['sounds-human']

  // ── Actions state ─────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function jumpToFinding(finding: QaCorrectionRow) {
    const galleyId = qaSectionToGalleyId(finding.sectionName)
    if (!galleyId) return
    const anchor = galleyAnchorFor(galleyId)
    if (!anchor) return
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleSignOff() {
    setBusy(true)
    setMessage(null)
    try {
      const token = await getToken()
      await recordSignOff(token, runId, 'sounds-human')
      setMessage('Sounds human — signed.')
    } catch (e) {
      setMessage(
        e instanceof SignOffApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Sign-off failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  const reasonLine =
    voiceBlockers.length > 0
      ? `${voiceBlockers.length} voice tell${voiceBlockers.length === 1 ? '' : 's'} to clear`
      : null

  return (
    <aside
      aria-label="Voice Pass rail"
      className="flex w-full flex-col gap-5 border border-[color:var(--color-faint)] bg-[color:var(--color-rail)] p-4"
    >
      {/* 1 — Machine-tells list */}
      <section aria-label="Machine-tells">
        <h3 className={MICRO_LABEL}>Machine-tells</h3>
        <p className="mt-1 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink)]">
          {voiceBlockers.length} tell{voiceBlockers.length === 1 ? '' : 's'} to clear
          {voiceWarnings > 0 && (
            <span className="font-normal text-[color:var(--color-ink-soft)]">
              {' '}
              · {voiceWarnings} warning{voiceWarnings === 1 ? '' : 's'}
            </span>
          )}
        </p>
        {voiceBlockers.length === 0 ? (
          <p className="mt-1 text-[13px] text-[color:var(--color-green,#148a52)]">
            No open machine-tells — clear to sign.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {voiceBlockers.map(finding => (
              <li key={finding._id}>
                <button
                  type="button"
                  onClick={() => jumpToFinding(finding)}
                  className="min-h-[44px] w-full border-l-2 border-[color:var(--color-vermilion)] bg-white px-2 py-1.5 text-left text-[13px] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
                >
                  <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-vermilion)]">
                    {finding.sectionName}
                  </span>{' '}
                  {finding.reason.length > 90 ? `${finding.reason.slice(0, 90)}…` : finding.reason}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2 — Voice law reference (a pointer, not a restatement) */}
      <section aria-label="Voice law">
        <h3 className={MICRO_LABEL}>Voice law</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-ink-soft)]">
          Every rewrite is measured against the run&rsquo;s house voice (
          <code>voice_constraints</code>) — see the prompt library for the full
          rubric.
        </p>
      </section>

      {/* 3 — Sign-offs: the server-gated "Sounds human" green (§36.7). */}
      <section aria-label="Sign-offs">
        <h3 className={MICRO_LABEL}>Sign-offs</h3>
        <div className="mt-1 flex flex-col gap-2">
          {humanActive ? (
            <p className="text-[13px] text-[color:var(--color-green,#148a52)]">
              Sounds human — signed {formatAgo(active!['sounds-human'].signedAt)}
            </p>
          ) : (
            <>
              <button
                type="button"
                disabled={voiceBlockers.length > 0 || busy}
                onClick={() => void handleSignOff()}
                className="min-h-[44px] w-full border border-[color:var(--color-faint)] bg-white px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] font-medium uppercase tracking-[.06em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sign: Sounds human
              </button>
              {reasonLine && (
                <p className="text-[11px] text-[color:var(--color-vermilion)]">{reasonLine}</p>
              )}
            </>
          )}
          {message && (
            <p role="status" className="text-[12px] text-[color:var(--color-ink)]">
              {message}
            </p>
          )}
        </div>
      </section>
    </aside>
  )
}
