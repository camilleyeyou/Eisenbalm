'use client'
/**
 * @portabletext/react `marks.annotation` component (Phase 32, GLY-02, D-07/D-10).
 *
 * Renders the inline severity-tiered underline (`.galley-anno` +
 * `data-severity`) around the annotated span, and a read-only popover on
 * click/keyboard-open showing axis · severity · reason · suggested fix — the
 * design's popover minus the action buttons (D-10). Phase 33 (EDT-04) adds
 * an Accept/Edit/Dismiss action row into this same component; the
 * placeholder comment below marks exactly where.
 *
 * The `value` prop is the `AnnotationMarkDef` markDef payload injected by
 * `syntheticPortableText.ts`'s `toSyntheticBlocks` (Plan 32-04).
 */
import { useEffect, useRef, useState } from 'react'

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
}

export default function AnnotationMark({ value, children }: AnnotationMarkProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)

  function toggle() {
    setOpen(prev => !prev)
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
          {/* Phase 33 (EDT-04): Accept/Edit/Dismiss action row mounts here */}
        </span>
      )}
    </span>
  )
}
