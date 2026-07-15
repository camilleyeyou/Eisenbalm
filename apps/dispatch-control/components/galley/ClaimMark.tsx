'use client'
/**
 * @portabletext/react `marks.claimSpan` component (Phase 35 PRV-03, D-09/D-11,
 * Plan 35-05 Task 2).
 *
 * Renders the provenance wash (`.galley-claim` + `data-provenance` +
 * `data-checked`) around a resolved claim span — a BACKGROUND-only
 * treatment (D-09) so it stacks cleanly under any QA `annotation` mark
 * (underline) on the same text without ever colliding. Hovering surfaces
 * the source URL + retrieval date (sourced) or "No source" (unsourced) via
 * a native tooltip; clicking opens a popover.
 *
 * Phase 42 (FCT-04, D-09, Plan 42-07 Task 1) — the popover CONTENT is the
 * ONE shared `ClaimProvenanceCard` (`components/provenance/ClaimProvenanceCard.tsx`)
 * that Stage 3 Fact Check and Stage 5 Approval also consume, fed the real
 * `text`/`importance`/`context` fields `syntheticPortableText.ts`/`Galley.tsx`
 * now thread onto `ClaimSpanMarkDef` — no forked copy, no blank fields. The
 * card's own "Confirm" action is wired to the SAME `claimChecks:setStatus`
 * mutation "Mark checked" always called; a separate "Skip" control (a
 * Draft-only action the shared card has no slot for) is kept alongside it.
 *
 * Mark checked / Skip write DIRECTLY to `claim_checks` via
 * `claimChecks:setStatus` — the exact mutation `ClaimsChecklist` already
 * calls against Convex. `claim_checks` never touches Sanity (EDT-05
 * exempt, Pitfall 9), so this intentionally bypasses the pipeline findings
 * endpoints entirely.
 *
 * The `value` prop is the `ClaimSpanMarkDef` markDef payload injected by
 * `syntheticPortableText.ts`'s `toSyntheticBlocks` (Plan 35-05 Task 2).
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { ClaimSpanMarkDef } from '@/lib/galley/syntheticPortableText'
import ClaimProvenanceCard, {
  type ClaimProvenanceView,
} from '@/components/provenance/ClaimProvenanceCard'

interface ClaimMarkProps {
  value: ClaimSpanMarkDef
  children: React.ReactNode
  runId: string
  /**
   * Phase 41 (WSP-04, Plan 41-03) — optional click-through for an unchecked
   * (pending) claim. When provided AND `value.status === 'pending'`, a click
   * on the mark calls this with `value.claimIndex` INSTEAD OF toggling the
   * popover (Stage 2 Draft routes this to the Fact Check tab, Plan 41-08).
   * Undefined preserves today's toggle-popover-only behavior for every other
   * caller (Review Desk, Voice Pass). A checked claim always toggles the
   * popover regardless of this prop — click-through is unsourced/unchecked
   * only.
   */
  onUnsourcedClaimClick?: (claimIndex: number) => void
}

const actionButtonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '4px 10px',
  marginRight: 6,
  marginBottom: 6,
  border: '1px solid var(--color-faint)',
  borderRadius: 2,
  background: 'white',
  color: 'var(--color-ink)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  cursor: 'pointer',
}

/** Formats a Unix-ms retrieval timestamp as an ISO date (YYYY-MM-DD). */
function formatRetrievedAt(ms?: number): string | null {
  if (!ms) return null
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export default function ClaimMark({
  value,
  children,
  runId,
  onUnsourcedClaimClick,
}: ClaimMarkProps) {
  const [open, setOpen] = useState(false)
  // Phase 41 (WSP-04) — keyboard-focus reveal, independent of `open` so a
  // click-opened popover is never force-closed by an unrelated blur (the
  // popover renders on `open || focusOpen`, never collapsed into one state).
  const [focusOpen, setFocusOpen] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const [busy, setBusy] = useState(false)
  const setStatus = useMutation(api.claimChecks.setStatus)

  const isChecked = value.status !== 'pending'
  const retrievedLabel = formatRetrievedAt(value.retrievedAt)
  const tooltip =
    value.provenance === 'sourced'
      ? [value.sourceUrl, retrievedLabel ? `retrieved ${retrievedLabel}` : null]
          .filter(Boolean)
          .join(' · ') || 'Sourced claim'
      : 'No source'

  // Phase 42 (FCT-04) — the SAME §42.6 claim shape Stage 3/Approval feed the
  // shared card, sourced from the fields Galley.tsx/syntheticPortableText.ts
  // now thread onto ClaimSpanMarkDef (never blank text/importance).
  const claimView: ClaimProvenanceView = {
    text: value.text,
    importance: value.importance,
    status: value.status,
    sourceUrl: value.sourceUrl,
    supportingPassage: value.context,
    retrievedAt: value.retrievedAt,
    sectionName: value.sectionId,
  }

  function toggle() {
    setOpen((prev) => !prev)
  }

  function handleClick() {
    if (value.status === 'pending' && onUnsourcedClaimClick) {
      onUnsourcedClaimClick(value.claimIndex)
      return
    }
    toggle()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Close on Escape from anywhere while open.
  useEffect(() => {
    if (!open) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  async function handleSetStatus(status: 'checked' | 'skipped') {
    if (busy) return
    setBusy(true)
    try {
      await setStatus({ runId, claimIndex: value.claimIndex, status })
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span ref={wrapperRef} style={{ position: 'relative', display: 'inline' }}>
      <mark
        className="galley-claim"
        data-provenance={value.provenance}
        data-checked={isChecked ? 'true' : 'false'}
        title={tooltip}
        tabIndex={0}
        role="button"
        aria-label={`${value.provenance} claim`}
        aria-expanded={open || focusOpen}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocusOpen(true)}
        onBlur={() => setFocusOpen(false)}
      >
        {children}
      </mark>
      {(open || focusOpen) && (
        <span className="galley-popover" role="dialog">
          {/*
           * Phase 42 (FCT-04, D-09) — the SAME ClaimProvenanceCard Stage 3
           * Fact Check + Stage 5 Approval render, fed the real threaded
           * text/importance/supporting-passage. Its own "Confirm" action is
           * wired to the exact `claimChecks:setStatus('checked')` mutation
           * "Mark checked" always called (no forked write path). The card
           * has no "Skip" slot (a Draft-only action outside the shared
           * six-action set), so a small Skip control is kept alongside it.
           */}
          <ClaimProvenanceCard
            claim={claimView}
            busy={busy}
            actions={{ onConfirm: () => void handleSetStatus('checked') }}
          />
          <span className="galley-popover__actions" style={{ display: 'block', marginTop: 8 }}>
            <button
              type="button"
              style={actionButtonStyle}
              disabled={busy}
              onClick={() => void handleSetStatus('skipped')}
            >
              Skip
            </button>
          </span>
        </span>
      )}
    </span>
  )
}
