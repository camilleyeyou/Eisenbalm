'use client'
/**
 * @portabletext/react `marks.annotation` component (Phase 32 GLY-02, D-07/D-10;
 * Phase 33 EDT-04, Plan 33-04 Task 3).
 *
 * Renders the inline severity-tiered underline (`.galley-anno` +
 * `data-severity`) around the annotated span, and a popover on click/
 * keyboard-open showing axis · severity · reason · suggested fix, plus the
 * Phase 33 action row: Accept fix (gated on suggestedFix, D-07), Edit inline
 * (D-08 deep-link), and Dismiss (one-line reason required, D-11).
 *
 * Accept flows through the pipeline findings endpoint; on success (and on a
 * revision_mismatch 409) the draft is refetched via `reloadDraft` so span
 * re-resolution runs against fresh text (EDT-06, Pitfall 1). Dismissed
 * findings drop from every open surface reactively via Convex — no refetch.
 *
 * Pitfall 5: this popover renders INSIDE the galley's paragraph elements, so
 * everything here is phrasing content — spans with display:block, buttons,
 * and an input. Never a block-level container or a nested paragraph.
 *
 * The `value` prop is the `AnnotationMarkDef` markDef payload injected by
 * `syntheticPortableText.ts`'s `toSyntheticBlocks` (Plan 32-04).
 */
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { acceptFinding, dismissFinding, FindingsError } from '@/lib/findingsClient'

export interface AnnotationMarkDef {
  findingId: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan?: string
}

interface AnnotationMarkProps {
  value: AnnotationMarkDef
  children: React.ReactNode
  /** Phase 33 (EDT-04) action context, threaded from GallerySection. */
  runId?: string
  sectionId?: string
  revisionId?: string
  reloadDraft?: () => Promise<void> | void
  onEditSection?: (sectionId: string, findingId?: string) => void
}

const actionButtonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '4px 10px',
  marginRight: 6,
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

export default function AnnotationMark({
  value,
  children,
  runId,
  sectionId,
  revisionId,
  reloadDraft,
  onEditSection,
}: AnnotationMarkProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const { getToken } = useAuth()

  // Phase 33 action state.
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [dismissing, setDismissing] = useState(false)
  const [dismissReason, setDismissReason] = useState('')

  const canAct = Boolean(runId && revisionId)

  function toggle() {
    setOpen(prev => {
      if (!prev) {
        // Fresh action state on every open.
        setNote(null)
        setDismissing(false)
        setDismissReason('')
      }
      return !prev
    })
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

  /**
   * Accept: apply suggestedFix via the pipeline, then refetch the draft so
   * re-resolution runs against fresh text (EDT-06). A revision_mismatch 409
   * ALSO refetches — the operator re-opens the finding and retries against
   * the new revision.
   */
  async function handleAccept() {
    if (!runId || !revisionId || busy) return
    setBusy(true)
    setNote(null)
    try {
      await acceptFinding(runId, value.findingId, { ifRevisionID: revisionId }, await getToken())
      await reloadDraft?.()
      setOpen(false)
    } catch (e) {
      if (e instanceof FindingsError && e.reason === 'revision_mismatch') {
        await reloadDraft?.()
        setNote('Draft changed — re-open this finding and retry.')
      } else if (e instanceof FindingsError && e.reason === 'span_not_resolved') {
        setNote("Couldn't anchor this text in the current draft. Use Edit inline instead.")
      } else {
        setNote(e instanceof Error ? e.message : 'Accept failed.')
      }
    } finally {
      setBusy(false)
    }
  }

  /** Dismiss: reason required (D-11). Convex reactivity removes the span. */
  async function handleDismissSubmit() {
    const reason = dismissReason.trim()
    if (!runId || !reason || busy) return
    setBusy(true)
    setNote(null)
    try {
      await dismissFinding(runId, value.findingId, { reason }, await getToken())
      setOpen(false)
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Dismiss failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span ref={wrapperRef} style={{ position: 'relative', display: 'inline' }}>
      <mark
        className="galley-anno"
        data-severity={value.severity}
        tabIndex={0}
        role="button"
        aria-label={`QA ${value.severity} finding`}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        {children}
      </mark>
      {open && (
        <span className="galley-popover" role="dialog">
          <span className="galley-popover__severity" style={{ display: 'block' }}>
            {value.severity}
          </span>
          {value.axis && (
            <span className="galley-popover__axis" style={{ display: 'block' }}>
              {value.axis}
            </span>
          )}
          <span className="galley-popover__reason" style={{ display: 'block' }}>
            {value.reason}
          </span>
          {value.suggestedFix && (
            <span className="galley-popover__fix" style={{ display: 'block' }}>
              Suggested: {value.suggestedFix}
            </span>
          )}

          {/* Phase 33 (EDT-04): Accept/Edit/Dismiss action row — phrasing content only. */}
          <span className="galley-popover__actions" style={{ display: 'block', marginTop: 8 }}>
            {canAct && value.suggestedFix && (
              <button
                type="button"
                style={actionButtonStyle}
                disabled={busy}
                onClick={() => void handleAccept()}
              >
                Accept fix
              </button>
            )}
            {!value.suggestedFix && (
              <span
                className="galley-popover__accept-unavailable"
                style={{ display: 'block', fontSize: 11, opacity: 0.75, marginBottom: 6 }}
              >
                Accept unavailable — no suggested fix.
              </span>
            )}
            {onEditSection && sectionId && (
              <button
                type="button"
                style={actionButtonStyle}
                disabled={busy}
                onClick={() => onEditSection(sectionId, value.findingId)}
              >
                Edit inline
              </button>
            )}
            {canAct && !dismissing && (
              <button
                type="button"
                style={actionButtonStyle}
                disabled={busy}
                onClick={() => setDismissing(true)}
              >
                Dismiss
              </button>
            )}
            {dismissing && (
              <span style={{ display: 'block', marginTop: 6 }}>
                <input
                  aria-label="Dismissal reason"
                  placeholder="Why dismiss this finding?"
                  value={dismissReason}
                  onChange={e => setDismissReason(e.target.value)}
                  style={{
                    display: 'block',
                    width: '100%',
                    minHeight: 44,
                    padding: '4px 8px',
                    marginBottom: 6,
                    border: '1px solid var(--color-faint)',
                    borderRadius: 2,
                    fontSize: 12,
                  }}
                />
                <button
                  type="button"
                  style={actionButtonStyle}
                  disabled={busy || dismissReason.trim() === ''}
                  onClick={() => void handleDismissSubmit()}
                >
                  Confirm dismiss
                </button>
              </span>
            )}
            {note && (
              <span
                role="status"
                className="galley-popover__note"
                style={{ display: 'block', marginTop: 6, fontSize: 11 }}
              >
                {note}
              </span>
            )}
          </span>
        </span>
      )}
    </span>
  )
}
