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
 * a native tooltip; clicking opens a popover with an "Open source" link
 * plus Mark checked / Skip actions.
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

interface ClaimMarkProps {
  value: ClaimSpanMarkDef
  children: React.ReactNode
  runId: string
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

export default function ClaimMark({ value, children, runId }: ClaimMarkProps) {
  const [open, setOpen] = useState(false)
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

  function toggle() {
    setOpen((prev) => !prev)
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
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        {children}
      </mark>
      {open && (
        <span className="galley-popover" role="dialog">
          <span className="galley-popover__severity" style={{ display: 'block' }}>
            {value.provenance}
          </span>
          <span className="galley-popover__reason" style={{ display: 'block' }}>
            {value.provenance === 'sourced'
              ? (value.sourceUrl ?? 'Source unavailable')
              : 'No source found for this claim.'}
          </span>
          {retrievedLabel && (
            <span className="galley-popover__fix" style={{ display: 'block' }}>
              Retrieved {retrievedLabel}
            </span>
          )}

          <span className="galley-popover__actions" style={{ display: 'block', marginTop: 8 }}>
            {value.sourceUrl && (
              <a
                href={value.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...actionButtonStyle, display: 'inline-block', textDecoration: 'none' }}
              >
                Open source
              </a>
            )}
            <button
              type="button"
              style={actionButtonStyle}
              disabled={busy}
              onClick={() => void handleSetStatus('checked')}
            >
              Mark checked
            </button>
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
