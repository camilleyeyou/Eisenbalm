import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

afterEach(cleanup)
let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

import EditorShell from '../components/editor/EditorShell'

function current() {
  return screen
    .getAllByRole('link')
    .filter(l => l.getAttribute('aria-current') === 'page')
    .map(l => l.textContent)
}

describe('EditorShell', () => {
  beforeEach(() => {
    pathname = '/'
  })

  it('renders exactly three nav links in order', () => {
    render(<EditorShell>x</EditorShell>)
    const links = screen.getByRole('navigation', { name: 'Pages' }).querySelectorAll('a')
    expect(Array.from(links).map(a => [a.textContent, a.getAttribute('href')])).toEqual([
      ["This week's issue", '/'],
      ['Past issues', '/archive'],
      ['Behind the scenes', '/admin'],
    ])
  })

  it.each([
    ['/', "This week's issue"],
    ['/s/founderBio', "This week's issue"],
    ['/archive', 'Past issues'],
    ['/admin/runs/abc', 'Behind the scenes'],
  ])('marks the current link for %s', (p, label) => {
    pathname = p
    render(<EditorShell>x</EditorShell>)
    expect(current()).toEqual([label])
  })

  it('wordmark links home and no Admin text exists', () => {
    render(<EditorShell>child</EditorShell>)
    expect(screen.getByText('The Eisenbalm Dispatch').closest('a')?.getAttribute('href')).toBe('/')
    expect(screen.queryByText(/^Admin$/)).toBeNull()
    expect(screen.getByText('child')).toBeTruthy()
  })
})
