'use client'
/**
 * ScrollHintRow — fast 260723 (mobile scroll-affordance indicator).
 *
 * Wraps a horizontally scrollable row and renders measurement-driven edge
 * hints: a fade + chevron on the RIGHT while more content is clipped off that
 * edge, and on the LEFT once the row has been scrolled. Both disappear
 * entirely when the content fits — so at desktop widths (where these rows
 * wrap or fit) the component renders exactly like a plain div.
 *
 * Used by the Issue Workspace stage-tab row (`issues/[issueNumber]/
 * layout.tsx`) and the Masthead status strip (`Masthead.tsx`) — the two rows
 * that become swipe-scrollable on narrow viewports (quick 260722-v01) but
 * previously gave the operator no visual cue that more options existed
 * off-screen.
 *
 * Props:
 *   className        — classes for the SCROLLER row itself (flex classes,
 *                      gaps, max-lg:overflow-x-auto etc. live here)
 *   wrapperClassName — classes for the relative outer wrapper (sizing within
 *                      the parent flex row, e.g. `min-w-0 flex-1`)
 *   fadeColor        — CSS color the fades blend FROM; must match the
 *                      background behind the row (default: the rail token)
 *   chevronClassName — color/utility classes for the chevron icons
 *
 * The hints are purely decorative (aria-hidden, pointer-events-none) — the
 * scroll behavior itself is native and unchanged.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScrollHintRowProps {
  children: React.ReactNode
  className?: string
  wrapperClassName?: string
  fadeColor?: string
  chevronClassName?: string
}

/** Tolerance so sub-pixel rounding never leaves a phantom hint. */
const EDGE_EPSILON = 4

export default function ScrollHintRow({
  children,
  className,
  wrapperClassName,
  fadeColor = 'var(--color-rail)',
  chevronClassName = 'text-[color:var(--color-ink)]',
}: ScrollHintRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [hints, setHints] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const left = el.scrollLeft > EDGE_EPSILON
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_EPSILON
    setHints(prev => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    measure()
    // Re-measure on content/viewport size changes (orientation flips, tab
    // count changes, font load) — not just on scroll.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  return (
    <div className={cn('relative', wrapperClassName)}>
      <div ref={scrollerRef} onScroll={measure} className={className}>
        {children}
      </div>
      {hints.left && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-start"
          style={{ background: `linear-gradient(to right, ${fadeColor} 45%, transparent)` }}
        >
          <ChevronLeft size={19} strokeWidth={2.75} className={cn('shrink-0', chevronClassName)} />
        </span>
      )}
      {hints.right && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end"
          style={{ background: `linear-gradient(to left, ${fadeColor} 45%, transparent)` }}
        >
          <ChevronRight size={19} strokeWidth={2.75} className={cn('shrink-0', chevronClassName)} />
        </span>
      )}
    </div>
  )
}
