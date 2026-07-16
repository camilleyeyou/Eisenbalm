'use client'
/**
 * Phase 45 (REV-04, docs/API_CONTRACTS.md §45.2/§45.4) — the stateful
 * container orchestrating chips -> preview -> comparison card -> apply.
 *
 * Surface-agnostic (D-18): receives a `passage` (sectionName/quotedText/
 * blockIndexHint) and reports back via `onApplied`/`onClose` — knows nothing
 * about the galley or inspector. 45-05 mounts this into the actual entry
 * points (shared galley selection toolbar, Phase-44 InspectorFooter).
 *
 * Mirrors FactCheckScreen.tsx's preview/apply state machine
 * (handleAskAgent/handleConfirmEvidence, lines 263-300):
 *   - Apply obtains a FRESH ifRevisionID via getDraft(runId, token)
 *     immediately before applyRevision — never the preview-time revision.
 *   - `priorProposals` accumulates across repeated "Try another approach"
 *     so the revision agent diverges rather than repeats (D-05).
 *   - "Edit before applying" sends the operator-edited text through the
 *     SAME apply route (D-11) — the advisory claim delta is not
 *     recomputed on manual edit.
 *   - A `cost_cap_exceeded` 409 from `previewRevision` drives
 *     `DirectionChips` into its disabled/cost-capped state (D-14) rather
 *     than a silent failure.
 *   - A `revision_mismatch` 409 from `applyRevision` surfaces a
 *     reload-and-retry message (mirrors FactCheckScreen's freshRevisionId
 *     branch), never a silent failure.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { DirectionChips } from './DirectionChips'
import { RevisionComparisonCard } from './RevisionComparisonCard'
import {
  previewRevision,
  applyRevision,
  RevisionError,
  type DirectionChip,
  type RevisePreviewResult,
} from '@/lib/revisionClient'
import { getDraft, ContentPatchError } from '@/lib/contentPatchClient'

export interface RevisionPassage {
  sectionName: string
  quotedText: string
  blockIndexHint?: number
}

export interface RevisionFlowProps {
  runId: string
  passage: RevisionPassage
  onApplied: () => void | Promise<void>
  onClose: () => void
}

interface CapInfo {
  spentUsd: number
  capUsd: number
}

export function RevisionFlow({ runId, passage, onApplied, onClose }: RevisionFlowProps) {
  const { getToken } = useAuth()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<RevisePreviewResult | null>(null)
  // D-05 — accumulates every proposal shown so far, so a later "Try another
  // approach" always carries the FULL avoid-context (never just the last one).
  const [priorProposals, setPriorProposals] = useState<string[]>([])
  const [lastDirection, setLastDirection] = useState<DirectionChip | null>(null)
  const [lastCustomText, setLastCustomText] = useState<string | undefined>(undefined)
  const [capped, setCapped] = useState(false)
  const [capInfo, setCapInfo] = useState<CapInfo | undefined>(undefined)

  async function withBusy(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      if (e instanceof RevisionError && e.reason === 'cost_cap_exceeded') {
        // D-14 — disabled-with-explanation, never a silent failure. Return to
        // the chip view (any card currently shown is stale against the cap).
        setCapped(true)
        setCapInfo({ spentUsd: e.spentUsd ?? 0, capUsd: e.capUsd ?? 0 })
        setPreview(null)
      } else if (e instanceof RevisionError && e.reason === 'revision_mismatch') {
        setError('This passage changed since you loaded it — reload and try again.')
      } else if (e instanceof RevisionError) {
        setError(e.message)
      } else if (e instanceof ContentPatchError) {
        setError(e.message)
      } else if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('Revision action failed.')
      }
    } finally {
      setBusy(false)
    }
  }

  function runPreview(direction: DirectionChip, customText: string | undefined, avoid: string[]) {
    return withBusy(async () => {
      const token = await getToken()
      const result = await previewRevision(
        runId,
        {
          sectionName: passage.sectionName,
          quotedText: passage.quotedText,
          blockIndexHint: passage.blockIndexHint,
          direction,
          customDirection: customText,
          priorProposals: avoid,
        },
        token,
      )
      setLastDirection(direction)
      setLastCustomText(customText)
      setPreview(result)
      setPriorProposals(prev => [...prev, result.proposedText])
    })
  }

  function handleSelect(direction: DirectionChip, customText?: string) {
    void runPreview(direction, customText, priorProposals)
  }

  function handleTryAnother() {
    if (!lastDirection) return
    void runPreview(lastDirection, lastCustomText, priorProposals)
  }

  async function applyText(newText: string) {
    await withBusy(async () => {
      const token = await getToken()
      // FRESH ifRevisionID, obtained immediately before apply — never the
      // preview-time revision (mirrors FactCheckScreen.freshRevisionId).
      const draft = await getDraft(runId, token)
      await applyRevision(
        runId,
        {
          ifRevisionID: draft.revisionId,
          sectionName: passage.sectionName,
          quotedText: passage.quotedText,
          blockIndexHint: passage.blockIndexHint,
          newText,
        },
        token,
      )
      // Apply is atomic + audited server-side (§45.4): touched claims reset,
      // sign-offs revoked. onApplied() is this container's ONLY signal back
      // to the workspace — the caller's existing Convex subscriptions
      // reflect the reset/revocation once the mutation lands.
      await onApplied()
      onClose()
    })
  }

  function handleApply() {
    if (!preview) return
    void applyText(preview.proposedText)
  }

  function handleEdit(editedText: string) {
    // D-11 — the operator-edited text, NOT preview.proposedText.
    void applyText(editedText)
  }

  function handleDiscard() {
    setPreview(null)
    // priorProposals intentionally kept — a later Try-another-approach
    // should still diverge from every proposal already shown.
  }

  return (
    <div className="flex flex-col gap-3" data-testid="revision-flow">
      {error && (
        <p role="alert" className="text-xs text-[color:var(--color-vermilion)]">
          {error}
        </p>
      )}
      {!preview ? (
        <DirectionChips onSelect={handleSelect} costCapped={capped} capInfo={capInfo} />
      ) : (
        <RevisionComparisonCard
          original={passage.quotedText}
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
