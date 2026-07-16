'use client'
/**
 * Phase 45 (REV-01, D-16/D-17/D-18, docs/API_CONTRACTS.md §45.6, Plan 45-05
 * Task 1) — the shared galley passage-selection toolbar.
 *
 * Mounted once by `Galley.tsx` (covers BOTH Draft/Review-Desk and Voice
 * Pass, since they share the SAME `Galley` instance, D-18's "one component,
 * every surface"). Listens for `selectionchange`/`mouseup` on `document`
 * and, whenever the active `window.getSelection()` is non-empty AND
 * anchored inside the passed `containerRef.current` (the galley root),
 * resolves which block/section it falls in via the DOM `data-block-index`
 * stamp (`GallerySection.tsx`, 45-05 Task 1) and the `galley-{sectionId}`
 * anchor (`Galley.tsx`/`GallerySection.tsx`) — never a second block-key
 * parser; `blockIndexFromKey` (45-01) is used ONLY to STAMP the DOM
 * attribute, this component reads the already-stamped attribute directly.
 *
 * Renders nothing when there is no active in-container selection (never a
 * dead floating toolbar). Otherwise renders the REV-01 six actions, in
 * order:
 *   1. Edit text                 — LIVE  (`onEditText`)
 *   2. Ask agent to revise       — LIVE  (`onRevise`)
 *   3. Compare with previous     — RESERVED (D-17 — no shipped content-
 *      version endpoint; visible-but-reserved with an explanatory title,
 *      never hidden)
 *   4. Restore previous          — RESERVED (D-17, same rationale)
 *   5. Related facts & sources   — LIVE  (`onRelatedFacts`)
 *   6. Inspect how this was made — LIVE  (`onInspect`)
 *
 * "LIVE" here means enabled/clickable — every callback prop is optional, so
 * a caller that omits one simply sees a no-op click for that action (mirrors
 * `onInspect`'s existing optional-prop convention elsewhere in the galley).
 * Reuses the `InspectorFooter` (§44.7) reserved/live button class strings
 * for visual consistency between the two toolbars this phase ships.
 */
import { useEffect, useState, type RefObject } from 'react'

/** A resolved in-container text selection, block/section-anchored. */
export interface PassageSelection {
  sectionId: string
  blockIndex: number
  quotedText: string
}

/** The exact shape `RevisionFlow`'s `passage` prop expects (45-04). */
export interface RevisionPassageFromSelection {
  sectionName: string
  quotedText: string
  blockIndexHint: number
}

export interface PassageToolbarProps {
  /** The galley root (`Galley.tsx`'s `galley-root` div) — selections outside this are ignored. */
  containerRef: RefObject<HTMLElement | null>
  /** Ask agent to revise (D-18) — LIVE when provided. */
  onRevise?: (passage: RevisionPassageFromSelection) => void
  /** Edit text — LIVE when provided; the caller maps this into its existing section-editor entry. */
  onEditText?: (sel: PassageSelection) => void
  /** Related facts & sources — LIVE when provided; the caller resolves a tracked claim intersecting the block. */
  onRelatedFacts?: (sel: PassageSelection) => void
  /** Inspect how this was made — LIVE when provided (the Phase 44 entry point). */
  onInspect?: (sectionId: string) => void
}

interface ResolvedSelection extends PassageSelection {
  /** Best-effort screen anchor for the floating toolbar; all-zero in jsdom (no layout) is expected and harmless. */
  top: number
  left: number
}

const LIVE_CLASSES =
  'flex min-h-[36px] items-center gap-[6px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.03em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]'

const RESERVED_CLASSES =
  'flex min-h-[36px] items-center gap-[6px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.03em] text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40'

// D-17 — visible-but-reserved, explanatory titles (never hidden; no shipped
// content-version endpoint exists yet, out of this phase's scope).
const COMPARE_TITLE =
  'Version history for passages arrives later — this reads the revision lineage, not yet wired.'
