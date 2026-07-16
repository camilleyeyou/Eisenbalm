/**
 * Phase 49 (ROL-03) Plan 49-06 Task 2 — LockedControl tests.
 *
 * A11Y-SAFE PATTERN (RESEARCH.md "Pattern 3" closing note): LockedControl
 * must force-disable the REAL interactive child (via React.cloneElement),
 * NOT wrap it in a pointer-events-none overlay div — a keyboard user must
 * never be able to tab to a focusable-but-inert control. These tests query
 * the actual <button> via getByRole, never a wrapper element.
 *
 * Runs in jsdom (environmentMatchGlobs '__tests__/*.test.tsx' -> jsdom).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { LockedControl } from '../components/LockedControl'

const LOCKED_LABEL = 'Apply revision 🔒 editor only'

afterEach(() => {
  cleanup()
})

describe('LockedControl (ROL-03)', () => {
  it('isLocked=true: force-disables the REAL button (not a wrapper) and associates the visible label via aria-describedby', () => {
    render(
      <LockedControl isLocked lockedLabel={LOCKED_LABEL}>
        <button type="button">Apply revision</button>
      </LockedControl>,
    )

    const button = screen.getByRole('button', {
      name: 'Apply revision',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-disabled')).toBe('true')

    // Present in the DOM, not removed.
    expect(button).toBeTruthy()

    // Verbatim §6 label is queryable as VISIBLE text, not hidden in a title=.
    const label = screen.getByText(LOCKED_LABEL)
    expect(label).toBeTruthy()
    expect(button.getAttribute('title')).not.toBe(LOCKED_LABEL)

    // Programmatically associated (accessible name / description path).
    const describedBy = button.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(label.id).toBe(describedBy)
  })

  it('isLocked=false: renders the child unchanged (fully interactive, not disabled)', () => {
    render(
      <LockedControl isLocked={false} lockedLabel={LOCKED_LABEL}>
        <button type="button">Apply revision</button>
      </LockedControl>,
    )

    const button = screen.getByRole('button', {
      name: 'Apply revision',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('aria-disabled')).toBeNull()

    // The locked explanation is not rendered at all when unlocked.
    expect(screen.queryByText(LOCKED_LABEL)).toBeNull()
  })
})
