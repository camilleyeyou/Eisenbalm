'use client'
/**
 * Phase 45 (REV-03, docs/API_CONTRACTS.md §45.3, DERIVED-STATE-CONTRACT §9)
 * — the "Ask agent to revise" comparison card shown BEFORE anything applies.
 *
 * Clones EvidenceComparisonCard's layout (original strikethrough | proposed |
 * what-changed | actions — FactCheckScreen.tsx:116-163) generalized to
 * arbitrary passages plus the REV-03 claim-delta block. The claim delta
 * (added/removed/altered) is ADVISORY narrative only (D-09) — it never
 * drives the enforced touched-claims reset, which happens deterministically
 * at apply time regardless of what this card shows (D-10/D-11). "Edit
 * before applying" does NOT recompute the delta on manual edit (D-11) — the
 * caller's apply path is always correct regardless of a stale advisory
 * delta.
 *
 * Surface-agnostic (D-18): this component knows nothing about the galley or
 * inspector — RevisionFlow.tsx (Task 3) mounts it.
 */
import { useState } from 'react'
import type { RevisePreviewResult, RevisionClaimDelta } from '@/lib/revisionClient'
import { useRole } from '@/lib/role'
import { LockedControl } from '@/components/LockedControl'

export interface RevisionComparisonCardProps {
  original: string
  preview: RevisePreviewResult
  busy?: boolean
  onApply: () => void
  onEdit: (editedText: string) => void
  onTryAnother: () => void
  onDiscard: () => void
}

const MICRO_LABEL =
  'font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]'

const ACTION_BUTTON =
  'min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40'

const INLINE_INPUT =
  'min-h-[80px] w-full rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 text-xs text-[color:var(--color-ink)]'

/**
 * Renders the D-09 advisory claim delta. When all three groups are empty,
 * an explicit "No claims added, removed, or altered." line is shown — the
 * never-blank rule applied to the delta's absence, not just its presence.
 */
function ClaimDeltaBlock({ delta }: { delta: RevisionClaimDelta }) {
  const groups: { label: string; items: string[] }[] = [
    { label: 'Altered', items: delta.altered ?? [] },
    { label: 'Added', items: delta.added ?? [] },
    { label: 'Removed', items: delta.removed ?? [] },
  ]
  const nonEmpty = groups.filter(g => g.items.length > 0)

  if (nonEmpty.length === 0) {
    return (
      <p className="text-[12px] text-[color:var(--color-ink-soft)]">
        No claims added, removed, or altered.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {nonEmpty.map(g => (
        <p key={g.label} className="text-[12px] text-[color:var(--color-ink-soft)]">
          {g.label}: {g.items.join('; ')}
        </p>
      ))}
    </div>
  )
}

export function RevisionComparisonCard({
  original,
  preview,
  busy,
  onApply,
  onEdit,
  onTryAnother,
  onDiscard,
}: RevisionComparisonCardProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(preview.proposedText)

  const disabled = Boolean(busy)
  // ROL-03 (D-09): presentation-only client hint — the server
  // `_require_editor` dependency (Plan 49-03) is the authoritative gate.
  // Plan 49-07: the "Apply" button rendered below is the ACTUAL DOM
  // location of RevisionFlow.tsx's applyRevision call site (this card is
  // RevisionFlow's presentation sub-component) — wrapped here rather than
  // in RevisionFlow.tsx, which only orchestrates state and never itself
  // renders an interactive element for this action.
  const isLocked = useRole() !== 'Editor-in-chief'

  return (
    <div
      className="flex flex-col gap-2 border border-[color:var(--color-marigold)] bg-white p-3"
      data-testid="revision-comparison-card"
    >
      <h4 className={MICRO_LABEL}>Ask agent to revise — comparison</h4>
      <p className="text-[13px] leading-snug text-[color:var(--color-ink-soft)] line-through">
        {original}
      </p>
      <p className="text-[13px] leading-snug text-[color:var(--color-ink)]">{preview.proposedText}</p>
      <p className="text-[12px] text-[color:var(--color-ink-soft)]">What changed: {preview.whatChanged}</p>
      <ClaimDeltaBlock delta={preview.claimDelta} />

      {editing ? (
        <span className="flex w-full flex-col gap-2">
          <textarea
            aria-label="Edit proposed text before applying"
            value={editText}
            onChange={e => setEditText(e.target.value)}
            className={INLINE_INPUT}
          />
          <span className="flex gap-2">
            <button
              type="button"
              className={ACTION_BUTTON}
              disabled={disabled || editText.trim() === ''}
              onClick={() => {
                onEdit(editText.trim())
                setEditing(false)
              }}
            >
              Apply edited text
            </button>
            <button
              type="button"
              className={ACTION_BUTTON}
              onClick={() => {
                setEditing(false)
                setEditText(preview.proposedText)
              }}
            >
              Cancel
            </button>
          </span>
        </span>
      ) : (
        <div className="flex flex-wrap gap-2">
          <LockedControl isLocked={isLocked} lockedLabel="Apply revision 🔒 editor only">
            <button type="button" disabled={disabled} className={ACTION_BUTTON} onClick={onApply}>
              Apply
            </button>
          </LockedControl>
          <button
            type="button"
            disabled={disabled}
            className={ACTION_BUTTON}
            onClick={() => {
              setEditText(preview.proposedText)
              setEditing(true)
            }}
          >
            Edit before applying
          </button>
          <button type="button" disabled={disabled} className={ACTION_BUTTON} onClick={onTryAnother}>
            Try another approach
          </button>
          <button type="button" disabled={disabled} className={ACTION_BUTTON} onClick={onDiscard}>
            Discard
          </button>
        </div>
      )}
    </div>
  )
}
