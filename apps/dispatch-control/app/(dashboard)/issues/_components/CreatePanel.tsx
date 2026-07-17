'use client'
/**
 * Phase 40 Plan 40-05 (§40-UI-SPEC, ISS-01, D-28) — the ONE Create path
 * that phase shipped: "Find a story with agents".
 *
 * Placed AFTER the lists (Visual Hierarchy) — the fallback path when
 * nothing is in progress, not a competing primary action. In the empty
 * state (no in-progress issue), the PAGE promotes this panel to the focal
 * point (Display heading, card surface) per the Visual-Hierarchy inversion
 * — this component itself renders identically either way; the page decides
 * placement/prominence.
 *
 * Phase 48 Plan 48-05 (ENT-01, D-13/D-14, §48.2) fills the second grid cell
 * — reserved but intentionally ABSENT since Phase 40 (D-28's "no dead
 * button in the primary CTA") — with a visual PEER card: "Start from my
 * brief". This is a REAL second pipeline entry point, not a stub: the
 * operator supplies premise, peg, organization (+ optional website/source
 * material); the run skips Signal Editor, Scout, Advocate, and Gate 1 and
 * enters at the Researcher (verify_candidates still runs on the human org,
 * ENT-04). Both cards share the SAME submit chain shape — ensureByNumber ->
 * trigger* -> router.push(issueHref(n)) — landing at Stage 1 either way
 * (ENT-01 "two equal paths").
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { triggerRun, triggerBriefRun } from '@/lib/pipelineControlClient'
import { issueHref } from '@/lib/issueRouteResolver'

export interface CreatePanelProps {
  nextIssueNumber: number
}

const CARD_CLASS =
  'flex flex-col items-start gap-3 rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-6'
const HEADING_CLASS =
  'font-[family-name:var(--font-display)] text-[16px] font-semibold text-[color:var(--color-ink)]'
const BODY_CLASS =
  'font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]'
const BUTTON_CLASS =
  'mt-1 flex min-h-[44px] items-center justify-center rounded-[2px] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)] disabled:cursor-not-allowed disabled:opacity-50'
const ERROR_CLASS =
  'font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-vermilion)]'
const LABEL_CLASS =
  'flex flex-col gap-1 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)]'
const FIELD_CLASS =
  'rounded-[2px] border border-[color:var(--color-ink)]/[.2] bg-[color:var(--color-paper)] p-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)]'

export default function CreatePanel({ nextIssueNumber }: CreatePanelProps) {
  const router = useRouter()
  const { getToken } = useAuth()
  const ensureByNumber = useMutation(api.issues.ensureByNumber)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [briefOpen, setBriefOpen] = useState(false)
  const [premise, setPremise] = useState('')
  const [peg, setPeg] = useState('')
  const [orgName, setOrgName] = useState('')
  const [orgWebsite, setOrgWebsite] = useState('')
  const [sourceMaterial, setSourceMaterial] = useState('')

  async function handleCreate() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await ensureByNumber({
        workspace_id: DEFAULT_WORKSPACE_ID,
        issueNumber: nextIssueNumber,
      })
      const token = await getToken()
      await triggerRun({ issueNumber: nextIssueNumber }, token)
      router.push(issueHref(nextIssueNumber))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  const briefReady =
    premise.trim().length > 0 && peg.trim().length > 0 && orgName.trim().length > 0

  async function handleCreateBrief() {
    if (busy || !briefReady) return
    setBusy(true)
    setError(null)
    try {
      await ensureByNumber({
        workspace_id: DEFAULT_WORKSPACE_ID,
        issueNumber: nextIssueNumber,
      })
      const token = await getToken()
      await triggerBriefRun(
        {
          issueNumber: nextIssueNumber,
          premise,
          peg,
          organization: {
            name: orgName,
            ...(orgWebsite.trim() ? { website: orgWebsite.trim() } : {}),
          },
          ...(sourceMaterial.trim() ? { sourceMaterial: sourceMaterial.trim() } : {}),
        },
        token,
      )
      router.push(issueHref(nextIssueNumber))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className={CARD_CLASS}>
        <h2 className={HEADING_CLASS}>Find a story</h2>
        <p className={BODY_CLASS}>
          The agents scout, argue, and land on this week&rsquo;s charity — you choose the
          recommended story.
        </p>
        <button type="button" onClick={handleCreate} disabled={busy} className={BUTTON_CLASS}>
          Find a story with agents
        </button>
      </div>

      <div className={CARD_CLASS}>
        <h2 className={HEADING_CLASS}>Start from my brief</h2>
        <p className={BODY_CLASS}>
          You supply the premise, peg, and organization — the run skips Signal Editor, Scout,
          Advocate, and the story decision, and enters at the Researcher.
        </p>
        {!briefOpen && (
          <button
            type="button"
            onClick={() => setBriefOpen(true)}
            className={BUTTON_CLASS}
          >
            Start from my brief
          </button>
        )}
        {briefOpen && (
          <div className="flex w-full flex-col gap-3">
            <label className={LABEL_CLASS} htmlFor="brief-premise">
              Premise
              <textarea
                id="brief-premise"
                value={premise}
                onChange={(e) => setPremise(e.target.value)}
                required
                rows={3}
                className={FIELD_CLASS}
              />
            </label>
            <label className={LABEL_CLASS} htmlFor="brief-peg">
              Peg
              <input
                id="brief-peg"
                type="text"
                value={peg}
                onChange={(e) => setPeg(e.target.value)}
                required
                className={FIELD_CLASS}
              />
            </label>
            <label className={LABEL_CLASS} htmlFor="brief-org-name">
              Organization name
              <input
                id="brief-org-name"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                className={FIELD_CLASS}
              />
            </label>
            <label className={LABEL_CLASS} htmlFor="brief-org-website">
              Website (optional)
              <input
                id="brief-org-website"
                type="text"
                value={orgWebsite}
                onChange={(e) => setOrgWebsite(e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
            <label className={LABEL_CLASS} htmlFor="brief-source-material">
              Source material (optional)
              <textarea
                id="brief-source-material"
                value={sourceMaterial}
                onChange={(e) => setSourceMaterial(e.target.value)}
                rows={3}
                className={FIELD_CLASS}
              />
            </label>
            <button
              type="button"
              onClick={handleCreateBrief}
              disabled={busy || !briefReady}
              className={BUTTON_CLASS}
            >
              Start this run
            </button>
          </div>
        )}
      </div>
      {error && <p className={`sm:col-span-2 ${ERROR_CLASS}`}>{error}</p>}
    </div>
  )
}