const RESTORE_TITLE =
  'Restoring a prior passage version is not yet wired — content version history is deferred.'

/**
 * Resolves the current `window.getSelection()` into a `ResolvedSelection`,
 * or `null` when there is no non-empty selection anchored inside
 * `container`. Never throws — a selection missing `getRangeAt`/
 * `getBoundingClientRect` (e.g. a test double) degrades to a (0,0) anchor
 * rather than crashing the listener.
 */
function resolveSelection(container: HTMLElement): ResolvedSelection | null {
  const selection = window.getSelection?.()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

  const quotedText = selection.toString()
  if (quotedText.trim() === '') return null

  const anchorNode = selection.anchorNode
  if (!anchorNode || !container.contains(anchorNode)) return null

  const anchorEl: Element | null =
    anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement

  const blockEl = anchorEl?.closest('[data-block-index]') ?? null
  const sectionEl = anchorEl?.closest('[id^="galley-"]') ?? null
  if (!blockEl || !sectionEl) return null

  const blockIndexAttr = blockEl.getAttribute('data-block-index')
  if (blockIndexAttr === null) return null
  const blockIndex = Number(blockIndexAttr)
  if (!Number.isInteger(blockIndex)) return null

  const sectionId = sectionEl.id.replace(/^galley-/, '')

  let top = 0
  let left = 0
  try {
    if (typeof selection.getRangeAt === 'function' && selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect?.()
      if (rect) {
        top = rect.top
        left = rect.left
      }
    }
  } catch {
    // Best-effort positioning only — never blocks selection resolution.
  }

  return { sectionId, blockIndex, quotedText, top, left }
}

export function PassageToolbar({
  containerRef,
  onRevise,
  onEditText,
  onRelatedFacts,
  onInspect,
}: PassageToolbarProps) {
  const [selection, setSelection] = useState<ResolvedSelection | null>(null)

  useEffect(() => {
    function handleSelectionChange() {
      const container = containerRef.current
      setSelection(container ? resolveSelection(container) : null)
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mouseup', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mouseup', handleSelectionChange)
    }
    // containerRef is a stable ref object — its `.current` is read fresh on
    // every event, so this effect intentionally has no dependency array churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!selection) return null

  // The public callback shape (`PassageSelection`) is deliberately narrower
  // than the internal `ResolvedSelection` (which additionally carries the
  // best-effort `top`/`left` screen anchor) — callers never see positioning
  // data mixed into the passage identity they act on.
  const publicSelection: PassageSelection = {
    sectionId: selection.sectionId,
    blockIndex: selection.blockIndex,
    quotedText: selection.quotedText,
  }

  return (
    <div
      role="toolbar"
      aria-label="Passage actions"
      className="galley-passage-toolbar fixed z-30 flex flex-wrap gap-2 border border-[color:var(--color-faint)] bg-[color:var(--color-paper)] p-2 shadow-sm"
      style={{ top: Math.max(selection.top - 44, 8), left: selection.left }}
    >
      <button type="button" className={LIVE_CLASSES} onClick={() => onEditText?.(publicSelection)}>
        Edit text
      </button>
      <button
        type="button"
        className={LIVE_CLASSES}
        onClick={() =>
          onRevise?.({
            sectionName: selection.sectionId,
            quotedText: selection.quotedText,
            blockIndexHint: selection.blockIndex,
          })
        }
      >
        Ask agent to revise
      </button>
      <button type="button" disabled title={COMPARE_TITLE} className={RESERVED_CLASSES}>
        Compare with previous
      </button>
      <button type="button" disabled title={RESTORE_TITLE} className={RESERVED_CLASSES}>
        Restore previous
      </button>
      <button type="button" className={LIVE_CLASSES} onClick={() => onRelatedFacts?.(publicSelection)}>
        Related facts &amp; sources
      </button>
      <button type="button" className={LIVE_CLASSES} onClick={() => onInspect?.(selection.sectionId)}>
        Inspect how this was made
      </button>
    </div>
  )
}
