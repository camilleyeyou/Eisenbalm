'use client'
/**
 * Quick 260722-fom (Task 1) — HelpTip: the reusable in-house `?` help-tip
 * primitive used across dispatch-control operator surfaces.
 *
 * Opens on hover, keyboard focus, and click/tap (toggle) — so touch devices
 * with no hover can still reach it. Escape closes it. When open, the button
 * is wired to the tip via `aria-describedby` so screen readers announce the
 * explanation.
 *
 * CRITICAL (render-loop discipline, learned quick 260721-pmn/-ohu): this
 * component MUST be rendered as plain STATIC leaf JSX with module-constant
 * string props (from `helpCopy.ts`'s `HELP_COPY`). It must never be
 * registered through a `setPanelContent` effect, and no `setPanelContent`
 * effect dependency list should ever gain a prop that flows through here.
 *
 * No new npm dependency — uses the already-installed `lucide-react`
 * `HelpCircle` icon and existing CSS-variable design tokens.
 *
 * quick 260722-tv1: popover z-index raised `z-20` -> `z-40` — it was
 * rendering under the workspace sticky stage nav (z-30).
 *
 * quick 260722-v01 (audit item 7): the popover now renders via
 * `createPortal(document.body)` with `position: fixed`, positioned from the
 * trigger's `getBoundingClientRect()` — so it can never clip inside an
 * overflow:hidden/auto ancestor (ContextPanel, table cells, etc). Default
 * placement is below the trigger, clamped 8px from the viewport left/right
 * edges, and flips to bottom-anchored (above the trigger) when there isn't
 * room below. Raised to `z-[60]` — a help icon inside a `z-50` dialog may
 * legitimately need to sit above it. SSR-safe: only portals after mount.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'

export interface HelpTipProps {
  text: string
  label?: string
  className?: string
}

interface TipPosition {
  top: number
  left: number
  placement: 'below' | 'above'
}

const TIP_MAX_WIDTH = 240
const VIEWPORT_MARGIN = 8
const GAP = 4

export default function HelpTip({ text, label, className }: HelpTipProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<TipPosition | null>(null)
  const tipId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  // Only portal once mounted client-side (SSR-safe — `document` doesn't
  // exist during server render).
  useEffect(() => {
    setMounted(true)
  }, [])

  // Position the portaled tip from the trigger's rect. jsdom returns
  // zero-width rects for everything — guarded so this never throws or
  // computes meaningless flips there; it just no-ops to a default position.
  useLayoutEffect(() => {
    if (!open) return
    if (typeof window === 'undefined') return
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      setPosition({ top: 0, left: 0, placement: 'below' })
      return
    }

    const spaceBelow = window.innerHeight - rect.bottom
    // A rough estimate of the tip's rendered height for the flip decision —
    // the tip itself still just anchors to top/bottom, so an imprecise
    // estimate here only affects the flip threshold, never correctness.
    const estimatedTipHeight = tipRef.current?.getBoundingClientRect().height || 60
    const placement: TipPosition['placement'] =
      spaceBelow < estimatedTipHeight + GAP ? 'above' : 'below'

    let left = rect.left
    const maxLeft = window.innerWidth - TIP_MAX_WIDTH - VIEWPORT_MARGIN
    if (left > maxLeft) left = Math.max(VIEWPORT_MARGIN, maxLeft)
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN

    const top = placement === 'below' ? rect.bottom + GAP : rect.top - GAP

    setPosition({ top, left, placement })
    // Re-measure once the tip has rendered (its real height may differ from
    // the estimate) so the flip decision settles correctly on first open.
  }, [open, text])

  function close() {
    setOpen(false)
  }

  return (
    <span className={`relative inline-flex${className ? ` ${className}` : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label ?? 'Help'}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={close}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onClick={() => setOpen(prev => !prev)}
        onKeyDown={event => {
          if (event.key === 'Escape') close()
        }}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[color:var(--color-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
      >
        <HelpCircle size={15} aria-hidden="true" />
      </button>
      {open &&
        mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            style={{
              position: 'fixed',
              top: position ? position.top : 0,
              left: position ? position.left : 0,
              transform: position?.placement === 'above' ? 'translateY(-100%)' : undefined,
            }}
            className="z-[60] max-w-[240px] whitespace-normal rounded-[2px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-[12.5px] leading-relaxed text-[color:var(--color-ink)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
          >
            {text}
          </div>,
          document.body,
        )}
    </span>
  )
}
