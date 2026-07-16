'use client'
/**
 * Phase 49 (ROL-03) Plan 49-06 — reusable "locked-with-explanation" wrapper.
 *
 * D-09: never hide a gated control for a Collaborator — render it disabled
 * with a VISIBLE explanation (not a title= tooltip). D-10: preserve existing
 * a11y invariants (WCAG AA, >=44px targets) and never leave the control
 * merely visually dimmed while still focusable-and-firing.
 *
 * A11Y-SAFE PATTERN (RESEARCH.md "Pattern 3" closing note): a non-interactive
 * inert-overlay wrapper (disabling clicks via CSS only) leaves the real
 * button focusable-but-inert — a keyboard user tabs to it and Enter/Space
 * still fires the underlying handler with no announcement. Instead, clone
 * the single interactive child to prop-thread `disabled` + `aria-disabled`
 * onto the ACTUAL element, and associate the visible explanation via
 * `aria-describedby`.
 *
 * Labels are ALWAYS supplied by the caller (Plan 49-07 wires the six
 * verbatim DERIVED-STATE-CONTRACT §6 strings) — never hard-coded here.
 */
import React from 'react'

interface LockedControlProps {
  isLocked: boolean
  /** Verbatim §6 text — passed by caller, never paraphrased here. */
  lockedLabel: string
  /** A SINGLE interactive element (the action <button>). */
  children: React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>
  className?: string
}

export function LockedControl({
  isLocked,
  lockedLabel,
  children,
  className,
}: LockedControlProps) {
  const labelId = React.useId()
  const child = React.Children.only(children)

  if (!isLocked) {
    return <>{child}</>
  }

  const describedBy = [child.props['aria-describedby'], labelId]
    .filter(Boolean)
    .join(' ')

  // Force-disable the REAL element (additive to any disabled the caller
  // already passed) — never a CSS-only inert overlay.
  const lockedChild = React.cloneElement(child, {
    disabled: true,
    'aria-disabled': true,
    'aria-describedby': describedBy,
  })

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      {lockedChild}
      <span
        id={labelId}
        role="note"
        className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-ink-soft)]"
      >
        {lockedLabel}
      </span>
    </div>
  )
}
