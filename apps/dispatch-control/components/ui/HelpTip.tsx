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
 */
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'

export interface HelpTipProps {
  text: string
  label?: string
  className?: string
}

export default function HelpTip({ text, label, className }: HelpTipProps) {
  const [open, setOpen] = useState(false)
  const [align, setAlign] = useState<'left' | 'right'>('right')
  const tipId = useId()
  const tipRef = useRef<HTMLSpanElement>(null)

  // Best-effort viewport clamp: flip the tip to open leftward if it would
  // overflow the right edge of the viewport. jsdom returns zero-width rects
  // for everything, so this no-ops safely there rather than flipping on
  // meaningless zero-based math — it must never throw in the test env.
  useLayoutEffect(() => {
    if (!open) return
    if (typeof window === 'undefined') return
    const el = tipRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return
    setAlign(rect.right > window.innerWidth ? 'left' : 'right')
  }, [open])

  function close() {
    setOpen(false)
  }

  return (
    <span className={`relative inline-flex${className ? ` ${className}` : ''}`}>
      <button
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
      {open && (
        <span
          ref={tipRef}
          id={tipId}
          role="tooltip"
          className={`absolute top-full z-40 mt-1 max-w-[240px] whitespace-normal rounded-[2px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-[12.5px] leading-relaxed text-[color:var(--color-ink)] shadow-[0_2px_8px_rgba(0,0,0,0.12)] ${
            align === 'right' ? 'left-0' : 'right-0'
          }`}
        >
          {text}
        </span>
      )}
    </span>
  )
}
