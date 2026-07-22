/**
 * Quick 260722-fom (Task 1) — HelpTip: the reusable in-house `?` help-tip
 * primitive. Covers hover, focus, tap-toggle, Escape close, and the
 * aria-describedby wiring that makes the tip screen-reader-announced when
 * open.
 *
 * No mocks required — HelpTip is a plain stateful client component with no
 * Convex/Clerk/router dependencies.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import HelpTip from '../components/ui/HelpTip'

afterEach(() => {
  cleanup()
})

describe('HelpTip', () => {
  it('renders a button with an accessible name and a hidden HelpCircle icon; the tip text is not in the document initially', () => {
    render(<HelpTip text="This is the help text." />)

    const button = screen.getByRole('button', { name: 'Help' })
    expect(button).toBeDefined()

    const icon = button.querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute('aria-hidden')).toBe('true')

    expect(screen.queryByText('This is the help text.')).toBeNull()
  })

  it('uses the provided label as the accessible name when given', () => {
    render(<HelpTip text="Explains the thing." label="Explain claim coverage" />)
    expect(screen.getByRole('button', { name: 'Explain claim coverage' })).toBeDefined()
  })

  it('shows the tip on mouseEnter (hover)', () => {
    render(<HelpTip text="This is the help text." />)
    const button = screen.getByRole('button', { name: 'Help' })

    fireEvent.mouseEnter(button)

    expect(screen.getByText('This is the help text.')).toBeDefined()
  })

  it('shows the tip on focus (keyboard/touch parity — no hover required)', () => {
    render(<HelpTip text="This is the help text." />)
    const button = screen.getByRole('button', { name: 'Help' })

    fireEvent.focus(button)

    expect(screen.getByText('This is the help text.')).toBeDefined()
  })

  it('toggles the tip open -> closed -> open on click (tap support)', () => {
    render(<HelpTip text="This is the help text." />)
    const button = screen.getByRole('button', { name: 'Help' })

    fireEvent.click(button)
    expect(screen.getByText('This is the help text.')).toBeDefined()

    fireEvent.click(button)
    expect(screen.queryByText('This is the help text.')).toBeNull()

    fireEvent.click(button)
    expect(screen.getByText('This is the help text.')).toBeDefined()
  })

  it('closes the tip on Escape when open', () => {
    render(<HelpTip text="This is the help text." />)
    const button = screen.getByRole('button', { name: 'Help' })

    fireEvent.click(button)
    expect(screen.getByText('This is the help text.')).toBeDefined()

    fireEvent.keyDown(button, { key: 'Escape' })
    expect(screen.queryByText('This is the help text.')).toBeNull()
  })

  it('wires aria-describedby to the tip element id when open, and omits it when closed', () => {
    render(<HelpTip text="This is the help text." />)
    const button = screen.getByRole('button', { name: 'Help' })

    expect(button.getAttribute('aria-describedby')).toBeNull()

    fireEvent.click(button)
    const describedBy = button.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()

    const tipEl = document.getElementById(describedBy as string)
    expect(tipEl).not.toBeNull()
    expect(tipEl?.textContent).toBe('This is the help text.')

    fireEvent.click(button)
    expect(button.getAttribute('aria-describedby')).toBeNull()
  })

  it('meets the 44px touch-target convention', () => {
    render(<HelpTip text="This is the help text." />)
    const button = screen.getByRole('button', { name: 'Help' })

    expect(button.className).toContain('min-h-[44px]')
    expect(button.className).toContain('min-w-[44px]')
  })
})
