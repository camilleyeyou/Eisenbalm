import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import NextStepSlab from '../components/editor/NextStepSlab'
import StatusWord from '../components/editor/StatusWord'

afterEach(cleanup)

describe('NextStepSlab', () => {
  it('renders one primary button and calls onClick once', () => {
    const onClick = vi.fn()
    const { container } = render(<NextStepSlab sentence="Read it." primary={{ label: 'Publish', onClick }} />)
    expect(container.querySelectorAll('[data-primary]').length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[disabled]')).toBeNull()
  })

  it('busy latch ignores clicks and sets aria-busy', () => {
    const onClick = vi.fn()
    render(<NextStepSlab sentence="s" primary={{ label: 'Publish', onClick, busy: true }} />)
    const b = screen.getByRole('button', { name: 'Publish' })
    expect(b.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('primary with href renders an anchor', () => {
    const { container } = render(<NextStepSlab sentence="s" primary={{ label: 'Open', href: '/x' }} />)
    const a = container.querySelector('a[data-primary]')
    expect(a?.getAttribute('href')).toBe('/x')
  })

  it('working renders text and no button', () => {
    const { container } = render(<NextStepSlab sentence="s" working />)
    expect(screen.getByText('Working')).toBeTruthy()
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelectorAll('[data-primary]').length).toBe(0)
  })

  it('ghost renders a non-primary link', () => {
    const { container } = render(<NextStepSlab sentence="s" ghost={{ label: 'Go', href: '/g' }} />)
    const a = screen.getByRole('link', { name: 'Go' })
    expect(a.getAttribute('href')).toBe('/g')
    expect(container.querySelectorAll('[data-primary]').length).toBe(0)
  })

  it('error uses role=alert', () => {
    render(<NextStepSlab sentence="s" error="Nope" />)
    expect(screen.getByRole('alert').textContent).toBe('Nope')
  })

  it('external link opens safely', () => {
    render(<NextStepSlab sentence="s" link={{ label: 'See', href: 'https://e.com', external: true }} />)
    const a = screen.getByRole('link', { name: 'See' })
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('section is labelled by the eyebrow', () => {
    render(<NextStepSlab sentence="s" />)
    expect(screen.getByRole('region', { name: 'Your next step' })).toBeTruthy()
  })
})

describe('StatusWord', () => {
  it('renders the word with an aria-hidden svg for Problem', () => {
    const { container } = render(<StatusWord word="Problem" hideMarker={false} />)
    expect(screen.getByText('Problem')).toBeTruthy()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})
