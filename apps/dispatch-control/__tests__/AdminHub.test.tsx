/**
 * Quick 261021-j83 (D-7) — /admin hub: 7 plain-language links, Finance and
 * Charities first, every href under /admin/.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import AdminHubPage from '../app/admin/page'

afterEach(cleanup)

describe('AdminHubPage', () => {
  it('renders the heading and exactly 7 links', () => {
    render(<AdminHubPage />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Admin')
    expect(screen.getAllByRole('link')).toHaveLength(7)
  })

  it('lists Finance and Charities first, tagged as checked weekly', () => {
    render(<AdminHubPage />)
    const links = screen.getAllByRole('link')
    expect(links[0].textContent).toContain('Finance')
    expect(links[1].textContent).toContain('Charities')
    expect(screen.getAllByText('Checked weekly')).toHaveLength(2)
  })

  it('every href starts with /admin/', () => {
    render(<AdminHubPage />)
    for (const a of screen.getAllByRole('link')) {
      expect(a.getAttribute('href')).toMatch(/^\/admin\//)
    }
  })
})
