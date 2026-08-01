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
 *
 * Phase 36 (VOX-02, D-10, Plan 36-06): an optional `labels` prop gives this
 * SAME component a voice-tell presentation variant — different LABELS, not
 * different mechanics. Undefined = today's Review Desk labels (Accept fix /
 * Edit inline / Dismiss), unchanged. Voice Pass passes { accept: 'Accept
 * rewrite', editInline: 'Write my own', dismiss: 'Keep (not a tell)',
 * dismissReasonDefault: 'not a tell' }. When `labels.accept === 'Accept
 * rewrite'`: the "Suggested:" line reads "Suggested house voice:"; Accept is
 * available even with no stored `suggestedFix` (a rule-only tell) — clicking
 * it first calls `voicePassClient.rewrite` to generate one on demand, then
 * applies it via `acceptFinding`'s `suggestedFixOverride` (§36.5/§36.6) — so
 * the "Accept unavailable" message never shows in this variant.
 *
 * Phase 44 (INS-01, Plan 44-07 Task 1): an optional `onInspect?` prop adds
 * an "Inspect how this was made" action to this SAME action row, following
 * the identical `onEditSection?`/`sectionId` conditional-render convention.
 * This one component is the shared finding surface behind BOTH the draft
 * passage entry point (Review Desk's default `labels`) AND the voice
 * finding entry point (Voice Pass's `labels` variant) — one prop covers
 * both (44-RESEARCH.md "Six entry points" #2/#4). Clicking it calls
 * `onInspect(sectionId)`; the caller (Galley -> GallerySection) supplies a
 * callback that opens the shared inspector on this section's founder
 * artifact (`openInspector({ type: 'founder', runId, locator: sectionId })`).
 *
 * quick 260722-tv1: the popover self-clamps horizontally via a
 * `useLayoutEffect` measuring its own `getBoundingClientRect()` — a
 * right-edge annotation could otherwise clip against main's `overflow-y-auto`
 * (no `overflow-x` escape hatch). Mirrors `HelpTip`'s existing self-clamp;
 * jsdom returns a zero-width rect, so this no-ops safely in tests.
 *
 * quick 260730-i4j: the `<mark>` now carries `id="finding-{findingId}"` +
 * `data-finding-id` — the anchor `StoryFindingsRail`'s "Jump to it" action
 * scrolls to and clicks (opening this popover) rather than forking a second
 * jump mechanism.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { acceptFinding, dismissFinding, FindingsError } from '@/lib/findingsClient'
import { rewrite } from '@/lib/voicePassClient'
import { FACTUAL_AXES, VOICE_AXES } from '@/lib/galley/axisPartition'

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
  /**
   * Phase 44 (INS-01) — opens the shared inspector on this finding's
   * section. Render gate is `Boolean(onInspect)` (+ `sectionId`), mirroring
   * `onEditSection`.
   */
  onInspect?: (sectionId: string) => void
  /**
   * Phase 36 (VOX-02, D-10) — voice-tell label variant. Undefined = today's
   * Review Desk labels (Accept fix / Edit inline / Dismiss / '').
   */
  labels?: {
    accept?: string
    editInline?: string
    dismiss?: string
    dismissReasonDefault?: string
  }
  /**
   * Phase 51 (D-08, Pitfall 2) — label-INDEPENDENT trigger for the on-demand
   * voice rewrite. Was keyed off `labels?.accept === 'Accept rewrite'`, which
   * silently breaks the moment a caller uses a neutral label vocabulary.
   * When true, Accept is offered even with no stored `suggestedFix` and
   * `handleAccept` generates one via voicePassClient.rewrite first.
   */
  generateFixOnAccept?: boolean
  /**
   * Phase 51 (D-07) — render a small always-visible Fact/Voice text tag
   * adjacent to the marked span, readable WITHOUT opening the popover.
   * Undefined (Review Desk / Voice Pass) renders no tag — unchanged.
   */
  showAxisTag?: boolean
  /**
   * Phase 51 (READ-04, D-10..D-13) — recurring-correction group accept.
   * `sizeFor` returns how many sibling findings share this finding's fix (1
   * when it is alone); `acceptGroup` runs the caller's sequential accept
   * loop. Undefined (Review Desk / Voice Pass) leaves today's single-accept
   * behaviour byte-identical — neither prop is ever read.
   */
  findingGroup?: {
    sizeFor: (findingId: string) => number
    acceptGroup: (findingId: string) => Promise<void>
  }
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
  onInspect,
  labels,
  generateFixOnAccept,
  showAxisTag,
  findingGroup,
}: AnnotationMarkProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLSpanElement>(null)
  const [popoverShift, setPopoverShift] = useState(0)
  const { getToken } = useAuth()

  // Phase 33 action state.
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [dismissing, setDismissing] = useState(false)
  const [dismissReason, setDismissReason] = useState('')
  // Phase 51 (READ-04) — group-accept busy state, separate from the
  // single-accept `busy` above (both disable the button; only one is ever
  // active for a given finding, gated on `groupSize`).
  const [groupBusy, setGroupBusy] = useState(false)

  const canAct = Boolean(runId && revisionId)

  // Phase 36 (VOX-02, D-10) — the voice-tell variant, keyed off the caller's
  // explicit `labels.accept` value (never inferred from `value.axis` — the
  // Review Desk fixture set already uses a 'gravity' axis for unrelated
  // Phase 33 tests, so axis-based inference would silently relabel it).
  const acceptLabel = labels?.accept ?? 'Accept fix'
  const editInlineLabel = labels?.editInline ?? 'Edit inline'
  const dismissLabel = labels?.dismiss ?? 'Dismiss'
  // Phase 51 (D-08, Pitfall 2) — label-independent: a caller may opt into the
  // on-demand rewrite trigger via `generateFixOnAccept` regardless of what it
  // names the Accept button. The literal string match stays for Voice Pass's
  // existing 'Accept rewrite' label, bit-for-bit unchanged.
  const isRewriteVariant = generateFixOnAccept === true || labels?.accept === 'Accept rewrite'

  // Phase 51 (READ-04, D-10..D-13) — group size for THIS finding, from the
  // caller's already-loaded section rows. Undefined `findingGroup` (Review
  // Desk / Voice Pass) or a group of one both fall back to 1, which keeps
  // the accept label and click handler byte-identical to today's behaviour.
  const groupSize = findingGroup?.sizeFor(value.findingId) ?? 1
  const acceptText = groupSize >= 2 ? `${acceptLabel} (applies to ${groupSize} places)` : acceptLabel

  // Phase 51 (D-07) — Fact/Voice tag: FACTUAL_AXES -> 'Fact', VOICE_AXES ->
  // 'Voice', undefined axis -> 'Fact' (conservative default, matching
  // axisPartition's own convention). Never blank, never a third catch-all
  // label.
  const axisTag = value.axis === undefined
    ? 'Fact'
    : VOICE_AXES.has(value.axis)
      ? 'Voice'
      : FACTUAL_AXES.has(value.axis)
        ? 'Fact'
        : 'Fact'

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

  // quick 260722-tv1: self-clamp the popover leftward when it would overflow
  // the right edge of the viewport (jsdom's zero-width rect no-ops safely).
  useLayoutEffect(() => {
    if (!open) {
      setPopoverShift(0)
      return
    }
    if (typeof window === 'undefined') return
    const el = popoverRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return
    const overflow = rect.right - (window.innerWidth - 16)
    setPopoverShift(overflow > 0 ? -overflow : 0)
  }, [open])

  /**
   * Accept: apply suggestedFix via the pipeline, then refetch the draft so
   * re-resolution runs against fresh text (EDT-06). A revision_mismatch 409
   * ALSO refetches — the operator re-opens the finding and retries against
   * the new revision.
   *
   * Phase 36 (VOX-02, D-08/D-09): when the finding has no stored
   * `suggestedFix` (a rule-only tell), first call `voicePassClient.rewrite`
   * to generate a house-voice suggestion on demand, then apply it via
   * `suggestedFixOverride` (§36.5/§36.6) — otherwise the stored fix is used
   * unchanged (suggestedFixOverride stays undefined).
   */
  async function handleAccept() {
    if (!runId || !revisionId || busy) return
    setBusy(true)
    setNote(null)
    try {
      let suggestedFixOverride: string | undefined
      if (!value.suggestedFix) {
        const rewriteResult = await rewrite(runId, value.findingId, await getToken())
        suggestedFixOverride = rewriteResult.suggestedFix
      }
      await acceptFinding(
        runId,
        value.findingId,
        { ifRevisionID: revisionId, suggestedFixOverride },
        await getToken(),
      )
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

  /**
   * Phase 51 (READ-04, D-10..D-13) — group accept: one click applies this
   * finding's fix to every sibling that shares its axis + suggestedFix. The
   * sequential loop (accept -> fresh revisionId -> next accept) and the
   * partial-failure sentence live in the caller's `acceptGroup` (page.tsx) —
   * this component only owns the button's busy/disabled state and label.
   * There is deliberately no separate confirmation dialog: the count already
   * in the button's own label discloses the scope (UI-SPEC, locked).
   */
  async function handleGroupAccept() {
    if (!findingGroup || groupBusy) return
    setGroupBusy(true)
    try {
      await findingGroup.acceptGroup(value.findingId)
    } finally {
      setGroupBusy(false)
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
        id={`finding-${value.findingId}`}
        className="galley-anno"
        data-severity={value.severity}
        data-finding-id={value.findingId}
        tabIndex={0}
        role="button"
        aria-label={`QA ${value.severity} finding`}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        {children}
      </mark>
      {showAxisTag && (
        <span
          className="galley-anno-tag"
          aria-hidden="false"
          style={{
            marginLeft: 4,
            fontFamily: 'var(--font-ui)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-soft)',
            whiteSpace: 'nowrap',
          }}
        >
          {axisTag}
        </span>
      )}
      {open && (
        <span
          ref={popoverRef}
          className="galley-popover"
          role="dialog"
          style={popoverShift ? { left: popoverShift } : undefined}
        >
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
              {isRewriteVariant ? 'Suggested house voice:' : 'Suggested:'} {value.suggestedFix}
            </span>
          )}

          {/* Phase 33 (EDT-04) / Phase 36 (VOX-02, D-10): Accept/Edit/Dismiss
              action row — phrasing content only. */}
          <span className="galley-popover__actions" style={{ display: 'block', marginTop: 8 }}>
            {canAct && (isRewriteVariant || value.suggestedFix) && (
              <button
                type="button"
                style={actionButtonStyle}
                disabled={busy || groupBusy}
                onClick={groupSize >= 2 ? () => void handleGroupAccept() : () => void handleAccept()}
              >
                {groupBusy ? `Applying ${groupSize} places…` : acceptText}
              </button>
            )}
            {!isRewriteVariant && !value.suggestedFix && (
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
                {editInlineLabel}
              </button>
            )}
            {onInspect && sectionId && (
              <button
                type="button"
                style={actionButtonStyle}
                disabled={busy}
                onClick={() => onInspect(sectionId)}
              >
                Inspect how this was made
              </button>
            )}
            {canAct && !dismissing && (
              <button
                type="button"
                style={actionButtonStyle}
                disabled={busy}
                onClick={() => {
                  setDismissing(true)
                  setDismissReason(labels?.dismissReasonDefault ?? '')
                }}
              >
                {dismissLabel}
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
