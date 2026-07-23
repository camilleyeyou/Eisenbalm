'use client'
/**
 * Phase 47 (BRF-06, docs/API_CONTRACTS.md §47.5) — "Ask an agent to
 * strengthen" a single Brief field.
 *
 * Generalizes the Phase-45 revision preview/apply pattern (D-03/D-13) to a
 * Brief-FIELD scope, exactly as Phase 45 generalized FCT-06 (claim-scope ->
 * passage-scope): a read-only preview (`strengthenBriefFieldPreview`, NO
 * mutation) -> Apply / Edit before applying / Try another / Discard
 * (`strengthenBriefFieldApply` writes the field + `audit_log` + a
 * Decision-log entry, mirroring `revise/apply`).
 *
 * `RevisionFlow.tsx` itself is NOT imported here: it is hardcoded to the
 * Sanity passage-revision client (`previewRevision`/`applyRevision` +
 * `ifRevisionID` sourced via `getDraft`) and is out of this plan's file
 * scope (frontmatter `files_modified` covers only this component + its
 * test + briefClient.ts). Reusing it unmodified would silently call the
 * WRONG endpoints for a Brief field (this task's own `<action>` text
 * explicitly allows wrapping "RevisionFlow (or its preview/comparison/apply
 * pieces)"). This component instead mirrors RevisionFlow's exact
 * state-machine SHAPE (idle -> preview -> apply/discard, `withBusy`
 * error-handling idiom) and reuses `RevisionComparisonCard` — the shared,
 * surface-agnostic comparison-card piece of the RevisionFlow kit — directly
 * for the preview/apply/discard UI. No forked comparison-card
 * implementation. A Brief field has no claim-bearing prose to track a
 * delta for, so `claimDelta` is always the empty/"no claims" shape
 * `RevisionComparisonCard` already renders honestly for that case.
 *
 * quick 260722-v01 (audit item 6): no longer mounts its own `<DecisionLog>`
 * — StoryBriefScreen.tsx mounts exactly ONE consolidated Decision log for
 * the whole Story stage (was up to ~11 duplicate run-scoped logs, one per
 * lead/brief-field). `strengthen/apply`'s reasoned audit row ("Applied
 * agent-strengthened {field}.") still surfaces there.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { RevisionComparisonCard } from '@/components/revision/RevisionComparisonCard'
import {
  strengthenBriefFieldPreview,
  strengthenBriefFieldApply,
  BriefClientError,
  type BriefField,
} from '@/lib/briefClient'
import type { RevisePreviewResult } from '@/lib/revisionClient'

export interface BriefFieldStrengthenProps {
  runId: string
  field: BriefField
  currentValue: string
  /** Fires after a successful Apply — the caller's Convex subscription
   * (`ws.brief`) reflects the write once it lands; this is purely a signal. */
  onApplied?: () => void | Promise<void>
}

/** A Brief field is not claim-bearing prose — always the honest "no claims" shape. */
const EMPTY_CLAIM_DELTA = { added: [] as string[], removed: [] as string[], altered: [] as string[] }

const ASK_BUTTON =
  'min-h-[36px] w-fit rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40'

export function BriefFieldStrengthen({
  runId,
  field,
  currentValue,
  onApplied,
}: BriefFieldStrengthenProps) {
  const { getToken } = useAuth()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<RevisePreviewResult | null>(null)

  async function withBusy(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      if (e instanceof BriefClientError) {
        setError(e.message)
      } else if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('Strengthen action failed.')
      }
    } finally {
      setBusy(false)
    }
  }

  function runPreview() {
    return withBusy(async () => {
      const token = await getToken()
      const result = await strengthenBriefFieldPreview(runId, field, currentValue, token)
      setPreview({ ...result, claimDelta: EMPTY_CLAIM_DELTA })
    })
  }

  function handleAskToStrengthen() {
    void runPreview()
  }

  function handleTryAnother() {
    void runPreview()
  }

  async function applyText(newText: string) {
    await withBusy(async () => {
      const token = await getToken()
      await strengthenBriefFieldApply(runId, field, newText, token)
      // Apply is atomic + audited server-side (§47.5) — onApplied() is this
      // component's ONLY signal back to the caller; the caller's existing
      // ws.brief subscription reflects the write once it lands.
      setPreview(null)
      await onApplied?.()
    })
  }

  function handleApply() {
    if (!preview) return
    void applyText(preview.proposedText)
  }

  function handleEdit(editedText: string) {
    // The operator-edited text, NOT preview.proposedText (mirrors
    // RevisionFlow's D-11 discipline).
    void applyText(editedText)
  }

  function handleDiscard() {
    setPreview(null)
  }

  return (
    <div className="flex flex-col gap-3" data-testid={`brief-field-strengthen-${field}`}>
      {error && (
        <p role="alert" className="text-xs text-[color:var(--color-vermilion)]">
          {error}
        </p>
      )}

      {!preview ? (
        <button
          type="button"
          disabled={busy}
          onClick={handleAskToStrengthen}
          className={ASK_BUTTON}
        >
          Ask an agent to strengthen
        </button>
      ) : (
        <RevisionComparisonCard
          original={currentValue}
          preview={preview}
          busy={busy}
          onApply={handleApply}
          onEdit={handleEdit}
          onTryAnother={handleTryAnother}
          onDiscard={handleDiscard}
        />
      )}
    </div>
  )
}
